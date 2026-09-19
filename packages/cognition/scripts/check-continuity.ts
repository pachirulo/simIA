/** Opt-in live check. Each proposal goes through the unchanged engine; outcomes
 * are measured from state/events, never from the completion's narrative. */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouterBrain, type ProviderUsage } from "../src/openrouter.ts";
import { contexts } from "../test/fixtures.ts";

if (!process.argv.includes("--live")) throw new Error("Use --live to authorize OpenRouter calls for this diagnostic.");
const root = fileURLToPath(new URL("../../../", import.meta.url));
process.loadEnvFile(resolve(root, ".env"));
const dir = resolve(root, "out/continuity-review/live"); mkdirSync(dir, { recursive: true });
const usage: ProviderUsage[] = [];
const brain = new OpenRouterBrain({ allowFallback: false, logGeneration: false,
  log: line => appendFileSync(resolve(dir, "provider.log"), line + "\n") });
brain.onUsage = u => usage.push(u);
const results = [];
for (const scenario of ["meal", "resource_visit"] as const) {
  const { town, a, b } = contexts();
  town.day = 2; town.t = 1440 + 600;
  a.needs = { hunger: scenario === "meal" ? 1 : .1, rest: .1, social: .1 };
  a.inventory = []; a.coins = 40; a.memory = []; b.location = "harbor";
  const destination = scenario === "meal" ? "market" : "sawpit";
  const item = scenario === "meal" ? "bread" : "timber";
  a.intentions = [scenario === "meal" ? "Comer antes de seguir con el trabajo." : "Ir al aserradero para conseguir timber para mi carpintería."];
  a.plan = { day: 2, mood: "decidida", goals: [...a.intentions], steps: [
    { hour: 9, do: a.intentions[0]!, place: destination, done: scenario === "meal", missed: scenario !== "meal" },
  ] };
  if (scenario === "resource_visit") {
    // Only a statement actually executed; no commitment extractor invents a goal.
    b.location = a.location;
    town.apply(a, { kind: "say", to: b.id, text: "Voy al aserradero por madera ahora." }, "live setup");
    b.location = "harbor";
  }
  const start = town.events.length, steps = [];
  for (let i = 0; i < (scenario === "meal" ? 3 : 6); i++) {
    const before = { place: a.location, inventory: [...a.inventory], hunger: a.needs.hunger };
    const proposal = await brain.decide(town.perceive(a), a, 1);
    const accepted = town.apply(a, proposal.action, "continuity live check");
    steps.push({ before, proposal, accepted, after: { place: a.location, inventory: [...a.inventory], hunger: a.needs.hunger } });
    town.t++;
    if (scenario === "meal" ? a.needs.hunger < .6 : a.inventory.includes(item)) break;
  }
  results.push({ scenario, steps, achieved: scenario === "meal" ? a.needs.hunger < .6 : a.inventory.includes(item),
    events: town.events.slice(start) });
  writeFileSync(resolve(dir, "results.json"), JSON.stringify({ results, usage }, null, 2));
  console.log(JSON.stringify({ scenario, achieved: results.at(-1)!.achieved, actions: steps.map(s => s.proposal.action) }));
}
if (results.some(r => !r.achieved)) process.exitCode = 1;
