/** Opt-in live provider contract check. No simulation loop or background service. */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { contexts, persona } from "../test/fixtures.ts";

if (!process.argv.includes("--live")) throw new Error("Pass --live to authorize real OpenRouter calls");
const root = fileURLToPath(new URL("../../../", import.meta.url));
process.loadEnvFile(resolve(root, ".env"));
if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "PUT_YOUR_KEY_HERE") throw new Error("Set OPENROUTER_API_KEY in the root .env");
const out = resolve(root, "out", `cognition-live-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(out, { recursive: true });
const log = (line: string) => { appendFileSync(resolve(out, "provider.log"), line + "\n"); console.log(line); };
const brain = new OpenRouterBrain({ allowFallback: false, log });
brain.onUsage = u => appendFileSync(resolve(out, "calls.jsonl"), JSON.stringify(u) + "\n");
brain.onFallback = f => appendFileSync(resolve(out, "failures.jsonl"), JSON.stringify(f) + "\n");
// Fixture creates engine state only. No ticks or fixture-brain calls are executed.
const c = contexts(); brain.primer = c.primer;
const started = Date.now();
const results: { operation: string; elapsedMs: number; ok: boolean }[] = [];
try {
  for (const [operation, invoke] of [
    ["enrich", () => brain.enrich(persona, c.town.name)],
    ["plan", () => brain.plan(c.plan, 2)],
    ["decide", () => brain.decide(c.perception, c.a, 1)],
    ["converse", () => brain.converse(c.converse)],
    ["reflect", () => brain.reflect(c.reflect)],
  ] as const) {
    const t = Date.now(); const value = await invoke();
    results.push({ operation, elapsedMs: Date.now() - t, ok: value !== null });
    appendFileSync(resolve(out, "outputs.jsonl"), JSON.stringify({ operation, value }) + "\n");
    if (value === null) throw new Error(`${operation} returned no validated output`);
  }
} catch (error) {
  log(`Verification stopped: ${(error as Error).message}`); process.exitCode = 1;
} finally {
  const summary = { completed: results.length === 5 && results.every(r => r.ok) && !process.exitCode, elapsedMs: Date.now() - started, results, usage: brain.usage(), cachedTokens: brain.cachedTokens() };
  writeFileSync(resolve(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ out, ...summary }, null, 2));
}
