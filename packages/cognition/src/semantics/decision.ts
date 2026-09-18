import { Action, type ActionProposal, type Perception } from "@unwatched/protocol";
import { normalize, outputQualityIssue, type SemanticIssue } from "./quality.ts";

const issue = (code: string, path: string, message: string): SemanticIssue => ({ code, path, message });
const actionNames = new Set<string>(Action.options.map(option => option.shape.kind.value));

/** Evidence visible to this citizen only. Never consult hidden stocks or AgentState.memory. */
function knownItems(p: Perception): Set<string> {
  return new Set([
    ...p.self.inventory, ...p.place.for_sale.map(item => item.item), ...Object.keys(p.place.stock ?? {}),
    ...(p.place.recipes ?? []).flatMap(recipe => [recipe.item, ...recipe.from]),
    ...(p.self.learned_food ?? []).map(food => food.item), ...(p.self.food_advice ?? []).map(food => food.item),
  ].map(normalize));
}

/** Reject obvious commands/placeholders, not unfamiliar nouns. Incomplete knowledge
 * is NOT an exhaustive item allowlist; novel products and local names stay possible. */
export function concreteReferenceIssue(value: string, path: string, known = new Set<string>()): SemanticIssue | null {
  if (known.has(normalize(value))) return null;
  if (!/[\p{L}\p{N}]/u.test(value) || /[\n\r{}!?]/u.test(value)
      || /^(?:i\s+(?:will|want|need)|you\s+(?:should|must)|(?:please\s+)?(?:use|buy|sell|eat|cook|make|go|get)\s|(?:haz|hace|hacer|usa|usar|compra|comprar|come|comer|cocina|cocinar|ve|ir)\s|(?:voy|vamos)\s+a\s)/iu.test(value)
      || /\b(?:whatever|something|anything|lo que haya|lo que sea|alguna cosa)\b/iu.test(value)) {
    return issue("reference_not_name", path, "Use a concrete item/place name or ID, not an instruction, placeholder or unfinished sentence. Copy observed names when available.");
  }
  return null;
}

/** Only facts proving impossibility in the supplied perception; the engine still
 * validates execution/races. Site and community work are NOT wage employment. */
export function workIssue(p: Perception): SemanticIssue | null {
  const problem = (reason: string) => issue("work_precondition", "action", reason);
  if (p.self.weak || (p.self.days_hungry ?? 0) >= 2) return problem("Too weak with hunger to work; address food or choose another action.");
  if (p.place.community || p.place.site) return null;
  if (p.time.weekday === "Sunday") return problem("Sunday: no wage shifts. work cannot earn wages today; apply requests employment, it does not work a shift.");
  if (p.place.broken) return problem("This workplace is broken; work cannot operate it.");
  if (p.self.job === null) return problem("No assigned job. work is not odd jobs or applying; use apply at an opening, or choose another supported action.");
  if (p.self.shift) {
    if (p.self.shift.place !== p.place.id) return problem("Your assigned shift is elsewhere. Travel there before work.");
    const hour = p.time.minute / 60;
    if (hour < p.self.shift.hours[0] || hour >= p.self.shift.hours[1]) return problem("Outside your assigned shift hours. work does not mean arbitrary paid activity.");
  }
  return null;
}

/** Direct operations only: singing about buying bread, discussing a move, and
 * metaphorical prose are not automatically interpreted as physical commands. */
export function concreteOperation(text: string): string | null {
  const direct = normalize(text).replace(/^(?:i\s+(?:will\s+)?|yo\s+|voy a\s+)/u, "");
  if (/^(?:go|walk|travel|move|head)\s+(?:to|toward)|^(?:ir|voy|caminar|camino|viajar|moverme|me voy|me acerco|desplazarme)\s+(?:a|al|hacia)/u.test(direct)) return "move";
  if (/^(?:buy|sell|purchase|comprar|compro|compra|vender|vendo|vende)\b/u.test(direct)) return "trade";
  if (/^(?:eat|consume|comer|como|come|comerme|comerla|consumir)\b/u.test(direct)) return "use";
  if (/^(?:apply for|solicitar empleo|solicito empleo|pedir trabajo)\b/u.test(direct)) return "apply";
  if (/^(?:repair|reparar|reparo)\b/u.test(direct)) return "repair";
  return null;
}

const OPTIONAL = new Set(["propose_skill", "test_skill", "decorate", "call", "found_institution", "start_project", "make", "work"]);
export function urgentNeeds(p: Perception): string[] {
  return [
    p.self.feels?.hunger && /starving|weak with hunger/iu.test(p.self.feels.hunger) ? "hunger" : null,
    p.self.feels?.rest === "exhausted" ? "exhaustion" : null,
  ].filter((need): need is string => need !== null);
}

export function memorySystemIssue(memory: string, path: string): SemanticIssue | null {
  if (/\b(?:perception\.options|options?\s+(?:include|contain|allow)|the options|the (?:engine|schema|system prompt)|json schema|supported actions|reglas del (?:sistema|motor)|las opciones|el (?:engine|schema))\b/iu.test(memory)) {
    return issue("memory_system_inference", path, "Personal memory is significance from existing experience, not system rules, action lists or guesses about mechanics. Omit optional memories when nothing durable was learned.");
  }
  return null;
}

