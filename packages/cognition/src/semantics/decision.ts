import { Action, type ActionProposal, type Perception } from "@unwatched/protocol";
import { normalize, outputQualityIssue, type SemanticIssue } from "./quality.ts";
import { intentIssue, intentPremiseIssue } from "./intent.ts";
import { groundedClaimIssue, observedRecords } from "./evidence.ts";
import { observablePrecondition } from "./preconditions.ts";
import { attributionIssue } from "./attribution.ts";
import { sourceAssertions } from "./sources.ts";
import { speechMemoryIssue } from "./speech-memory.ts";
import { institutionIssue, perceivedMayor } from "./institution.ts";
import { perceivedLodging } from "./lodging.ts";
import { denialIssue, encounters } from "./continuity-claims.ts";

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
      || /^(?:i\s+(?:will|want|need)|you\s+(?:should|must)|(?:please\s+)?(?:use|buy|sell|eat|cook|make|go|get)\s)/iu.test(value)
      || /\b(?:whatever|something|anything)\b/iu.test(value)) {
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
  const direct = normalize(text).replace(/^i am [^.!?]{1,80}, so /u, "")
    .replace(/^so /u, "")
    .replace(/^(?:i\s+(?:(?:will|should|must)\s+)?)/u, "");
  if (/^(?:go|walk|travel|move|head)\s+(?:to|toward)/u.test(direct)) return "move";
  if (/^(?:buy|sell|purchase)\b/u.test(direct)) return "trade";
  if (/^(?:eat|consume)\b/u.test(direct)) return "use";
  if (/^(?:apply for)\b/u.test(direct)) return "apply";
  if (/^(?:repair)\b/u.test(direct)) return "repair";
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
  if (/\b(?:perception\.options|options?\s+(?:include|contain|allow)|the options|the (?:engine|schema|system prompt)|json schema|supported actions)\b/iu.test(memory)) {
    return issue("memory_system_inference", path, "Personal memory is significance from existing experience, not system rules, action lists or guesses about mechanics. Omit optional memories when nothing durable was learned.");
  }
  return null;
}

