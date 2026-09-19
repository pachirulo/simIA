import type { Dialogue } from "@unwatched/protocol";
import type { ConverseContext } from "@unwatched/engine";
import { fold, overlap, groundedClaimIssue, observedRecords, conditionIssue } from "./evidence.ts";
import { outputQualityIssue, type SemanticIssue } from "./quality.ts";
import { dialogueHistoryIssue } from "./dialogue-history.ts";

function side(speaker: string, ctx: ConverseContext): "a" | "b" | null {
  const s = fold(speaker);
  for (const key of ["a", "b"] as const) {
    const person = ctx[key];
    if ([key, person.id, person.persona.name, person.persona.name.split(" ")[0]!].map(fold).includes(s)) return key;
  }
  return null;
}

/** A/B refer to the supplied context, not line order. Return IDs so the unchanged
 * engine never has to guess an unresolved alias by alternating participants. */
export function canonicalDialogue(out: Dialogue, ctx: ConverseContext): Dialogue {
  // Preserve non-enumerable fallback metadata without mutating the model response.
  const canonical = Object.defineProperties({}, Object.getOwnPropertyDescriptors(out)) as Dialogue;
  canonical.lines = out.lines.map(line => { const key = side(line.speaker, ctx); return { ...line, speaker: key ? ctx[key].id : line.speaker }; });
  return canonical;
}

/** The engine's rumor field is directional: A tells B. The original speaker in
 * lines must remain the source, even when the other participant repeats it. */
export function dialogueIssue(out: Dialogue, ctx: ConverseContext): SemanticIssue | null {
  const quality = outputQualityIssue(out); if (quality) return quality;
  const lines = out.lines.map(line => ({ ...line, side: side(line.speaker, ctx) }));
  const unknown = lines.findIndex(line => !line.side);
  if (unknown >= 0) return { code: "dialogue_unknown_speaker", path: `lines[${unknown}].speaker`, message: "Only A and B speak. Use their supplied ID/name or A/B; absent people are claims, never additional speakers." };
  const history = dialogueHistoryIssue(out, ctx, lines.map(line => line.side)); if (history) return history;
  for (const key of ["a", "b"] as const) {
    const path = `outcome.${key}_remember`, memory = out.outcome[`${key}_remember`];
    if (memory.trim() && !/[\p{L}\p{N}]/u.test(memory)) return { code: "dialogue_empty_memory", path, message: "A punctuation placeholder is not a memory. Write a grounded personal recollection or an empty string when there is nothing to keep." };
    const partner = key === "a" ? "b" : "a";
    const names = [ctx[partner].persona.name, ctx[partner].persona.name.split(" ")[0]!];
    const normalized = fold(memory);
    // Preserve direction in a bounded family-search construction. Lexical
    // overlap alone cannot distinguish who is looking for whom.
    for (const person of [ctx.a, ctx.b]) {
      const escaped = person.persona.name.split(" ")[0]!.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const reversed = new RegExp(`\\b${fold(escaped)} (?:said|mentioned|told me) (?:that )?(?:his|her) (brother|sister|son|daughter) (?:is|was) looking for (?:him|her)\\b`, "u").exec(normalized);
      if (!reversed) continue;
      const own = lines.filter(line => line.side && ctx[line.side].id === person.id).map(line => fold(line.text));
      const relative = reversed[1]!;
      const seeksRelative = own.some(text => text.includes(`looking for my ${relative}`)
        || text.includes(`see my ${relative}`) && /tell (?:him|her) i'm looking for (?:him|her)/u.test(text));
      const reverseSupported = own.some(text => new RegExp(`my ${relative} (?:is|was) looking for me`, "u").test(text));
      if (seeksRelative && !reverseSupported) return { code: "dialogue_relation_reversed", path,
        message: "The supplied speaker is looking for their relative; the memory reverses that direction. Preserve who is seeking whom and keep it attributed speech." };
    }
    const attribution = /\b(?:said|told|quoted|claims?|mentioned|confirmed)\b/u.exec(normalized);
    if (attribution && !/\b(?:i)\s*$/u.test(normalized.slice(0, attribution.index)) && names.some(name => normalized.slice(0, attribution.index).includes(fold(name)))) {
      const claim = memory.slice(attribution.index + attribution[0].length).split(/[.;]/u)[0]!;
      const ranked = lines.filter(line => !line.text.trim().endsWith("?")).map((line, index) => ({ ...line, index, score: overlap(claim, line.text) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const best = ranked[0], theirs = ranked.find(line => line.side === partner);
      const acknowledgedPlan = /\bwill\b|'ll\b|\b(?:going to)\b/u.test(fold(claim))
        && lines.some(line => line.side === partner && /\b(?:deal|fair|then|agreed)\b/u.test(fold(line.text)));
      if (!acknowledgedPlan && best && best.score >= 2 && best.side !== partner && (!theirs || best.score > theirs.score)) return {
        code: "dialogue_misattribution", path,
        message: `The matching claim was introduced by ${ctx[best.side!].persona.name}, not ${ctx[partner].persona.name}. Preserve the original speaker and rumor status; repetition is not independent confirmation.`,
      };
    }
    const records = observedRecords(key === "a" ? ctx.aMemories : ctx.bMemories);
    const condition = conditionIssue(memory, path, lines.map(line => line.text)); if (condition) return condition;
    const invalid = groundedClaimIssue(memory, path, { records, selfNames: [ctx[key].persona.name], debts: (ctx[key].debts ?? []).map(d => ({ to: d.to === ctx[partner].id ? ctx[partner].persona.name : d.to, coins: d.coins })) });
    if (invalid) return invalid;
  }
  if (out.outcome.rumor) {
    const ranked = lines.filter(line => !line.text.trim().endsWith("?")).map((line, index) => ({ ...line, index, score: overlap(out.outcome.rumor!, line.text) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (!ranked[0] || ranked[0].score < 2 || ranked[0].side !== "a") return { code: "rumor_direction", path: "outcome.rumor",
      message: "rumor is stored as A telling B. If B introduced this rumor, keep it attributed to B in the conversation memories and set rumor:null. Do not turn B's own claim into outside confirmation from A." };
  }
  return null;
}

/** Safe synthetic fallback from the actual generated lines, not invented facts. */
export function safeDialogueFallback(out: Dialogue, ctx: ConverseContext): Dialogue {
  if (!dialogueIssue(out, ctx)) return out;
  const valid = out.lines.filter(line => side(line.speaker, ctx));
  return { lines: valid.length ? valid : [{ speaker: ctx.a.id, text: "..." }],
    outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "", b_remember: "", rumor: null } };
}
