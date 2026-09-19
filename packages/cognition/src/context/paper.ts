import type { PaperContext } from "@unwatched/engine";

// PaperContext has no event kind. Recognize only the engine's private-event
// envelopes, before any quoted speech; never search inside a public quotation.
const privateRecord = /^[^:;\n“”"«»]{1,120} (?:would now say of themself:|now wants |now fears |with strangers is now |takes advice |reflected:|set out to |wrote to [^:]+:|now thinks of )/u;

/** Defensive boundary for older/incomplete upstream filtering. Apply to fallback
 * too. Explicit publications in writings retain their public status. */
export function publicPaperContext(ctx: PaperContext): PaperContext {
  return { ...ctx, events: ctx.events.filter(event => !privateRecord.test(event.text)) };
}

export function paperRecords(events: PaperContext["events"]): string {
  const reported = (event: PaperContext["events"][number]) => / talked at | said(?: to |:)| told | rumor/iu.test(event.text)
    || event.actors.some(actor => event.text.startsWith(`${actor}: “`) || event.text.startsWith(`${actor}: "`)
      || (event.text.startsWith(`${actor} to `) && /: [“"]/.test(event.text)));
  const facts = events.filter(event => !reported(event));
  const speech = events.filter(reported);
  const lines = (rows: PaperContext["events"]) => rows.map(e => `- [${e.importance.toFixed(2)}] ${e.text}`).join("\n");
  return `Recorded public events, most important first:\n${lines(facts) || "(none)"}`
    + (speech.length ? `\nReported speech; attribute every claim, including in headlines/lead. It establishes neither ownership nor completed work:\n${lines(speech)}` : "");
}
