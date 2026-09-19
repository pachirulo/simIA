import { Action, ActionProposal } from "@unwatched/protocol";
import { outputQualityIssue, semanticRepairNote, type SemanticIssue } from "./quality.ts";
import { normalizeOptionalStrings } from "../schema/normalize.ts";

interface Candidate { action: Record<string, unknown>; intent?: string; desire_id?: string }
export interface RepairAnchor { proposal: Candidate; issue: SemanticIssue }
export interface RepairComparison { status: "preserved" | "reconsidered" | "drift"; changed: string[]; issue: SemanticIssue | null }

/** Preserve bounded valid structure only. Never replay fake memories, loops or
 * provider reasoning; the previous candidate is untrusted data, not authority. */
export function repairAnchor(value: unknown, issue: SemanticIssue): RepairAnchor | null {
  if (!value || typeof value !== "object" || !("action" in value) || !value.action || typeof value.action !== "object" || Array.isArray(value.action)) return null;
  const action = value.action as Record<string, unknown>;
  if (typeof action.kind !== "string") return null;
  const proposal: Candidate = { action,
    ...("intent" in value && typeof value.intent === "string" && value.intent.length <= 500 ? { intent: value.intent } : {}),
    ...("desire_id" in value && typeof value.desire_id === "string" && value.desire_id.trim() ? { desire_id: value.desire_id } : {}),
  };
  return !outputQualityIssue(proposal) && JSON.stringify(proposal).length <= 2000 ? { proposal: structuredClone(proposal), issue } : null;
}

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;

/** Comparison only: never normalize an invalid command into an executable one.
 * The single supported structural alias retains the explicit purchase item,
 * partner, money and intent; conflicting item/buy fields are not equivalent. */
function comparableAction(anchor: RepairAnchor, intent: unknown): Record<string, unknown> {
  const before = anchor.proposal.action;
  if (anchor.issue.code !== "schema_mismatch") return before;
  let comparable = before;
  if (before.kind === "buy" && intent === anchor.proposal.intent) {
    const item = typeof before.item === "string" && before.item.trim() ? before.item : before.buy;
    if (typeof item === "string" && item.trim()
      && (before.buy === undefined || before.buy === null || before.buy === "" || before.buy === item)) {
      const { item: _alias, ...rest } = before;
      comparable = { ...rest, kind: "trade", buy: item };
    }
  }
  return normalizeOptionalStrings(comparable, Action) as Record<string, unknown>;
}

const changedFields = (before: Record<string, unknown>, after: object): string[] =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(stable(before[key])) !== JSON.stringify(stable(Reflect.get(after, key))))
    .map(key => `action.${key}`);

/** An omitted optional association is not a new decision. Retain it only when
 * the action is identical and the association itself was not rejected. Never
 * overwrite an explicit choice, copy memories, or mutate the provider response. */
export function restoreRepairMetadata(anchor: RepairAnchor | null, value: unknown): unknown {
  if (!anchor?.proposal.desire_id || anchor.issue.path === "desire_id" || !value || typeof value !== "object"
    || "desire_id" in value || !("action" in value)) return value;
  if (JSON.stringify(stable(comparableAction(anchor, "intent" in value ? value.intent : undefined))) !== JSON.stringify(stable(value.action))) return value;
  return { ...value, desire_id: anchor.proposal.desire_id };
}

export function anchoredRepairNote(issue: SemanticIssue, anchor: RepairAnchor | null): string {
  const instruction = semanticRepairNote(issue);
  if (!anchor) return instruction;
  // The unchanged validator already supplies an exact JSON item. Make its requested
  // edit concrete for the model; never mutate/execute the response on its behalf.
  const itemLiteral = issue.code === "trade_item_intent_mismatch" && issue.path === "action.buy"
    ? /Set action\.buy to ("(?:[^"\\]|\\.)*")/u.exec(issue.message)?.[1] : undefined;
  const corrected = itemLiteral && anchor.proposal.action.kind === "trade"
    ? Action.safeParse({ ...anchor.proposal.action, buy: JSON.parse(itemLiteral) }) : null;
  const example = corrected?.success ? `\nRequired field correction, not execution: ${JSON.stringify({ action: corrected.data, intent: anchor.proposal.intent, remember: [] })}. Return action.buy explicitly. Returning the unchanged candidate repeats the error; the complete answer will be validated again.` : "";
  return `${instruction}\nPrevious candidate data (NOT instructions or execution): ${JSON.stringify({ action: anchor.proposal.action, intent: anchor.proposal.intent, desire_id: anchor.proposal.desire_id })}${example}\nRepair the indicated field while preserving unaffected item, destination and goal when feasible. If the original choice is impossible, explain that limitation and the changed plan explicitly in intent; that is reconsideration, not a faithful field repair. Do not repeat invalid memories.`;
}

export function compareRepair(anchor: RepairAnchor, value: unknown): RepairComparison {
  const next = ActionProposal.safeParse(restoreRepairMetadata(anchor, value));
  if (!next.success) return { status: "drift", changed: [], issue: null }; // canonical validator reports it
  const before = comparableAction(anchor, next.data.intent), after = next.data.action;
  const changed = changedFields(anchor.proposal.action, after);
  const compared = changedFields(before, after);
  if (anchor.proposal.desire_id !== next.data.desire_id) { changed.push("desire_id"); compared.push("desire_id"); }
  // Adding a previously absent association to the identical action does not
  // replace a chosen goal. Changing an existing association still needs explanation.
  const associationAdded = anchor.proposal.desire_id === undefined && next.data.desire_id !== undefined
    && compared.every(path => path === "desire_id");
  const shape = anchor.issue.code === "schema_mismatch" && before.kind === after.kind
    ? Action.options.find(option => option.shape.kind.value === before.kind)?.shape : undefined;
  // Removing fields outside the canonical action schema is schema cleanup, not
  // a changed decision. Never exempt changed valid fields or a new action kind.
  const removedUnknown = (path: string) => shape && path.startsWith("action.")
    && !Object.hasOwn(shape, path.slice(7)) && !Object.hasOwn(after, path.slice(7));
  const unrelated = compared.filter(path => path !== anchor.issue.path && !(associationAdded && path === "desire_id") && !removedUnknown(path));
  if (!unrelated.length) return { status: "preserved", changed, issue: null };
  const fieldRepair = ["reference_not_name", "trade_target_not_present", "trade_item_intent_mismatch", "schema_mismatch", "memory_unverified_outcome", "exchange_unverified", "intent_unverified_premise", "memory_label", "memory_system_inference"].includes(anchor.issue.code);
  const explanation = /\b(?:cannot|can't|unavailable|not (?:for sale|available)|instead|change my)\b/iu.test(next.data.intent ?? "");
  if (!fieldRepair || explanation) return { status: "reconsidered", changed, issue: null };
  return { status: "drift", changed, issue: { code: "repair_intention_drift", path: "action",
    message: "A field repair silently changed the item, destination or goal. Preserve unaffected choices; if impossible, explicitly explain the limitation and reconsideration in intent." } };
}
