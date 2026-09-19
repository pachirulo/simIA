import type { Perception } from "@unwatched/protocol";
import { sourceAssertions, type SourceAssertion } from "./sources.ts";
import type { SemanticIssue } from "./quality.ts";

export const BIOGRAPHY_BOUNDARY = "Biography, former offices and political ambitions describe personal history and motivation, not a verified current island office. Preserve them as history or aspirations. A second term may be a wish; do not describe yourself as the incumbent without supplied institutional evidence.";

/** Null is unknown, not evidence of exclusion. Only institutional observations
 * or explicit perception state establish the office; gossip cannot elect anyone. */
export function observedMayor(assertions: readonly SourceAssertion[], selfNames: string[]): boolean | null {
  const records = assertions.filter(a => a.certainty === "observed").sort((a, b) => (b.recordedAt ?? -1) - (a.recordedAt ?? -1));
  for (const record of records) {
    if (record.source.kind === "observation" && /^The council made me mayor\./u.test(record.assertion)) return true;
    if (record.source.eventKind !== "town.mayor") continue;
    const name = /^The council chose (.+) as mayor:/u.exec(record.assertion)?.[1];
    if (name) return selfNames.includes(name);
  }
  return null;
}

export function perceivedMayor(p: Perception, selfName?: string): boolean | null {
  if (p.self.mayor !== undefined) return p.self.mayor;
  if (p.place.council) return p.place.council.mayor !== null && p.place.council.mayor === selfName;
  return observedMayor(sourceAssertions(p.recent.map((text, i) => ({ ref: `recent[${i}]`, text }))), selfName ? [selfName] : []);
}

export function institutionIssue(text: string, path: string, mayor: boolean | null): SemanticIssue | null {
  if (mayor === true) return null;
  for (const clause of text.split(/[.!?;]/u)) {
    if (/\b(?:former|previous|used to|was|want|hope|wish|might|could|if|said|told|not|never)\b|["“”]/iu.test(clause)) continue;
    if (/\bI(?: am|['’]m) (?:the |a |current |careful )*mayor\b|\bas (?:the |current )*mayor,? I\b|\bmy current (?:office|term) as mayor\b/iu.test(clause)) return {
      code: "institutional_role_unverified", path,
      message: `${mayor === false ? "The supplied current state does not identify you as mayor." : "No supplied institutional observation establishes that you currently hold the mayor's office."} Keep former service and ambitions, but distinguish them from verified incumbency.`,
    };
  }
  return null;
}

export const roleNote = (mayor: boolean | null): string => `Supplied evidence of your mayoral office=${mayor === null ? "unknown" : mayor ? "yes" : "no"}. ${BIOGRAPHY_BOUNDARY}`;
