/** Bounded paid replay of recorded perceptions; never ticks or mutates the world.
 * pnpm exec tsx packages/cognition/scripts/verify-log-regressions.ts --live <api-log-dir> <output-dir>
 * Each decision permits at most one repair. Saves generation metadata/content via API. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ActionProposal, Perception } from "@unwatched/protocol";
import { OpenRouterProvider, type ProviderUsage } from "../src/provider/openrouter.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { contexts } from "../test/fixtures.ts";

if (process.argv[2] !== "--live" || !process.argv[3] || !process.argv[4]) throw new Error("Requires --live <api-log-dir> <output-dir>; up to 8 paid responses.");
process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY required");
const output = resolve(process.argv[4]); mkdirSync(output, { recursive: true });
const usage: ProviderUsage[] = [];
const provider = new OpenRouterProvider({ apiKey, log: console.log });
provider.onUsage = event => usage.push(event);
const cases = [
  ["carried_food", "gen-1789692240-PWY3DOExJc3e8VTM5H1w"],
  ["away_from_bed", "gen-1789692238-ryIEvjWTNtelcAZjWZ7g"],
  ["empty_room", "gen-1789692174-XhyvJFztjRtjqUg1OVto"],
  ["destination_id", "gen-1789692178-JJCy9DEGS7fB6LIh8Hvf"],
] as const;
const results = [];
for (const [name, id] of cases) {
  if (process.argv[5] && process.argv[5] !== name) continue;
  const source = JSON.parse(readFileSync(resolve(process.argv[3], `${id}-generation-content.json`), "utf8")).data;
  const messages = source.input.messages;
  const p = Perception.parse(JSON.parse(messages[1].content.slice(messages[1].content.lastIndexOf("\n\n") + 2)));
  const { a } = contexts();
  // Arrival evidence in these logs establishes three prepaid nights at the inn.
  a.home = { place: "inn", nightsPaid: p.self.housing?.nights_left ?? 3 };
  const context = buildDecideContext(p, a);
  // Preserve the exact original stable rules/persona, not the test agent's persona.
  const suffix = "\n\nAnswer with a single JSON object matching the supplied response schema, no prose.";
  const shared = messages[0].content[0].text;
  if (!shared.endsWith(suffix)) throw new Error("Unexpected logged system format");
  const system = { shared: shared.slice(0, -suffix.length), own: messages[0].content[1].text };
  const before = usage.length;
  const value = await provider.call("action_proposal", "deepseek/deepseek-v4-flash-0731", "routine", system, context.user, ActionProposal, 1024, p.agent_id, out => decisionIssue(out, p));
  results.push({ name, sourceGenerationId: id, original: JSON.parse(source.output.completion), value, usage: usage.slice(before), originalUserChars: messages[1].content.length, updatedUserChars: context.user.length, system, user: context.user });
  console.log(JSON.stringify({ name, value, calls: usage.length - before }));
  writeFileSync(resolve(output, "results.json"), JSON.stringify({ results, usage: provider.usage() }, null, 2), "utf8");
}
for (const event of usage) {
  if (!event.generationId) continue;
  for (const [suffix, endpoint] of [["content", "generation/content"], ["metadata", "generation"]]) {
    const response = await fetch(`https://openrouter.ai/api/v1/${endpoint}?id=${encodeURIComponent(event.generationId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) });
    // New content logs can lag behind completions; leave the generation ID to
    // retrieve later without replaying a paid model call.
    if (!response.ok) { console.warn(`Log API ${response.status} for ${event.generationId} (${endpoint}); retrieve later`); continue; }
    writeFileSync(resolve(output, `${event.generationId}-${suffix}.json`), JSON.stringify(await response.json(), null, 2), "utf8");
  }
}
