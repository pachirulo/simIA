/** Bounded paid regression checks. No simulation ticks, execution or stored memories.
 * pnpm exec tsx packages/cognition/scripts/verify-semantics.ts --live [output-dir] [case-name]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ActionProposal, type Perception } from "@unwatched/protocol";
import { OpenRouterBrain, type ProviderUsage } from "../src/openrouter.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { contexts } from "../test/fixtures.ts";

if (process.argv[2] !== "--live") throw new Error("Requires --live; up to 12 paid responses, with no model fallback.");
process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const out = resolve(process.argv[3] ?? `out/semantic-live-${Date.now()}`);
mkdirSync(out, { recursive: true });
const c = contexts();
const usage: ProviderUsage[] = [];
const brain = new OpenRouterBrain({ allowFallback: false, log: line => appendFileSync(resolve(out, "provider.log"), line + "\n") });
brain.onUsage = value => usage.push(value);
const results: unknown[] = [];
const cases = ["starving_counter", "starving_inventory", "exhausted", "sunday_jobless", "skill_recipe", "free_deed"] as const;
if (process.argv[4] && !cases.some(name => name === process.argv[4])) throw new Error(`Unknown case: ${process.argv[4]}`);
for (const name of cases) {
  if (process.argv[4] && process.argv[4] !== name) continue;
  const p: Perception = structuredClone(c.perception);
  p.nearby = []; p.heard = []; p.recent = []; p.today = null;
  if (p.town) p.town.people = [];
  delete p.hint; delete p.crossroads;
  p.time.weekday = "Sunday";
  p.self.job = null; p.self.shift = null; p.self.coins = 40;
  p.self.inventory = []; p.self.weak = false; p.self.days_hungry = 0;
  p.self.needs = { hunger: .1, rest: .1, social: .2 };
  p.self.feels = { hunger: "fed", rest: "rested", social: "content" };
  p.place.for_sale = [{ item: "bread", price: 1 }, { item: "soup", price: 2 }];
  p.options = [...new Set([...p.options, "propose_skill" as const])];
  if (name.startsWith("starving")) { p.self.needs.hunger = .95; p.self.feels.hunger = "starving; a day that ends like this counts against you"; }
  if (name === "starving_inventory") p.self.inventory = ["bread"];
  if (name === "exhausted") { p.self.needs.rest = .95; p.self.feels.rest = "exhausted"; }
  if (name === "sunday_jobless") p.hint = "You want paid work. Consider what is actually possible today.";
  if (name === "skill_recipe") p.hint = "You want to record a reusable procedure for buying bread here and eating it on future visits, if sensible.";
  if (name === "free_deed") p.hint = "You want to sing a song about your childhood, here, if sensible.";
  const before = usage.length;
  let ok = false;
  try {
    const value = await brain.decide(p, c.a, 1);
    const valid = ActionProposal.safeParse(value).success && !decisionIssue(value, p);
    // These are behavior observations, stricter than the general contract (which
    // allows conscious risk). A miss is reported, never forced into another action.
    const expected = name === "starving_counter" ? value.action.kind === "trade" && ["bread", "soup"].includes(value.action.buy ?? "")
      : name === "starving_inventory" ? value.action.kind === "use" && value.action.item === "bread"
      : name === "exhausted" ? value.action.kind === "sleep"
      : name === "sunday_jobless" ? value.action.kind !== "work"
      : name === "skill_recipe" ? value.action.kind === "propose_skill"
      : value.action.kind === "do" || value.action.kind === "say";
    ok = valid && expected;
    results.push({ name, ok, valid, expected, value, usage: usage.slice(before), context: buildDecideContext(p, c.a) });
  } catch (error) { results.push({ name, ok, error: String(error), usage: usage.slice(before) }); }
  console.log(JSON.stringify({ name, ok, calls: usage.length - before }));
}
writeFileSync(resolve(out, "results.json"), JSON.stringify({ results, usage: brain.usage(), cached: brain.cachedTokens() }, null, 2), "utf8");
if (results.some(result => !(result as { ok: boolean }).ok)) process.exitCode = 1;
