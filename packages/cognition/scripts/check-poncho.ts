/** Offline only: no provider requests, no world mutation and no fallback-rate claim.
 * Run: pnpm --filter @unwatched/cognition exec tsx scripts/check-poncho.ts [before-src]
 * Optional before-src is the source snapshot retained by the Poncho audit. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ActionProposal } from "@unwatched/protocol";
import { poncho, ponchoPerception, ponchoReflection } from "../test/fixtures/poncho.ts";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { normalizeReflection, reflectionSchema } from "../src/schema/reflection.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";

const before = process.argv[2];
const baseline = before ? {
  schema: await import(pathToFileURL(resolve(before, "schema/reflection.ts")).href),
  decision: await import(pathToFileURL(resolve(before, "semantics/decision.ts")).href),
  lifecycle: await import(pathToFileURL(resolve(before, "semantics/lifecycle.ts")).href),
  evidence: await import(pathToFileURL(resolve(before, "semantics/evidence.ts")).href),
} : null;
const rows = poncho.cases.map(row => {
  function check(old: boolean) {
    if (row.kind === "action_proposal") {
      const parsed = ActionProposal.safeParse(normalizeOptionalStrings(row.output, ActionProposal));
      return { schema: parsed.success ? [] : parsed.error.issues,
        semantic: parsed.success ? (old ? baseline!.decision.decisionIssue : decisionIssue)(parsed.data, ponchoPerception(row.id), row.name) : null };
    }
    const ctx = ponchoReflection(row.agentId as keyof typeof poncho.contexts);
    const schema = old ? baseline!.schema.reflectionSchema(ctx) : reflectionSchema(ctx);
    const raw = normalizeOptionalStrings(row.output, schema);
    const parsed = schema.safeParse(old ? raw : normalizeReflection(raw));
    return { schema: parsed.success ? [] : parsed.error.issues,
      semantic: parsed.success ? (old ? baseline!.lifecycle.reflectionIssue : reflectionIssue)(parsed.data, ctx) : null,
      // Component check is deliberately independent of whole-answer acceptance.
      summary: (old ? baseline!.evidence.groundedClaimIssue : groundedClaimIssue)(Reflect.get(row.output, "summary"), "summary", reflectionEvidence(ctx).claims),
    };
  }
  return { id: row.id, kind: row.kind, attempt: row.attempt, agentId: row.agentId,
    ...(baseline ? { before: check(true) } : {}), after: check(false) };
});
console.log(JSON.stringify({ mode: "offline fixed original outputs; not a new simulation", source: poncho.source,
  contextLimits: poncho.method, rows }, null, 2));
