/** Targeted replay, not a simulation or an exact AgentState restoration.
 * Requires the original captures under out/monchi-review-20260918.
 * Default: offline before/after validation. --live: three provider calls with
 * captured inputs plus the current added guidance, at most one repair each. */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Reflection, TownEvent } from "@unwatched/protocol";
import capture from "../test/fixtures/monchi-reflections.json";
import { contexts } from "../test/fixtures.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { reflectionSchema } from "../src/schema/reflection.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { OpenRouterProvider } from "../src/provider/openrouter.ts";

const directory = resolve(import.meta.dirname, "../out/monchi-review-20260918");
const live = process.argv.includes("--live");
const recheck = process.argv.includes("--recheck");
if (live && recheck) throw Error("Choose --live or --recheck, not both");
const destination = resolve(directory, live ? "live-replay.json" : recheck ? "live-recheck.json" : "offline-validation.json");
if (existsSync(destination)) throw Error(`Refusing to overwrite ${destination}`);
const before = await import(pathToFileURL(resolve(directory, "before-src/semantics/lifecycle.ts")).href);
if (live) process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const report: { mode: string; results: unknown[]; status: string } = {
  mode: live ? "Targeted real provider replay: captured messages + current additional reflection guidance; unchanged selected evidence; reconstructed validation context. Not a full simulation." : recheck ? "Offline recheck of saved real replay outputs against the final validator; no new model responses or executed reflections." : "Same captured outputs/evidence, before-turn source snapshot versus current validators; reconstructed surrounding AgentState.", results: [], status: "running",
};
writeFileSync(destination, JSON.stringify(report, null, 2));
for (const fixture of capture.fixtures) {
  const c = contexts(); c.a.id = fixture.agentId; c.a.persona.name = fixture.name;
  c.a.home = { ...c.a.home!, ...fixture.home }; c.a.coins = fixture.coins; c.a.desires = [];
  Object.assign(c.reflect, { day: fixture.day, dayMemories: fixture.dayMemories, keyMemories: fixture.keyMemories,
    actionEvidence: fixture.actionEvidence, desireEvidence: fixture.desireEvidence.map(e => TownEvent.parse(e)),
    relationships: capture.fixtures.filter(f => f.agentId !== fixture.agentId).map(f => ({ id: f.agentId, name: f.name, trust: 0 })),
  });
  if (recheck) {
    const lines = readFileSync(resolve(directory, "live-replay.log"), "utf8").split(/\r?\n/u);
    const responses = lines.filter(line => line.startsWith("openrouter response ")).map(line => JSON.parse(line.slice("openrouter response ".length))).filter(row => row.agentId === fixture.agentId);
    const validations = lines.filter(line => line.startsWith("openrouter validation ")).map(line => JSON.parse(line.slice("openrouter validation ".length)));
    report.results.push({ agent: fixture.name, outputs: responses.map(row => {
      const output = Reflection.parse(JSON.parse(row.response.choices[0].message.content));
      return { id: row.id, attempt: row.attempt, output, recordedIssue: validations.find(v => v.id === row.id)?.issue ?? null, finalIssue: reflectionIssue(output, c.reflect) };
    }) });
  } else if (!live) {
    const corrected: Reflection = { summary: `I arrived on the island. I have ${fixture.home.nightsPaid} nights paid at the inn.`, insights: [], opinions: [], intentions: [], letter_to_owner: null };
    // Remove the arrival event only for this observation-only positive control.
    const observationOnly = { ...c.reflect, desireEvidence: [], actionEvidence: [] };
    report.results.push({ agent: fixture.name, original: fixture.outputs.map(row => ({ id: row.id,
      before: before.reflectionIssue(Reflection.parse(row.output), c.reflect), after: reflectionIssue(Reflection.parse(row.output), c.reflect) })),
      observationOnly: { output: corrected, before: before.reflectionIssue(corrected, observationOnly), after: reflectionIssue(corrected, observationOnly) },
    });
  } else {
    const captured = JSON.parse(readFileSync(resolve(directory, fixture.outputs[0]!.id + ".json"), "utf8")).data;
    const blocks: { text: string }[] = captured.input.messages.find((m: { role: string }) => m.role === "system").content;
    const guidance = buildReflectContext(c.reflect).user.split("\n").filter(line => line.startsWith("Desire ID rule for this call:") || line.startsWith("The personal experience records above also support"));
    const user = captured.input.messages.find((m: { role: string }) => m.role === "user").content + "\n" + guidance.join("\n");
    const provider = new OpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY!, logContent: true, logGeneration: false,
      log: line => appendFileSync(resolve(directory, "live-replay.log"), line + "\n"),
    });
    const value = await provider.call("reflection", "deepseek/deepseek-v4-flash-0731", "reflect", {
      shared: blocks[0]!.text.replace(/\n\nAnswer with a single JSON object matching the supplied response schema, no prose\.$/u, ""),
      own: blocks.slice(1).map(b => b.text).join("\n"), cacheOwn: true,
    }, user, reflectionSchema(c.reflect), 2000, fixture.agentId, out => reflectionIssue(out, c.reflect));
    report.results.push({ agent: fixture.name, originalGeneration: fixture.outputs[0]!.id, accepted: value !== null, value, usage: provider.usage(), cachedTokens: provider.cachedTokens() });
    console.log(JSON.stringify({ agent: fixture.name, accepted: value !== null, usage: provider.usage() }));
  }
  writeFileSync(destination, JSON.stringify(report, null, 2));
}
report.status = "completed";
writeFileSync(destination, JSON.stringify(report, null, 2));
console.log(destination);
