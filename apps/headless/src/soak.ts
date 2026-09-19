import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Town, MINUTES_PER_DAY } from "@unwatched/engine";
import type { Brain } from "@unwatched/engine";
import { MockBrain, AnthropicBrain, OpenRouterBrain, seedPersonas, logDialogue, worldPrimerOf } from "@unwatched/cognition";
import { Rng } from "@unwatched/engine";
import { RunLogs } from "./run-logs.ts";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
}

const days = Number(arg("days", "7"));
const agents = Number(arg("agents", "20"));
const seed = Number(arg("seed", "42"));
const brainName = arg("brain", "mock");
const tick = Number(arg("tick", "1"));
const outDir = arg("out", "out");
const owner = arg("owner", "you");
if (!Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(agents) || agents < 1
  || !Number.isSafeInteger(tick) || tick < 1 || !Number.isSafeInteger(seed)) {
  throw new Error("days, agents and tick must be positive integers; seed must be an integer.");
}
if (!["mock", "openrouter", "anthropic"].includes(brainName)) throw new Error(`Unknown brain: ${brainName}`);

// Load .env from the repo root, wherever this is run from.
const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (brainName === "anthropic" && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("The Anthropic brain needs credentials. Put ANTHROPIC_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}
if (brainName === "openrouter" && !process.env.OPENROUTER_API_KEY) {
  console.error("The OpenRouter brain needs a key. Put OPENROUTER_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}

const files = new RunLogs(outDir, { seed, days, agents, tick, brain: brainName, logContent: process.env.UW_OR_LOG_CONTENT === "1" });
const log = (l: string) => { files.write("run.log", `  ${l}\n`); process.stderr.write(`  ${l}\n`); };
const report = (line: string) => { files.write("run.log", line + "\n"); console.log(line); };
let signal: "SIGINT" | "SIGTERM" | null = null;
const stop = (name: "SIGINT" | "SIGTERM") => { signal = name; log(`${name}: stopping after the current tick; keeping partial logs.`); };
const onInterrupt = () => stop("SIGINT"), onTerminate = () => stop("SIGTERM");
process.once("SIGINT", onInterrupt); process.once("SIGTERM", onTerminate);
let activeBrain: Brain | undefined, activeTown: Town | undefined;

async function simulate(): Promise<void> {

const brain: Brain = brainName === "anthropic" ? new AnthropicBrain({ log }) : brainName === "openrouter" ? new OpenRouterBrain({ log }) : new MockBrain(seed);
activeBrain = brain;
const town = new Town({ seed, brain, minutesPerTick: tick, onEvent: e => {
  files.write("events.jsonl", JSON.stringify(e) + "\n");
  log(`event ${JSON.stringify(e)}`);
  logDialogue(e, id => town.agents.get(id)?.persona.name, line => {
    files.write("dialogue.jsonl", line.slice("dialogue ".length) + "\n"); log(line);
  });
}, log });
activeTown = town;

const personas = seedPersonas(new Rng(seed), agents);
for (const [i, p] of personas.entries()) town.addAgent({ persona: p, owner: i < 3 ? owner : null });
const mira = town.agents.values().next().value!;

report(`Unwatched · ${agents} citizens · ${days} days · brain ${brain.name} · seed ${seed}`);
report(`Run files: ${files.directory}`);
const t0 = Date.now();
let lastDay = town.day;
const startT = town.t;

await (async () => {
  while (town.day <= days && !signal) {
    if (brain instanceof OpenRouterBrain) brain.primer = worldPrimerOf(town);
    await town.tick();
    if (town.day === 2 && town.hour === 6 && town.minuteOfDay === 360) town.sendLetter(mira.id, "Find honest work first. Don't borrow. Write to me before any big decision.");
    if (town.day !== lastDay) {
      const d = lastDay;
      const paper = town.papers[town.papers.length - 1];
      if (paper) {
        const md = [`# The Gazette · edition ${paper.edition} · ${paper.date} · ${paper.weather}`, "", `## ${paper.lead.headline}`, `*${paper.lead.deck}*`, "", paper.lead.body, "", ...paper.briefs.flatMap((b) => [`### ${b.headline}`, b.body, ""]), "## Notices", ...paper.notices.map((n) => `- ${n}`), ""].join("\n");
        writeFileSync(`${outDir}/gazette-day${d}.md`, md);
        report(`\n${md.split("\n").slice(0, 4).join("\n")}`);
      }
      const coins = [...town.agents.values()].reduce((s, a) => s + a.coins, 0);
      const jobs = [...town.agents.values()].filter((a) => a.job).length;
      const broke = [...town.agents.values()].filter((a) => a.coins <= 2).length;
      report(`  day ${d}: coins in circulation ${coins} · employed ${jobs}/${town.agents.size} · broke ${broke} · events ${town.events.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      lastDay = town.day;
    }
  }
})();
if (signal) return;

const digest = town.digest(mira.id, startT + MINUTES_PER_DAY * Math.max(0, days - 3));
const summary = {
  seed, days, agents, brain: brain.name, elapsedMs: Date.now() - t0, events: town.events.length,
  digestFor: mira.persona.name, digest,
  citizens: [...town.agents.values()].map((a) => ({ name: a.persona.name, coins: a.coins, job: a.job, home: a.home, memories: a.memory.length, relationships: a.relationships.size })),
};
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary) + "\n");
writeFileSync(`${outDir}/construction.json`, JSON.stringify({ town: `Island · seed ${seed}`, source: `${brain.name} simulation · ${days} days · seed ${seed}`, size: town.pack.size, buildings: [...town.places.values()].filter(p => p.history).map(p => ({x:p.x,y:p.y,district:p.district,history:p.history})) }) + "\n");

report(`\nWhile you were away · ${mira.persona.name} · last 3 days`);
report(`  ${digest.headline}`);
for (const e of digest.items.slice(0, 8)) report(`  ${town.clock(e.t)}  ${e.text.slice(0, 140)}`);
if (brain instanceof OpenRouterBrain) { const u = brain.usage(); report(`\nOpenRouter: ${u.calls} calls · ${u.prompt} prompt tokens · ${u.completion} completion tokens`); }
report(`\nWrote ${outDir}/events.jsonl, ${outDir}/dialogue.jsonl, ${outDir}/run.log, ${outDir}/run.json, ${outDir}/summary.json`);
}

let failure: string | undefined;
try { await simulate(); }
catch (error) { failure = error instanceof Error ? error.message : String(error); log(`Run failed: ${failure}`); process.exitCode = 1; }
finally {
  // Keep the log open through asynchronous provider metadata, including failure.
  try { if (activeBrain instanceof OpenRouterBrain) await activeBrain.flushLogs(); }
  catch { log("Could not drain provider diagnostics; metadata may be incomplete."); }
  const status = signal ? "interrupted" : failure ? "failed" : "completed";
  const complete = files.finish(status, { ...(failure ? { failure } : {}), signal,
    minute: activeTown?.t ?? null, events: activeTown?.events.length ?? 0,
    usage: activeBrain instanceof OpenRouterBrain ? activeBrain.usage() : null });
  process.off("SIGINT", onInterrupt); process.off("SIGTERM", onTerminate);
  if (signal) process.exitCode = signal === "SIGINT" ? 130 : 143;
  else if (!complete) process.exitCode = 1;
}
