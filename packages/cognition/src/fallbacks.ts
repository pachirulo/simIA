import type { ActionProposal, Reflection } from "@unwatched/protocol";

/** A missed model turn must not use the fictional scenarios of the mock brain.
 * No inferred events, synthetic rumors, pre-execution memories or new goals. */
export function conservativeDecisionFallback(): ActionProposal {
  return { action: { kind: "wait" }, remember: [] };
}

/** Preserve existing identity, projects and opinions by omitting their updates.
 * In particular, low trust does not prove that somebody spread gossip. */
export function conservativeReflectionFallback(): Reflection {
  return { summary: "I do not have enough evidence to claim new outcomes.",
    insights: [], opinions: [], intentions: [], letter_to_owner: null };
}
