/** Offline replay only. Validator results are not independent quality labels. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decisionIssue } from "../src/semantics/decision.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { planIssue, reflectionIssue } from "../src/semantics/lifecycle.ts";
const root = resolve(import.meta.dirname, "../out/plan-closure-20260918");
const rows = JSON.parse(readFileSync(resolve(root, "audit-review.json"), "utf8")) as any[];
const results = rows.filter(row => !row.fallback && row.result).map(row => ({ key: row.key,
  issue: row.kind === "decide" ? decisionIssue(row.result, row.input[0], row.input[1].persona.name)
    : row.kind === "converse" ? dialogueIssue(row.result, row.input[0])
      : row.kind === "reflect" ? reflectionIssue(row.result, row.input[0]) : planIssue(row.result, row.input[0]),
}));
writeFileSync(resolve(root, "current-validator-replay.json"), JSON.stringify({ mode: "offline revalidation of recorded outputs; not new provider calls or independent semantic audit", results }, null, 2));
console.log(JSON.stringify(results.filter(row => row.issue)));
