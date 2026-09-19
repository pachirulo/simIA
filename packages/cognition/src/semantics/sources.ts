/** Per-call provenance, derived only from supplied inputs. This is not a second
 * memory store or a truth score: an observed utterance still contains a claim. */
export interface SourceAssertion {
  assertion: string;
  source: { ref: string; kind: "event" | "observation" | "speech" | "interpretation" | "letter" | "intention" | "unknown"; eventId: number | null; eventKind: string | null };
  speaker: string | null;
  recordedAt: number | null;
  certainty: "observed" | "reported" | "interpreted" | "intended" | "attempted" | "unknown";
  condition: { text: string; status: "unverified" } | null;
}

export interface SourceInput { ref: string; text: string }
const labels = {
  "recorded observation; quoted claims remain claims": ["observation", "observed"],
  "reported speech, not verified experience": ["speech", "reported"],
  "personal interpretation, not verified experience": ["interpretation", "interpreted"],
  "letter, not verified experience": ["letter", "reported"],
  "intention, not completed work": ["intention", "intended"],
} as const;
const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function conditionOf(text: string): SourceAssertion["condition"] {
  const match = /\b(?:when|if|until|unless|provided that)\b[^.!?;]*/iu.exec(text);
  return match ? { text: match[0], status: "unverified" } : null;
}

/** Source labels come from memoryForMind/event renderers in the unchanged engine.
 * Unknown formats retain their text and unknown provenance. Only explicit named
 * transcript lines identify speakers; a name mentioned inside a claim does not. */
export function sourceAssertions(inputs: readonly SourceInput[], speakers: readonly string[] = []): SourceAssertion[] {
  const names = [...new Set(speakers)].filter(Boolean).sort((a, b) => b.length - a.length);
  return inputs.flatMap(input => {
    const event = /^\[event (\d+), minute (\d+), ([\w.]+)\]\s*(.*)$/su.exec(input.text);
    const memory = /^\[minute (\d+); ([^\]]+)\]\s*(.*)$/su.exec(input.text);
    const label = memory ? labels[memory[2] as keyof typeof labels] : undefined;
    const assertion = event?.[4] ?? memory?.[3] ?? input.text;
    const base: SourceAssertion = {
      assertion,
      source: { ref: input.ref, kind: event ? "event" : label?.[0] ?? "unknown", eventId: event ? Number(event[1]) : null, eventKind: event?.[3] ?? null },
      speaker: null, recordedAt: event ? Number(event[2]) : memory ? Number(memory[1]) : null,
      certainty: event ? event[3] === "action.rejected" ? "attempted" : "observed" : label?.[1] ?? "unknown",
      condition: conditionOf(assertion),
    };
    // A transcript records speech, even when carried by an event/observation.
    if (base.certainty === "observed" && (/["“”«»]/u.test(assertion) || event?.[3] === "conversation" || event?.[3] === "agent.say")) base.certainty = "reported";
    const quoted: SourceAssertion[] = [];
    if (names.length) {
      const transcript = new RegExp(`(?:^|[\\s:])(${names.map(escape).join("|")}): “([^“”]*)”`, "gu");
      for (const match of assertion.matchAll(transcript)) quoted.push({
        ...base, assertion: match[2]!, speaker: match[1]!,
        source: { ...base.source, ref: `${input.ref}#utterance${quoted.length}` },
        condition: conditionOf(match[2]!),
      });
    }
    // Keep the complete input too: unknown speakers, unquoted fragments and
    // nested quotations must never silently disappear during extraction.
    return [base, ...quoted];
  });
}
