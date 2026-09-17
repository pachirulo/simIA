import type { CallKind } from "../model/router.ts";

/** Prose fields long enough to spill over their caps, by call kind: trimmed at a sentence before zod sees them. `voice[]` means every element. */
export const PROSE_CAPS: Partial<Record<CallKind, Record<string, number>>> = {
  paper: { "lead.body": 2600 },
  life: { text: 4400 },
  reflection: { summary: 1500 },
  digest: { text: 1400 },
  persona_depth: { habit: 240, skill: 120, flaw: 240, cameBecause: 200, "voice[]": 240 }, // the protocol's caps for PersonaDepth
};
/** Cuts a paragraph at the last sentence end that fits the cap; failing that at a word; failing that at the cap itself. */
export function trimProse(s: string, cap: number): string {
  if (s.length <= cap) return s;
  const head = s.slice(0, cap);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "), head.lastIndexOf(".\n"), head.endsWith(".") || head.endsWith("?") || head.endsWith("!") ? cap - 1 : -1);
  if (sentence >= cap / 2) return head.slice(0, sentence + 1).trimEnd();
  const word = head.lastIndexOf(" ");
  return (word >= cap / 2 ? head.slice(0, word) : head).trimEnd();
}
/** Applies PROSE_CAPS to a raw answer in place, before the schema rejects a paragraph that ran long. */
export function truncateProse(kind: CallKind, raw: unknown): unknown {
  const caps = PROSE_CAPS[kind]; if (!caps || !raw || typeof raw !== "object") return raw;
  for (const [path, cap] of Object.entries(caps)) {
    const keys = path.split("."); let node: unknown = raw;
    for (let i = 0; i < keys.length - 1; i++) { node = node && typeof node === "object" ? (node as Record<string, unknown>)[keys[i]!] : undefined; }
    if (!node || typeof node !== "object") continue;
    const last = keys[keys.length - 1]!; const o = node as Record<string, unknown>;
    if (last.endsWith("[]")) { const arr = o[last.slice(0, -2)]; if (Array.isArray(arr)) for (let i = 0; i < arr.length; i++) if (typeof arr[i] === "string") arr[i] = trimProse(arr[i] as string, cap); }
    else if (typeof o[last] === "string") o[last] = trimProse(o[last] as string, cap);
  }
  return raw;
}
/** The user turn that asks for the same answer inside the limits, naming the path and the cap the model overran. */
export function repairNote(issue: { path: PropertyKey[]; message: string; code?: string; maximum?: unknown; origin?: string }, raw: unknown): string {
  const path = issue.path.map(String).join(".") || "the answer";
  let node: unknown = raw; for (const k of issue.path) node = node && typeof node === "object" ? (node as Record<string, unknown>)[String(k)] : undefined;
  if (issue.code === "too_big" && typeof issue.maximum === "number") {
    const unit = issue.origin === "array" ? "items" : "characters"; const size = typeof node === "string" ? node.length : Array.isArray(node) ? node.length : typeof node === "number" ? node : null;
    return `Your answer did not fit: ${path} was ${size === null ? "over the limit" : `${size.toLocaleString("en-US")} ${unit}`}; the limit is ${issue.maximum.toLocaleString("en-US")}. Return the same answer within the limits, as JSON only.`;
  }
  return `Your answer did not fit the schema: ${path}: ${issue.message}. Return the same answer corrected to fit, as JSON only.`;
}
/** A fallback answer wears a mark ops can see without the shape changing: the flag is not enumerable, so it never reaches the record. */
export function markFallback<T extends object>(x: T): T { Object.defineProperty(x, "fromFallback", { value: true, enumerable: false, configurable: true }); return x; }
export const isFromFallback = (x: unknown): boolean => !!x && typeof x === "object" && (x as { fromFallback?: boolean }).fromFallback === true;

