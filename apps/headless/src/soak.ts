import { mkdirSync, writeFileSync, createWriteStream, existsSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { Town, MINUTES_PER_DAY, brainTrace, tagBrainResult } from "@unwatched/engine";
import type { Brain } from "@unwatched/engine";
import { MockBrain, AnthropicBrain, OpenRouterBrain, seedPersonas } from "@unwatched/cognition";
import { Rng } from "@unwatched/engine";

/**
 * Soaks normally give every citizen one mind. A split soak keeps NPCs cheap and
 * deterministic while letting a smaller, named group use a live mind. The town
 * still asks one Brain, so this routes each person-scoped request by their id.
 */
class SplitBrain implements Brain {
  readonly name: string;

  constructor(private readonly npc: Brain, private readonly agent: Brain, private readonly agentIds: Set<string>) {
    this.name = `split(${npc.name},${agent.name})`;
  }

  private forId(id: string): Brain { return this.agentIds.has(id) ? this.agent : this.npc; }
  private async traced<T>(provider: Brain, result: Promise<T>): Promise<T> {
    const answer = await result;
    return brainTrace(answer) ? answer : tagBrainResult(answer, { model: provider.name });
  }
  decide(...args: Parameters<Brain["decide"]>) { const provider = this.forId(args[1].id); return this.traced(provider, provider.decide(...args)); }
  converse(...args: Parameters<Brain["converse"]>) { const provider = this.forId(args[0].a.id); return this.traced(provider, provider.converse(...args)); }
  reflect(...args: Parameters<Brain["reflect"]>) { const provider = this.forId(args[0].agent.id); return this.traced(provider, provider.reflect(...args)); }
  plan(...args: Parameters<Brain["plan"]>) { const provider = this.forId(args[0].agent.id); return this.traced(provider, provider.plan(...args)); }
  digest(...args: Parameters<Brain["digest"]>) { const provider = this.forId(args[0].agent.id); return this.traced(provider, provider.digest(...args)); }
  judge(...args: Parameters<Brain["judge"]>) { const provider = this.forId(args[0].agent.id); return this.traced(provider, provider.judge(...args)); }
  // These are the town's voice rather than a particular citizen's. The live-agent
  // mind owns it when one is present, matching a regular --brain openrouter soak.
  child(...args: Parameters<Brain["child"]>) { return this.traced(this.agent, this.agent.child(...args)); }
  writePaper(...args: Parameters<Brain["writePaper"]>) { return this.traced(this.agent, this.agent.writePaper(...args)); }
  life(...args: Parameters<Brain["life"]>) { return this.traced(this.agent, this.agent.life(...args)); }
}

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

const hasNpcCount = process.argv.includes("--npc-count");
const hasAgentCount = process.argv.includes("--agent-count");
if (hasNpcCount !== hasAgentCount) throw new Error("Use --npc-count and --agent-count together");
const splitPopulation = hasNpcCount;
if (splitPopulation && process.argv.includes("--agents")) throw new Error("Use --agents for one population, or --npc-count with --agent-count for a split population");

const days = Number(arg("days", "7"));
const npcCount = splitPopulation ? Number(arg("npc-count", "0")) : 0;
const agentCount = splitPopulation ? Number(arg("agent-count", "0")) : Number(arg("agents", "20"));
const agents = npcCount + agentCount;
const seed = Number(arg("seed", "42"));
const brainName = arg("brain", "mock");
const npcBrainName = splitPopulation ? arg("npc-brain", "mock") : brainName;
const agentBrainName = splitPopulation ? arg("agent-brain", brainName) : brainName;
const tick = Number(arg("tick", "1"));
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const outOption = arg("out", "out");
// pnpm --filter starts this script inside apps/headless even when the command
// was launched at the repo root. Interpret explicit relative paths from the
// repo root, while preserving the old default `out` in apps/headless/out.
const outDir = isAbsolute(outOption) ? outOption : resolve(repoRoot, outOption === "out" ? "apps/headless/out" : outOption);
const owner = arg("owner", "you");
const ownersOption = process.argv.includes("--owners") ? arg("owners", "") : null;
if (ownersOption !== null && process.argv.includes("--owner")) throw new Error("Use --owner or --owners, not both");
const owners = ownersOption === null ? [owner] : ownersOption.split(",").map((id) => id.trim());
const ownerCapacity = splitPopulation ? agentCount : agents;
const ownedAgents = Number(arg("owned-agents", String(splitPopulation ? agentCount : ownersOption === null ? Math.min(3, agents) : owners.length)));
if (!Number.isInteger(agents) || agents < 1) throw new Error("--agents must be a positive whole number");
if (splitPopulation && (!Number.isInteger(npcCount) || npcCount < 0 || !Number.isInteger(agentCount) || agentCount < 1))
  throw new Error("--npc-count must be zero or more and --agent-count must be a positive whole number");
if (owners.some((id) => !id) || new Set(owners).size !== owners.length) throw new Error("--owners needs distinct, nonempty names separated by commas");
if (!Number.isInteger(ownedAgents) || ownedAgents < 0 || ownedAgents > ownerCapacity || (ownersOption !== null && ownedAgents < owners.length))
  throw new Error(`--owned-agents must be a whole number from ${ownersOption === null ? 0 : owners.length} to ${ownerCapacity}`);

// Load .env from the repo root, wherever this is run from.
const envFile = resolve(repoRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const requestedBrains = [...new Set([npcBrainName, agentBrainName])];
if (requestedBrains.includes("anthropic") && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("The Anthropic brain needs credentials. Put ANTHROPIC_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}
if (requestedBrains.includes("openrouter") && !process.env.OPENROUTER_API_KEY) {
  console.error("The OpenRouter brain needs a key. Put OPENROUTER_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
console.log(`Soak output · ${outDir}`);
const eventsFile = createWriteStream(`${outDir}/events.jsonl`);
const log = (l: string) => process.stderr.write(`  ${l}\n`);

const personas = seedPersonas(new Rng(seed), agents);
const brains = new Map<string, Brain>();
const brainFor = (name: string): Brain => {
  const existing = brains.get(name); if (existing) return existing;
  const made = name === "anthropic" ? new AnthropicBrain({ log }) : name === "openrouter" ? new OpenRouterBrain({ log }) : name === "mock" ? new MockBrain(seed) : (() => { throw new Error(`Unknown brain ${name}. Use mock, anthropic, or openrouter.`); })();
  brains.set(name, made); return made;
};
const npcBrain = brainFor(npcBrainName);
const agentBrain = brainFor(agentBrainName);
const agentIndexes = new Set(Array.from({ length: agentCount }, (_, i) => npcCount + i));
const agentIds = new Set(Array.from(agentIndexes, (i) => `ag_${(i + 1).toString(36)}`));
const brain: Brain = splitPopulation && npcBrain !== agentBrain ? new SplitBrain(npcBrain, agentBrain, agentIds) : agentBrain;
const town = new Town({ seed, brain, minutesPerTick: tick, onEvent: (e) => eventsFile.write(JSON.stringify(e) + "\n"), log });
const openRouterBrains = [...new Set(brains.values())].filter((candidate): candidate is OpenRouterBrain => candidate instanceof OpenRouterBrain);
const callsFile = openRouterBrains.length ? createWriteStream(`${outDir}/calls.jsonl`) : null;
for (const openrouter of openRouterBrains) openrouter.onUsage = (usage) => callsFile?.write(JSON.stringify({ day: town.day, t: town.t, ...usage }) + "\n");

for (const [i, p] of personas.entries()) {
  const isAgent = agentIndexes.has(i);
  const positionInAgentGroup = i - npcCount;
  const agentOwner = isAgent && positionInAgentGroup < ownedAgents ? owners[positionInAgentGroup % owners.length]! : null;
  town.addAgent({ persona: p, owner: agentOwner });
}
const initialCitizens = [...town.agents.values()].map((a, i) => ({ id: a.id, name: a.persona.name, role: agentIndexes.has(i) ? "agent" : "npc", brain: agentIndexes.has(i) ? agentBrain.name : npcBrain.name, owner: a.owner }));
const digestCitizen = [...town.agents.values()].find((a) => a.owner !== null)
  ?? (splitPopulation ? [...town.agents.values()].find((a) => agentIds.has(a.id)) : undefined)
  ?? town.agents.values().next().value!;

console.log(splitPopulation
  ? `Unwatched · ${npcCount} NPCs (${npcBrain.name}) · ${agentCount} agents (${agentBrain.name}) · ${days} days · seed ${seed}`
  : `Unwatched · ${agents} citizens · ${days} days · brain ${brain.name} · seed ${seed}`);
console.log(`Owners · ${ownedAgents} owned citizens · ${ownersOption === null ? (ownedAgents ? owner : "none") : owners.join(", ")}`);
const t0 = Date.now();
let lastDay = town.day;
const startT = town.t;

await (async () => {
  while (town.day <= days) {
    await town.tick();
    if (digestCitizen.owner && town.day === 2 && town.hour === 6 && town.minuteOfDay === 360) town.sendLetter(digestCitizen.id, "Find honest work first. Don't borrow. Write to me before any big decision.");
    if (town.day !== lastDay) {
      const d = lastDay;
      const paper = town.papers[town.papers.length - 1];
      if (paper) {
        const md = [`# The Gazette · edition ${paper.edition} · ${paper.date} · ${paper.weather}`, "", `## ${paper.lead.headline}`, `*${paper.lead.deck}*`, "", paper.lead.body, "", ...paper.briefs.flatMap((b) => [`### ${b.headline}`, b.body, ""]), "## Notices", ...paper.notices.map((n) => `- ${n}`), ""].join("\n");
        writeFileSync(`${outDir}/gazette-day${d}.md`, md);
        console.log(`\n${md.split("\n").slice(0, 4).join("\n")}`);
      }
      const coins = [...town.agents.values()].reduce((s, a) => s + a.coins, 0);
      const jobs = [...town.agents.values()].filter((a) => a.job).length;
      const broke = [...town.agents.values()].filter((a) => a.coins <= 2).length;
      console.log(`  day ${d}: coins in circulation ${coins} · employed ${jobs}/${town.agents.size} · broke ${broke} · events ${town.events.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      lastDay = town.day;
    }
  }
})();

const digest = town.digest(digestCitizen.id, startT + MINUTES_PER_DAY * Math.max(0, days - 3));
const openrouterUsage = openRouterBrains.reduce((total, openrouter) => {
  const usage = openrouter.usage();
  total.calls += usage.calls; total.prompt += usage.prompt; total.completion += usage.completion;
  total.costUsd = total.costUsd === null || usage.costUsd === null ? null : total.costUsd + usage.costUsd;
  return total;
}, { calls: 0, prompt: 0, completion: 0, costUsd: 0 as number | null });
const summary = {
  seed, days, agents, brain: brain.name, elapsedMs: Date.now() - t0, events: town.events.length,
  ...(splitPopulation ? { population: { npcs: npcCount, agents: agentCount, npcBrain: npcBrain.name, agentBrain: agentBrain.name } } : {}),
  ...(openRouterBrains.length ? { openrouterUsage } : {}),
  digestFor: digestCitizen.persona.name, digest,
  initialCitizens,
  citizens: [...town.agents.values()].map((a) => ({ id: a.id, name: a.persona.name, owner: a.owner, coins: a.coins, job: a.job, home: a.home, memories: a.memory.length, relationships: a.relationships.size })),
};
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${outDir}/construction.json`, JSON.stringify({ town: `Island · seed ${seed}`, source: `${brain.name} simulation · ${days} days · seed ${seed}`, size: town.pack.size, buildings: [...town.places.values()].filter(p => p.history).map(p => ({x:p.x,y:p.y,district:p.district,history:p.history})) }, null, 2));
eventsFile.end();
callsFile?.end();

console.log(`\nWhile you were away · ${digestCitizen.persona.name} · last 3 days`);
console.log(`  ${digest.headline}`);
for (const e of digest.items.slice(0, 8)) console.log(`  ${town.clock(e.t)}  ${e.text.replace(/\s+/g, " ").trim()}`);
if (openRouterBrains.length) { const u = openrouterUsage; console.log(`\nOpenRouter: ${u.calls} responses · ${u.prompt} prompt tokens · ${u.completion} completion tokens · ${u.costUsd === null ? "cost unavailable" : `$${u.costUsd.toFixed(6)}`}`); }
console.log(`\nWrote ${outDir}/events.jsonl${callsFile ? `, ${outDir}/calls.jsonl` : ""}, ${outDir}/gazette-day*.md, ${outDir}/summary.json`);