function memoryIssue(memory: string, index: number, p: Perception): SemanticIssue | null {
  const path = `remember[${index}]`;
  if (!memory.trim()) return issue("memory_empty", path, "Omit empty memories; use remember: [] when nothing durable was learned.");
  if (/^[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+$/u.test(memory.trim())) return issue("memory_label", path, "A memory should express personal meaning, not a metadata label. Use remember: [] if nothing durable was learned.");
  const system = memorySystemIssue(memory, path); if (system) return system;
  // Only high-confidence first-person outcome claims; do not censor beliefs or lies
  // in dialogue. Require the same claim in an unquoted recorded observation.
  const physicalClaim = /\b(?:i (?:just |already )?(?:bought|sold|ate|earned|paid|repaired|built|arrived|moved|worked|gave|took)|(?:ya )?(?:compré|vendí|comí|cobré|pagué|reparé|construí|llegué|trabajé))(?=$|[^\p{L}])/iu;
  const reported = /^(?:i (?:thought|believe|suspect)|creo que|pensé que|sospecho que|me dijeron|\S+ (?:said|told me|dijo))\b/iu.test(memory);
  if (!reported && physicalClaim.test(memory)) {
    const claim = normalize(memory).replace(/[.!]+$/u, "");
    const supported = p.recent.some(record => {
      const observation = record.match(/^\[minute \d+; recorded observation; quoted claims remain claims\]\s*(.*)$/u)?.[1];
      return observation && !/["“”«»]/u.test(observation) && normalize(observation).includes(claim);
    });
    if (!supported) return issue("memory_unverified_outcome", path, "Do not store a proposed/failed action as completed. Physical outcomes require recorded observation; keep a grounded personal feeling instead, or remember: [].");
  }
  return null;
}

export function decisionIssue(out: ActionProposal, p: Perception): SemanticIssue | null {
  const quality = outputQualityIssue(out); if (quality) return quality;
  const action = out.action;
  if (action.kind === "call" && actionNames.has(action.name)
      && !/\b(?:nam(?:e|ing)|renam\w*|llamar|llamo|nombr\w*|bautiz\w*)\b/iu.test(out.intent ?? "")) {
    return issue("action_dispatch_as_name", "action.name", "call only names the current place; it never invokes an action. Put the intended operation in action.kind. If this really is your chosen place name, explain that naming intention.");
  }
  if (action.kind === "work") { const invalid = workIssue(p); if (invalid) return invalid; }
  if (action.kind === "use" && !p.self.inventory.includes(action.item)) return issue("use_not_carried", "action.item", "use consumes an item already carried. Buying requires trade first; proposing a purchase does not put it in inventory.");
  const items = knownItems(p);
  if ("item" in action && typeof action.item === "string") { const invalid = concreteReferenceIssue(action.item, "action.item", items); if (invalid) return invalid; }
  if (action.kind === "trade") for (const field of ["buy", "sell"] as const) {
    const value = action[field]; if (value !== undefined) { const invalid = concreteReferenceIssue(value, `action.${field}`, items); if (invalid) return invalid; }
  }
  if (action.kind === "trade" && action.sell && !p.self.inventory.includes(action.sell)) return issue("sell_not_carried", "action.sell", "sell names an item you already carry. To purchase, put the item in buy; omit with for the local shop. Buying adds to inventory; use consumes it in a later action.");
  if (action.kind === "propose_skill") {
    for (const [index, step] of action.recipe.steps.entries()) {
      for (const [field, value] of Object.entries(step)) {
        if (field === "kind") continue;
        for (const name of Array.isArray(value) ? value : [value]) {
          if (typeof name !== "string") continue;
          const invalid = concreteReferenceIssue(name, `action.recipe.steps[${index}].${field}`, field === "to" ? new Set([p.place.id, ...p.place.exits].map(normalize)) : items);
          if (invalid) return invalid;
        }
      }
      if (step.kind === "make") items.add(normalize(step.item));
    }
  }
  if (action.kind === "do") {
    const operation = action.what.split(/[,;.]|\b(?:and then|then|y luego|luego|después)\b/iu).map(concreteOperation).find(Boolean);
    if (operation) return issue("do_replaces_action", "action.what", `This is ${operation}, not a free deed. Choose its concrete action and only the next physical step; do cannot bundle travel/trade/consumption or bypass prerequisites.`);
  }
  const urgent = urgentNeeds(p);
  if (urgent.length && OPTIONAL.has(action.kind)) {
    const reason = out.intent ?? "";
    const acknowledges = urgent.every(need => (need === "hunger" ? /hungr|hunger|starv|hambre|hambrient/iu : /exhaust|tired|agotad|cansad/iu).test(reason));
    if (!acknowledges) return issue("urgent_need_unaddressed", "intent", `Current ${urgent.join(" and ")} outweighs routine plans. Prefer a feasible immediate remedy using inventory/shelf/coins. Skills do not execute their steps. You may deliberately take the risk: explain the urgent need and your personal reason in intent, or choose again.`);
  }
  for (const [index, memory] of out.remember.entries()) { const invalid = memoryIssue(memory, index, p); if (invalid) return invalid; }
  return null;
}
