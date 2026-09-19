import { fold, anchors, type ClaimContext } from "./evidence.ts";
import type { SourceAssertion } from "./sources.ts";
import type { SemanticIssue } from "./quality.ts";

export interface Encounter { names: string[]; time: number | null }
/** Conversation existence and speaker identity are observed; spoken contents are not. */
export function encounters(assertions: readonly SourceAssertion[]): Encounter[] {
  return assertions.flatMap(a => {
    if (!["event", "observation", "speech"].includes(a.source.kind) || a.source.ref.includes("#utterance")) return [];
    const header = /^(.+?) and (.+?) talked at /u.exec(a.assertion);
    const names = header ? [header[1]!, header[2]!] : /^Conversation at /u.test(a.assertion)
      ? [...a.assertion.matchAll(/(?:^|[”\s])([\p{L}][\p{L} '’.-]+): “/gu)].map(m => m[1]!.trim()) : [];
    return names.length >= 2 ? [{ names, time: a.recordedAt }] : [];
  });
}
const sameName = (full: string, reference: string) => fold(full) === fold(reference) || fold(full).split(" ")[0] === fold(reference);

/** Only positive records contradict a denial. Lack of a receipt never does.
 * Purpose, formal acquaintance and time qualifiers are not erased to force a match. */
export function denialIssue(text: string, path: string, ctx: ClaimContext, meetings: Encounter[] = []): SemanticIssue | null {
  for (const clause of text.split(/[.;!?]|\bbut\b/iu)) {
    const s = fold(clause).trim();
    const match = /^(?:i )?(?:did not|didn't|have not|haven't|never) (?:go to|gone to|been to|get to|visit|visited|work|worked|meet|met)\b/u.exec(s);
    if (!match || /\b(?:said|told|if|maybe|for work|to (?:ask|offer|buy|work)|formally|properly)\b/u.test(s)) continue;
    const tail = s.slice(match[0].length).trim();
    const morning = /\b(?:in the morning|this morning)\b/u.test(tail);
    if (/\b(?:yesterday|last night|before|after|evening|afternoon)\b/u.test(tail)) continue;
    const inScope = (t: number | null | undefined) => t !== null && t !== undefined
      && (ctx.since === undefined || t >= ctx.since) && (ctx.until === undefined || t <= ctx.until)
      && (!morning || t % 1440 >= 360 && t % 1440 < 720);
    const target = tail.replace(/\b(?:today|yet|in the morning|this morning)\b/gu, "").replace(/[ ,]+$/u, "").replace(/^the /u, "").trim();
    const isWork = /\bwork(?:ed)?$/u.test(match[0]), isMeet = /\b(?:meet|met)$/u.test(match[0]);
    const tokens = anchors(target);
    const supported = isMeet ? meetings.some(m => inScope(m.time) && m.names.some(n => ctx.selfNames.some(self => sameName(n, self))) && m.names.some(n => sameName(n, target)))
      : ctx.records.some(r => inScope(r.time) && r.source !== "speech" && r.kind === (isWork ? "agent.work" : "agent.move")
        && ctx.selfNames.some(name => fold(r.text).startsWith(fold(name) + " "))
        && tokens.every(t => anchors(r.text.split(/,\s*on the way to\b/iu)[0]!).includes(t)));
    if (supported) return { code: "memory_contradicted_denial", path,
      message: `The denial ${JSON.stringify(clause.trim())} conflicts with a supplied positive ${isMeet ? "conversation" : isWork ? "work" : "arrival at destination"} record in that time range. Distinguish an uncompleted purpose from denying the observed event.` };
  }
  return null;
}

/** A remembered role keeps its original provenance, including unverified reports. */
export function knownMayor(assertions: readonly SourceAssertion[]): { name: string; certainty: string } | null {
  for (const a of [...assertions].sort((a,b) => (b.recordedAt ?? -1) - (a.recordedAt ?? -1))) {
    if (!["event", "observation", "speech"].includes(a.source.kind)) continue;
    if (/is gone; the island has no mayor/u.test(a.assertion)) return null;
    const name = /^(.+) is mayor now\.$/u.exec(a.assertion)?.[1]
      ?? /^The council (?:chose|kept) (.+?) as mayor[:.]/u.exec(a.assertion)?.[1];
    if (name) return { name, certainty: a.certainty };
  }
  return null;
}

export function roleIdentityIssue(text: string, path: string, assertions: readonly SourceAssertion[], meetings: Encounter[]): SemanticIssue | null {
  const mayor = knownMayor(assertions); if (!mayor) return null;
  const s = fold(text), name = fold(mayor.name), first = name.split(" ")[0]!;
  const deniedMeeting = /\b(?:did not|didn't|have not|haven't|never) (?:meet|met) the mayor\b/u.test(s);
  const askIncumbent = (s.includes(`ask ${name}`) || s.includes(`ask ${first}`)) && /\b(?:meeting|meet|find) the mayor\b/u.test(s);
  if ((askIncumbent || deniedMeeting && meetings.some(m => m.names.some(n => sameName(n, mayor.name))))
    && !/\b(?:formally|officially|as mayor|in (?:an? )?official capacity)\b/u.test(s)) return {
    code: "known_role_identity_lost", path,
    message: `${mayor.name} is the person identified as mayor in your supplied ${mayor.certainty} source. Preserve that person-role association and any uncertainty about the office; do not turn a known conversational partner into a separate unknown person.`,
  };
  return null;
}
