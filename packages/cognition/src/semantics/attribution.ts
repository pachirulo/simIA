import { fold, overlap } from "./evidence.ts";
import type { SourceAssertion } from "./sources.ts";
import type { SemanticIssue } from "./quality.ts";

/** Compare explicit recollections with selected transcripts only. Missing speech
 * is unknown; interpretations, letters and other memories are not witnesses. */
export function attributionIssue(text: string, path: string, assertions: readonly SourceAssertion[], selfNames: readonly string[]): SemanticIssue | null {
  const lines = assertions.filter(a => a.speaker && a.certainty === "reported"
    && ["event", "observation", "speech"].includes(a.source.kind) && !a.assertion.trim().endsWith("?"));
  const names = [...new Set(lines.map(a => a.speaker!))];
  const resolveName = (value: string): string | undefined => {
    const name = fold(value).trim();
    const found = names.filter(n => fold(n) === name || fold(n).split(" ")[0] === name);
    return found.length === 1 ? found[0] : undefined;
  };
  let antecedent: string | undefined;
  for (const clause of text.split(/[.;!?]|\band\s+(?=(?:he|she|I)\s+(?:said|told|mentioned)\b)/u)) {
    const s = fold(clause);
    // A single explicitly named interlocutor, within this same recollection.
    const spoke = s.match(/^\s*i spoke with (.+?)(?: at | about |$)/u);
    if (spoke) antecedent = resolveName(spoke[1]!);
    const match = s.match(/^\s*(.+?)\s+(?:said|told|mentioned|quoted|confirmed)\s+(.+)$/u);
    if (!match) continue;
    const actor = /^(?:i)$/u.test(match[1]!) ? selfNames.map(resolveName).find(Boolean)
      : /^(?:he|she)$/u.test(match[1]!) ? antecedent : resolveName(match[1]!);
    if (!actor) continue;
    const ranked = lines.map(line => ({ line, score: overlap(match[2]!, line.assertion) })).sort((a, b) => b.score - a.score);
    const best = ranked[0], own = ranked.find(row => row.line.speaker === actor);
    if (best && best.score >= 3 && best.line.speaker !== actor && best.score > (own?.score ?? 0) + 1)
      return { code: "memory_misattribution", path,
        message: `The matching supplied statement is from ${best.line.speaker}, not ${actor}. Preserve its speaker and uncertainty; another character's interpretation is not independent confirmation.` };
  }
  return null;
}
