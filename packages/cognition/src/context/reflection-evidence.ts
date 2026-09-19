import type { ReflectContext } from "@unwatched/engine";
import { sourceAssertions, type SourceAssertion } from "../semantics/sources.ts";
import { physicalEvidence, type ClaimContext } from "../semantics/evidence.ts";
import { commitmentTraces, type CommitmentTrace } from "../semantics/commitments.ts";

/** Retrieve one existing personal role report, preserving rumor provenance. */
export function roleContinuitySources(ctx: ReflectContext): string[] {
  return (ctx.agent.memory ?? []).filter(m => m.t <= ctx.day * 1440 && ["obs", "rumor"].includes(m.kind)
    && /^(?:.+ is mayor now\.|The council (?:chose|kept) .+ as mayor[:.]|.+ is gone; the island has no mayor)/u.test(m.text))
    .sort((a,b) => b.t - a.t).slice(0, 1).map(m => `[minute ${m.t}; ${m.kind === "rumor" ? "reported speech, not verified experience" : "recorded observation; quoted claims remain claims"}] ${m.text}`);
}

/** One source frame for both the prompt and validator, rebuilt on every call.
 * Only the narrow personal role report above supplements engine-selected lists. */
export function reflectionEvidence(ctx: ReflectContext): { assertions: SourceAssertion[]; claims: ClaimContext; commitments: CommitmentTrace[] } {
  const selfNames = [ctx.agent.persona.name, ctx.agent.persona.name.split(" ")[0]!];
  const speakers = [ctx.agent.persona.name, ...ctx.relationships.map(r => r.name)];
  const assertions = sourceAssertions([
    ...roleContinuitySources(ctx).map((text, i) => ({ ref: `roleContinuity[${i}]`, text })),
    ...(ctx.actionEvidence ?? []).map((text, i) => ({ ref: `actionEvidence[${i}]`, text })),
    ...ctx.dayMemories.map((text, i) => ({ ref: `dayMemories[${i}]`, text })),
    ...ctx.keyMemories.map((text, i) => ({ ref: `keyMemories[${i}]`, text })),
    ...(ctx.desireEvidence ?? []).flatMap((e, i) => e.actors.includes(ctx.agent.id)
      ? [{ ref: `desireEvidence[${i}]`, text: `[event ${e.id}, minute ${e.t}, ${e.kind}] ${e.text}` }] : []),
  ], speakers);
  // Link display names to IDs only through selected observations or selected
  // move receipts. A possessive shop name never establishes its human owner.
  const places = [
    ...physicalEvidence(assertions).flatMap(r => {
      const match = /^Observed local state at (.+) \(([^()]+)\):/u.exec(r.text);
      return match ? [{ id: match[2]!, name: match[1]! }] : [];
    }),
    ...(ctx.desireEvidence ?? []).flatMap(e => {
      if (e.kind !== "agent.move" || !e.place || !e.actors.includes(ctx.agent.id)) return [];
      const match = / went to (.+?)(?:, on the way to .+)?\.$/u.exec(e.text);
      return match ? [{ id: e.place, name: match[1]! }] : [];
    }),
  ];
  return { assertions, commitments: commitmentTraces(assertions, speakers), claims: { records: physicalEvidence(assertions), selfNames, places,
    since: (ctx.day - 1) * 1440, until: ctx.day * 1440,
    lodging: ctx.agent.home ? { place: ctx.agent.home.place, nights: ctx.agent.home.nightsPaid } : null,
    debts: (ctx.agent.debts ?? []).map(d => ({ to: ctx.relationships.find(r => r.id === d.to)?.name ?? d.to, coins: d.coins })),
  } };
}

/** Annotate ambiguous inputs without repeating every physical receipt. Original
 * source text stays in the prompt. Recorded time is not the time a claim came true. */
export function reflectionSourceNotes(assertions: readonly SourceAssertion[]): string {
  return JSON.stringify(assertions.filter(a => a.certainty !== "observed" || a.condition).map(a => ({
    ref: a.source.ref, source: a.source.kind, speaker: a.speaker, recordedAt: a.recordedAt,
    certainty: a.certainty, condition: a.condition,
    ...(a.speaker === null ? {} : { claim: a.assertion }),
  })));
}
