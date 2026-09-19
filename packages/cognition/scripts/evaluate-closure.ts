/** Paid, bounded comparison. Both arms share this manifest and unchanged engine.
 * pnpm exec tsx packages/cognition/scripts/evaluate-closure.ts baseline|final|corrected */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Town, Rng } from "@unwatched/engine";
import { worldPrimerOf, logDialogue } from "../src/index.ts";
import type * as Cognition from "../src/index.ts";

const variant = process.argv[2];
if (!["baseline", "final", "corrected"].includes(variant ?? "")) throw new Error("Choose baseline, final or corrected explicitly (paid evaluation).");
const root = resolve(import.meta.dirname, "../../.."), study = resolve(root, "packages/cognition/out/plan-closure-20260918");
process.loadEnvFile(resolve(root, ".env"));
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY required");
const source = variant === "baseline" ? resolve(study, "baseline/src") : resolve(import.meta.dirname, "../src");
const module = await import(pathToFileURL(resolve(source, "index.ts")).href) as typeof Cognition;
const output = resolve(study, variant + "-runs");
if (existsSync(output)) throw new Error("Evaluation arm already exists; never overwrite a sample.");
mkdirSync(output);
const hashes = (directory: string) => readdirSync(directory, { recursive: true }).map(String).filter(path => path.endsWith(".ts")).sort()
  .map(path => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(directory, path))).digest("hex") }));
const manifest = {
  variant, startedAt: new Date().toISOString(), seeds: [84, 85, 86], days: 1, agents: 2, tick: 60,
  fallback: true, maxResponsesPerRun: 80, maxKnownCostUsd: .5, maxMinutesPerRun: 20,
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  cognition: hashes(source), engine: hashes(resolve(root, "packages/engine/src")),
  models: Object.fromEntries(["UW_OR_MODEL_ROUTINE", "UW_OR_MODEL_STAKES", "UW_OR_MODEL_REFLECT"].map(key => [key, process.env[key] ?? null])),
  limits: "Nondeterministic LLM; compares this turn's frozen baseline, not the unrecoverable original R1-R4 checkout. No cross-cadence comparison.",
};
writeFileSync(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));
let knownCost = 0;
for (const seed of manifest.seeds) {
  const dir = resolve(output, `seed${seed}`); mkdirSync(dir);
  const append = (file: string, value: unknown) => appendFileSync(resolve(dir, file), JSON.stringify(value) + "\n", "utf8");
  const brain = new module.OpenRouterBrain({ logContent: true, logGeneration: false, log: line => appendFileSync(resolve(dir, "provider.log"), line + "\n", "utf8") });
  brain.onUsage = value => { knownCost += value.costUsd ?? 0; append("usage.jsonl", value); };
  const town = new Town({ seed, brain, minutesPerTick: manifest.tick, onEvent: event => {
    append("events.jsonl", event); logDialogue(event, id => town.agents.get(id)?.persona.name, line => appendFileSync(resolve(dir, "dialogue.jsonl"), line.slice("dialogue ".length) + "\n", "utf8"));
  } });
  for (const persona of module.seedPersonas(new Rng(seed), manifest.agents)) town.addAgent({ persona, owner: "you" });
  writeFileSync(resolve(dir, "initial.json"), JSON.stringify(town.snapshot(), null, 2));
  let fallbacks = 0, calls = 0;
  for (const kind of ["decide", "converse", "reflect", "plan"] as const) {
    const original = brain[kind].bind(brain) as (...args: any[]) => Promise<unknown>;
    const wrapped = async (...args: any[]) => {
      const started = performance.now(), id = ++calls;
      // JSON context for audit (Map entries are not preserved here). Exact wire
      // prompts are captured separately in provider.log.
      append("inputs.jsonl", { id, t: town.t, kind, input: args });
      try {
        const result = await original(...args), fallback = module.isFromFallback(result);
        if (fallback) fallbacks++;
        append("outputs.jsonl", { id, t: town.t, kind, fallback, result, elapsedMs: performance.now() - started });
        return result;
      } catch (error) { append("outputs.jsonl", { id, t: town.t, kind, error: String(error), elapsedMs: performance.now() - started }); throw error; }
    };
    // Instrumentation preserves the overloaded Brain signatures and return values.
    Object.assign(brain, { [kind]: wrapped });
  }
  const started = performance.now(); let interrupted: string | null = null;
  try {
    while (town.day <= manifest.days) {
      if (brain.usage().calls >= manifest.maxResponsesPerRun || knownCost >= manifest.maxKnownCostUsd
        || performance.now() - started > manifest.maxMinutesPerRun * 60000) { interrupted = "predefined evaluation bound"; break; }
      brain.primer = worldPrimerOf(town);
      await town.tick();
    }
  } catch (error) { interrupted = String(error); }
  await brain.flushLogs();
  const summary = { seed, variant, completed: town.day > manifest.days, interrupted, elapsedMs: performance.now() - started,
    calls, fallbacks, events: town.events.length, usage: brain.usage(), knownCostTotal: knownCost };
  writeFileSync(resolve(dir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(resolve(dir, "final.json"), JSON.stringify(town.snapshot(), null, 2));
  console.log(JSON.stringify(summary));
  if (knownCost >= manifest.maxKnownCostUsd) break;
}