function memoryIssue(memory: string, index: number, p: Perception, selfName?: string): SemanticIssue | null {
  const path = `remember[${index}]`;
  if (!memory.trim()) return issue("memory_empty", path, "Omit empty memories; use remember: [] when nothing durable was learned.");
  if (/^[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+$/u.test(memory.trim())) return issue("memory_label", path, "A memory should express personal meaning, not a metadata label. Use remember: [] if nothing durable was learned.");
  const system = memorySystemIssue(memory, path); if (system) return system;
  const speech = speechMemoryIssue(memory, path, p.recent); if (speech) return speech;
  const names = [...(selfName ? [selfName] : []), ...p.nearby.map(person => person.name)];
  const attributed = attributionIssue(memory, path, sourceAssertions(p.recent.map((text, i) => ({ ref: `recent[${i}]`, text })), names), selfName ? [selfName] : []);
  const evidence = { records: observedRecords(p.recent), selfNames: selfName ? [selfName] : [], debts: p.self.debts, ...perceivedLodging(p, memory),
    since: (p.time.day - 1) * 1440, until: (p.time.day - 1) * 1440 + p.time.minute };
  return attributed ?? denialIssue(memory, path, evidence, encounters(sourceAssertions(p.recent.map((text,i)=>({ref:`recent[${i}]`,text})))))
    ?? groundedClaimIssue(memory, path, evidence);
}

export function decisionIssue(out: ActionProposal, p: Perception, selfName?: string): SemanticIssue | null {
  const quality = outputQualityIssue(out); if (quality) return quality;
  const role = perceivedMayor(p, selfName);
  for (const [path, text] of [["intent", out.intent ?? ""], ...out.remember.map((text, i) => [`remember[${i}]`, text])] as [string, string][]) {
    const invalid = institutionIssue(text, path, role); if (invalid) return invalid;
  }
  const intent = intentIssue(out);
  if (intent) {
    const premise = intentPremiseIssue(out, p, selfName);
    return premise ? { ...intent, message: `${intent.message} Also at intent: ${premise.message}` } : intent;
  }
  const action = out.action;
  const precondition = observablePrecondition(action, p); if (precondition) return precondition;
  if (action.kind === "move" && [p.place.id, p.place.name].includes(action.to)) return issue("move_already_here", "action.to", "You are already at this destination. Choose the next local step or a different destination; announcing or repeating arrival does not advance it.");
  if (action.kind === "say" && action.to && !p.nearby.some(person => {
    const name = normalize(person.name), target = normalize(action.to!);
    return !person.asleep && (person.agent === action.to || name === target || name.startsWith(target) || target.startsWith(name.split(" ")[0]!));
  })) {
    return issue("say_not_present", "action.to", "The addressed person is not listed awake here. Use an exact ID/name from nearby, travel to find them, or choose another action. A remembered promise does not establish presence.");
  }
  if (action.kind === "call" && actionNames.has(action.name)
      && !/\b(?:nam(?:e|ing)|renam\w*)\b/iu.test(out.intent ?? "")) {
    return issue("action_dispatch_as_name", "action.name", "call only names the current place; it never invokes an action. Put the intended operation in action.kind. If this really is your chosen place name, explain that naming intention.");
  }
  if (action.kind === "work") { const invalid = workIssue(p); if (invalid) return invalid; }
  if (action.kind === "use" && !p.self.inventory.includes(action.item)) return issue("use_not_carried", "action.item", "use consumes an item already carried. Buying requires trade first; proposing a purchase does not put it in inventory. If you reconsider this as a purchase, include the exact intended product in action.buy; a bare trade may buy something else. Preserve that distinction in intent.");
  const items = knownItems(p);
  if ("item" in action && typeof action.item === "string") { const invalid = concreteReferenceIssue(action.item, "action.item", items); if (invalid) return invalid; }
  if (action.kind === "trade") for (const field of ["buy", "sell"] as const) {
    const value = action[field]; if (value !== undefined) {
      const invalid = concreteReferenceIssue(value, `action.${field}`, items);
      if (invalid) {
        const availability = tradeIssue(out, p);
        return { ...invalid, message: invalid.message + (field === "sell" ? " Omit an unused optional sell; do not invent a sale to fill it." : "")
          + (availability ? ` Also: ${availability.message}` : "") };
      }
    }
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
    const operation = action.what.split(/[,;.]|\b(?:and then|then)\b/iu).map(concreteOperation).find(Boolean);
    if (operation) return issue("do_replaces_action", "action.what", `This is ${operation}, not a free deed. Choose its concrete action and only the next physical step; do cannot bundle travel/trade/consumption or bypass prerequisites.`);
  }
  const urgent = urgentNeeds(p);
  if (urgent.length && OPTIONAL.has(action.kind)) {
    const reason = out.intent ?? "";
    const acknowledges = urgent.every(need => (need === "hunger" ? /hungr|hunger|starv/iu : /exhaust|tired/iu).test(reason));
    if (!acknowledges) return issue("urgent_need_unaddressed", "intent", `Current ${urgent.join(" and ")} outweighs routine plans. Prefer a feasible immediate remedy using inventory/shelf/coins. Skills do not execute their steps. You may deliberately take the risk: explain the urgent need and your personal reason in intent, or choose again.`);
  }
  const trade = tradeIssue(out, p);
  const memories = out.remember.map((memory, index) => memoryIssue(memory, index, p, selfName)).filter((value): value is SemanticIssue => value !== null);
  // A missing product and an unsupported memory are independent. Diagnose
  // both before spending the single repair, anchored to the concrete command.
  if (trade) return { ...trade, message: [trade.message, ...memories.slice(0, 3).map(m => `Also fix ${m.path}: ${m.message}`)].join("\n") };
  if (memories[0]) return memories[0];
  const premise = intentPremiseIssue(out, p, selfName); if (premise) return premise;
  return null;
}

/** Check only a known local counter. A person may trade goods not on its shelf;
 * their private inventory and consent remain unknown until world execution. */
export function tradeIssue(out: ActionProposal, p: Perception): SemanticIssue | null {
  const action = out.action;
  if (action.kind !== "trade") return null;
  // A specific immediate purchase must name its product in the command. Bare
  // trade delegates the product to the engine's default, not to this prose.
  // Only direct, unquoted choices and observed item names are classified here.
  const direct = normalize(out.intent ?? "").replace(/^i am [^.!?;]{1,100}, so /u, "");
  const choice = direct.match(/^(?:(?:now )?(?:i (?:will |choose to |am going to |am )?|i'll ))?(?:buy(?:ing)?|purchas(?:e|ing))\s+(.+)$/u)?.[1];
  const objects = choice?.split(/[.;!?]|\b(?:then|but|since)\b/u)[0]?.split(/\band\b/u)
    .map(object => object.trim().replace(/^(?:(?:a|an|the|some|one|two|\d+)\s+)?(?:(?:bowl|loaf|piece) of\s+)?/u, "")) ?? [];
  const selected = [...knownItems(p)].filter(item => objects.some(object => object === item || object.startsWith(item + " ")));
  if (selected.length > 1) return issue("trade_item_intent_mismatch", "action.buy",
    `The immediate intention selects multiple products (${selected.join(", ")}), but one trade has one buy item. Choose one product explicitly in action.buy and intent; describe any other purchase as a later step. Do not silently discard part of the intention.`);
  if (selected.length === 1 && normalize(action.buy ?? "") !== selected[0]) return issue("trade_item_intent_mismatch", "action.buy",
    `The immediate intention selects ${selected[0]}, but action.buy does not. Set action.buy to ${JSON.stringify(selected[0])} while preserving the other valid action fields; bare trade may buy a different default. Preserve the chosen item when repairing, or explain why you reconsidered it.`);
  const local = !action.with || action.with === p.place.id;
  if (!local) {
    const target = action.with!.trim().toLowerCase();
    const present = p.nearby.some(person => person.agent === action.with || person.name.toLowerCase() === target
      || person.name.toLowerCase().startsWith(target) || target.startsWith(person.name.toLowerCase().split(" ")[0]!));
    return present ? null : issue("trade_target_not_present", "action.with",
      `trade.with must name a person currently nearby or the current place ID (${p.place.id}). Omit with for this local counter. Job IDs, unnamed keepers/stalls and remote shops are not trading partners; travel first for another shop. Preserve the intended product when repairing this reference.`);
  }
  // Preserve the engine's existing bare-trade default (cheapest local food).
  // It still buys, never consumes; intent/memory checks enforce that distinction.
  if (action.buy) {
    const offer = p.place.for_sale.find(o => o.item === action.buy);
    if (!offer) return issue("trade_not_offered", "action.buy", "This local counter does not currently offer that item in for_sale. Stock, rumor and ownership do not imply a retail offer. Reconsider the next step explicitly; do not pretend this purchase is executable.");
    if (offer.price > p.self.coins) return issue("trade_unaffordable", "action.buy", "The observed price exceeds personal coins. A title or public treasury does not add to personal funds; reconsider explicitly.");
  }
  return null;
}
