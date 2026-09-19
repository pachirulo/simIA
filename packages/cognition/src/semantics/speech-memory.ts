import { sourceAssertions } from "./sources.ts";
import type { SemanticIssue } from "./quality.ts";

/** A say proposal may fail after cognition returns. Only prior selected records
 * can support remembering the utterance; its quoted content remains a claim. */
export function speechMemoryIssue(text: string, path: string, recent: string[]): SemanticIssue | null {
  const own = /^(?:I )?(?:said|told|greeted)\b/iu.test(text.trim());
  if (!own) return null;
  const records = sourceAssertions(recent.map((text, i) => ({ ref: `recent[${i}]`, text })))
    .filter(a => a.source.kind === "observation" && /^I said(?: to [^:]+)?: "/u.test(a.assertion));
  const quote = /["“]([^"”]+)["”]/u.exec(text)?.[1];
  const recipient = /^(?:I )?said to ([^:]+):/iu.exec(text.trim())?.[1];
  const greeting = /^(?:I )?(?:said hello to|greeted) ([\p{L} ]+?)(?: at | on |[.!]|$)/iu.exec(text.trim())?.[1];
  const supported = records.some(record => {
    if (quote) return record.assertion.includes(`"${quote}"`) && (!recipient || record.assertion.startsWith(`I said to ${recipient}:`));
    if (!greeting) return false;
    return record.assertion.startsWith(`I said to ${greeting}:`) && /"(?:hello|hi|good morning|good evening)\b/iu.test(record.assertion);
  });
  return supported ? null : { code: "memory_unexecuted_speech", path,
    message: "No matching prior selected utterance supports this memory. The proposed say has not executed and may fail. Keep a future intention or omit this optional memory; only a later observed utterance establishes what you said." };
}
