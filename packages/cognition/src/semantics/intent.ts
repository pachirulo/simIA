import type { ActionProposal, Perception } from "@unwatched/protocol";
import { normalize, type SemanticIssue } from "./quality.ts";
import { groundedClaimIssue, observedRecords } from "./evidence.ts";
import { perceivedLodging } from "./lodging.ts";
import { denialIssue, encounters } from "./continuity-claims.ts";
import { sourceAssertions } from "./sources.ts";

/** Check asserted premises using the same selected observations as the prompt.
 * Identity only resolves first person; no private state or history is queried. */
export function intentPremiseIssue(out: ActionProposal, p: Perception, selfName?: string): SemanticIssue | null {
  if (!out.intent) return null;
  const evidence = {
    records: observedRecords(p.recent), selfNames: selfName ? [selfName] : [], debts: p.self.debts, ...perceivedLodging(p, out.intent),
    since: (p.time.day - 1) * 1440, until: (p.time.day - 1) * 1440 + p.time.minute,
  };
  const invalid = denialIssue(out.intent, "intent", evidence, encounters(sourceAssertions(p.recent.map((text,i)=>({ref:`recent[${i}]`,text})))))
    ?? groundedClaimIssue(out.intent, "intent", evidence);
  return invalid ? { code: "intent_unverified_premise", path: "intent",
    message: `${invalid.message} This is a premise of intent, not proof of the proposed action. Missing evidence means unknown, not false. Keep the feasible next action and goal; qualify or remove the unsupported premise, preserving any speaker/condition.` } : null;
}

type Operation = "buy" | "sell" | "use" | "move" | "say" | "apply";
const verbs: [Operation, string][] = [
  ["buy", "buy(?:ing)?|purchase"], ["sell", "sell(?:ing)?"],
  ["use", "eat|use|consume"],
  ["move", "go to|walk to|travel to|move to|moving to"],
  ["say", "say|tell|acknowledge|announce|explain"], ["apply", "apply for"],
];

/** Only explicit immediate choices/negations, not goals, wishes or arbitrary NLP.
 * Unknown wording remains unclassified. No food policy is encoded here. */
export function intentIssue(out: ActionProposal): SemanticIssue | null {
  if (!out.intent) return null;
  const text = normalize(out.intent);
  const actual: Operation | string = out.action.kind === "trade"
    ? out.action.buy ? "buy" : out.action.sell ? "sell" : "trade" : out.action.kind;
  const mismatch = (): SemanticIssue => ({ code: "intent_action_mismatch", path: "intent",
    message: "Your stated immediate choice contradicts action. Keep one coherent next operation: buying/selling does not eat. A later goal is allowed, but state the actual step now. If changing your mind, explain that explicitly." });
  for (const [operation, verb] of verbs) {
    const negated = new RegExp(`(?:\\b(?:not going to|will not|won't|instead of|rather than)\\s+)(?:${verb})(?=\\s|[.,;!?]|$)`, "u").test(text);
    if (negated && (actual === operation || actual === "trade" && operation === "buy")) return mismatch();
  }
  // A subordinate purpose ("to eat") or a future step is not the current operation.
  const clauses = text.split(/[.;!?]|\b(?:but|then)\b/u);
  for (const clause of clauses) {
    const commitment = /\b(?:i'll|i will)\s+(?:just\s+)?/u.exec(clause);
    if (commitment && /\b(?:no|not|said)\s*$/u.test(clause.slice(0, commitment.index))) continue;
    const initial = clause.trim().replace(/^(?:now\s+)?(?:i\s+)?(?:am going to\s+|am\s+|i choose to\s+)?/u, "");
    const classify = (text: string) => /^use (?:my |the )?(?:coins|money) to (?:buy|purchase)\b/u.test(text) ? "buy"
      : verbs.find(([, verb]) => new RegExp(`^(?:${verb})(?=\\s|[.,;!?]|$)`, "u").test(text))?.[0];
    const operation = classify(initial) ?? (commitment ? classify(clause.slice(commitment.index + commitment[0].length)) : undefined);
    if (!operation) continue;
    if (operation === "use" && actual === "buy" && /\b(?:tomorrow|later|after buying|after i buy)\b/u.test(clause)) return null;
    // A bare goal such as "Eat something cheap" can legitimately start with buying.
    // Reject the purchase only for an explicit immediate commitment/negation.
    if (operation === "use" && actual === "buy" && !/\b(?:i'll|i will|right now|directly)\b/u.test(clause)) return null;
    // The first explicit operation is the next step. Later steps never dispatch now.
    if (actual !== operation && !(actual === "trade" && (operation === "buy" || operation === "sell"))) return mismatch();
    if (out.action.kind === "trade" && operation === "buy" && !out.action.buy && out.action.sell) return mismatch();
    return null;
  }
  return null;
}
