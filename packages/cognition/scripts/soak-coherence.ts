/** Bounded real-world matrix using the unchanged engine and actual Brain methods.
 * pnpm exec tsx packages/cognition/scripts/soak-coherence.ts --live <new-output-dir>
 * Seeds 84/85/86, ticks 1/60, two days, two agents, existing fallback policy.
 * Captures inputs via provider diagnostics, outputs and world events separately. */
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { Town, Rng } from "@unwatched/engine";
import { OpenRouterBrain, seedPersonas, isFromFallback } from "../src/index.ts";
import type { ProviderUsage } from "../src/provider/openrouter.ts";

if (process.argv[2] !== "--live" || !process.argv[3]) throw new Error("Requires --live <new-output-dir>; six paid simulation runs.");
const output = resolve(process.argv[3]);
if (existsSync(output)) throw new Error("Choose a new output directory.");
process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
mkdirSync(output, { recursive: true });
const selected = process.argv[4] ? Number(process.argv[4]) : null;
if (selected !== null && ![84, 85, 86].includes(selected)) throw new Error("Optional seed must be 84, 85 or 86");
const seeds = selected === null ? [84, 85, 86] : [selected];
const root = resolve(import.meta.dirname, "../src");
const revision = readdirSync(root, { recursive: true }).map(String).filter(path => path.endsWith(".ts")).sort()
  .map(path => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex") }));
writeFileSync(resolve(output, "sample.json"), JSON.stringify({ seeds, ticks: [1, 60], days: 2, agents: 2, revision, maxResponsesPerRun: 120, maxKnownCostTotalUsd: 1, note: "LLM nondeterministic; identical seeds are not identical generations. Unknown costs retained." }, null, 2));
let knownCost = 0;
for (const seed of seeds) for (const tick of [1, 60]) {
  const dir = resolve(output, `seed${seed}-tick${tick}`); mkdirSync(dir);
  const usage: ProviderUsage[] = [], diagnostics: Record<string, unknown>[] = [];
  const brain = new OpenRouterBrain({ logContent: true, logGeneration: false, log: line => {
    appendFileSync(resolve(dir, "provider.jsonl"), line + "\n");
    const match = line.match(/^openrouter (validation|repair_comparison|transport_error) (\{.*\})$/u);
    if (match) diagnostics.push({ event: match[1], ...JSON.parse(match[2]!) });
  } });
  brain.onUsage = u => { usage.push(u); knownCost += u.costUsd ?? 0; };
  const town = new Town({ seed, brain, minutesPerTick: tick, onEvent: event => appendFileSync(resolve(dir, "events.jsonl"), JSON.stringify(event) + "\n") });
  for (const [i, persona] of seedPersonas(new Rng(seed), 2).entries()) town.addAgent({ persona, owner: i < 3 ? "you" : null });
  let fallbacks = 0, errors = 0, accepted = 0;
  // Wrappers only observe existing methods; they neither queue nor apply actions.
  const decide = brain.decide.bind(brain), converse = brain.converse.bind(brain), reflect = brain.reflect.bind(brain), plan = brain.plan.bind(brain);
  const record = (kind: string, id: string, result: unknown, elapsedMs: number) => {
    const fallback = isFromFallback(result); if (fallback) fallbacks++; accepted++;
    appendFileSync(resolve(dir, "outputs.jsonl"), JSON.stringify({ t: town.t, kind, agent: id, fallback, elapsedMs, result }) + "\n");
  };
  brain.decide = async (p, a, tier) => { const start = performance.now(); try { const out = await decide(p, a, tier); record("decide", a.id, out, performance.now() - start); return out; } catch (error) { errors++; throw error; } };
  brain.converse = async ctx => { const start = performance.now(); const out = await converse(ctx); record("converse", ctx.a.id, out, performance.now() - start); return out; };
  brain.reflect = async ctx => { const start = performance.now(); const out = await reflect(ctx); record("reflect", ctx.agent.id, out, performance.now() - start); return out; };
  brain.plan = async (ctx, tier) => { const start = performance.now(); const out = await plan(ctx, tier); record("plan", ctx.agent.id, out, performance.now() - start); return out; };
  const start = performance.now(); let interrupted: string | null = null;
  try {
    while (town.day <= 2) {
      if (usage.length >= 120 || knownCost >= 1) { interrupted = "predefined response/cost bound reached"; break; }
      await town.tick();
      if (town.day === 2 && town.minuteOfDay === 360) town.sendLetter([...town.agents.keys()][0]!, "Find honest work first. Don't borrow. Write to me before any big decision.");
    }
  } catch (error) { interrupted = error instanceof Error ? error.message : String(error); }
  const counts = Object.fromEntries([...new Set(town.events.map(e => e.kind))].map(kind => [kind, town.events.filter(e => e.kind === kind).length]));
  const summary = { seed, tick, days: 2, completed: town.day > 2, interrupted, elapsedMs: Math.round(performance.now() - start), counts, accepted, errors, fallbacks, usage: brain.usage(), providerUsage: usage, diagnostics,
    citizens: [...town.agents.values()].map(a => ({ id: a.id, name: a.persona.name, needs: a.needs, inventory: a.inventory, coins: a.coins, job: a.job })) };
  writeFileSync(resolve(dir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ seed, tick, completed: summary.completed, interrupted, calls: usage.length, fallbacks, knownCostTotal: knownCost }));
  if (interrupted && knownCost >= 1) break;
}
