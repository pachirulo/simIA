import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ActionProposal } from "@unwatched/protocol";

/** Optional, paid ablation on ONE frozen input, outside the benchmark/world.
 * Explicit --live is required. Do not run concurrently with a soak (cache effects).
 * Usage: tsx scripts/probe-token-input.ts --live <audit-dir> [variant]
 */
const [flag, directory, selectedVariant] = process.argv.slice(2);
if (flag !== "--live" || !directory) throw new Error("Requires --live <audit-dir>; makes six paid requests (one if a variant is selected).");
process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is required");
const rows = readFileSync(resolve(directory, "before.jsonl"), "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
const original = rows.find(row => row.phase === "request" && row.body.response_format.json_schema.name === "action_proposal")?.body;
if (!original) throw new Error("Missing original action request");
const frozen = JSON.parse(readFileSync(resolve(directory, "frozen-inputs.json"), "utf8"))[0];
for (const [variant, provider, prompts, schema] of [
  ["original", "sail-research/us", false, false],
  ["schema_only", "sail-research/us", false, true],
  ["prompts_only", "sail-research/us", true, false],
  ["both", "sail-research/us", true, true],
  ["original_other_provider", "open-inference/fp8", false, false],
  ["both_other_provider", "open-inference/fp8", true, true],
] as const) {
  if (selectedVariant && selectedVariant !== variant) continue;
  const body = structuredClone(original);
  body.provider = { ...body.provider, only: [provider], allow_fallbacks: false };
  if (schema) body.response_format.json_schema.schema = JSON.parse(frozen.after.schema);
  if (prompts) {
    body.messages[0].content[0].text = frozen.after.base;
    body.messages[1].content = frozen.after.mechanics + frozen.after.instructions + frozen.after.perception;
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45_000),
  });
  const result = await response.json() as { provider?: string; usage?: unknown; choices?: { message?: { content?: string | null } }[] };
  const content = result.choices?.[0]?.message?.content;
  let valid = false;
  try { valid = ActionProposal.safeParse(JSON.parse(content ?? "")).success; } catch { /* reported below */ }
  const record = { variant, requestedProvider: provider, status: response.status, body, result, canonicalValid: valid };
  appendFileSync(resolve(directory, "probes.jsonl"), JSON.stringify(record) + "\n", "utf8");
  console.log(JSON.stringify({ variant, status: response.status, provider: result.provider, usage: result.usage, canonicalValid: valid }));
}
