import type { AgentState } from "@unwatched/engine";
import type { CallKind } from "../model/router.ts";

export interface SystemContext { shared: string; own?: string; cacheOwn?: boolean }
export interface CognitiveContext { system: SystemContext; user: string }

/** Keep the server's opaque, dynamic primer intact. Future structured sections can be
 * selected here by operation without changing Brain or guessing at prose headings. */
export function selectPrimer(_kind: CallKind, primer: string): string { return primer; }
export function withPrimer(kind: CallKind, system: SystemContext, primer: string): SystemContext {
  const selected = selectPrimer(kind, primer);
  return { ...system, shared: system.shared + (selected ? "\n\n" + selected : "") };
}

/** Preserve the five-minute cache policy; slow hosted cadence does not pay for persona writes. */
export function cachePersona(a: AgentState): boolean {
  return a.thinkEvery !== null && a.thinkEvery !== undefined && a.thinkEvery <= 5;
}
