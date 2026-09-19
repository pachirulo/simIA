/** Real-provider replay of the six user-identified captures. No ticks or world writes.
 * pnpm exec tsx packages/cognition/scripts/check-coherence.ts --live <new-output-dir>
 * Five cases, at most ten completion responses; failed cases are retained. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { ActionProposal, Dialogue, Reflection, Perception } from "@unwatched/protocol";
import { OpenRouterProvider, type ProviderUsage } from "../src/provider/openrouter.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { anchoredRepairNote, repairAnchor, compareRepair } from "../src/semantics/repair.ts";
import { decisionGrounding } from "../src/context/decide.ts";
import { contexts } from "../test/fixtures.ts";

if (process.argv[2] !== "--live" || !process.argv[3]) throw new Error("Requires --live <new-output-dir>; up to ten paid responses.");
const output = resolve(process.argv[3]);
if (existsSync(output)) throw new Error("Choose a new directory; previous evidence must not be overwritten.");
process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
mkdirSync(output, { recursive: true });
const source = JSON.parse(readFileSync(resolve(import.meta.dirname, "../test/fixtures/coherence-captures.json"), "utf8").replace(/^\uFEFF/u, "")) as {
  id: string; input: { messages: { role: string; content: string | { text: string }[] }[] }; output: unknown;
}[];
const ids = ["gen-1789705637-qaa4XTCNeeXAjMF4mQSd", "gen-1789705655-6q5lQaegSnuFhkaJXj0t", "gen-1789705658-f1Cr1aLPlteUnbghWXhh", "gen-1789705491-i0df6nFfc94tMPdPcyox", "gen-1789705671-U7aI92Cjjc43li4TkcKA"];
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY required");
const provider = new OpenRouterProvider({ apiKey, logContent: true, logGeneration: false, log: line => appendFileSync(resolve(output, "provider.jsonl"), line + "\n") });
const usage: ProviderUsage[] = []; provider.onUsage = u => usage.push(u);
const results: unknown[] = [];
for (const id of ids) {
  const original = source.find(c => c.id === id)!;
  const blocks = original.input.messages[0]!.content as { text: string }[];
  const system = { shared: blocks[0]!.text, ...(blocks[1] ? { own: blocks[1].text } : {}) };
  const user = original.input.messages.find(m => m.role === "user")!.content as string;
  const before = usage.length, start = performance.now();
  const model = process.env.UW_OR_MODEL_ROUTINE ?? "deepseek/deepseek-v4-flash-0731";
  let value: unknown;
  if ("action" in (original.output as object)) {
    const p = Perception.parse(JSON.parse(user.slice(user.lastIndexOf("\n\n") + 2)));
    const previous = ActionProposal.parse(original.output), issue = decisionIssue(previous, p);
    const anchor = issue ? repairAnchor(previous, issue) : null;
    // Explicitly replay the rejected decision for R2; the other cases choose anew.
    const isRepair = id === ids[1];
    value = await provider.call("action_proposal", model, "routine", system,
      user + "\n\n" + decisionGrounding(p) + (isRepair && issue ? "\n" + anchoredRepairNote(issue, anchor) : ""), ActionProposal, 1024, p.agent_id,
      out => (isRepair && anchor ? compareRepair(anchor, out).issue : null) ?? decisionIssue(out, p));
  } else if ("lines" in (original.output as object)) {
    const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez";
    const ctx = { ...c.converse, a: c.b, b: c.a, aMemories: [], bMemories: [] };
    value = await provider.call("dialogue", model, "routine", system, user + "\nPreserve the first speaker of each claim in both memories, including conditions. rumor is exclusively A telling B; use null when B originated it. Keep uncertainty; repetition does not independently verify a rumor.", Dialogue, 1500, ctx.a.id, out => dialogueIssue(out, ctx));
  } else {
    const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez";
    c.reflect.agent = c.a; c.reflect.dayMemories = []; c.reflect.keyMemories = []; c.reflect.desireEvidence = [];
    c.reflect.actionEvidence = user.match(/^\[event .+$/gmu) ?? [];
    const personal = user.match(/Personal experience records for desire changes: (\[.*\])\./u)?.[1];
    if (personal) c.reflect.desireEvidence = (JSON.parse(personal) as { id: number; kind: NonNullable<typeof c.reflect.desireEvidence>[number]["kind"]; text: string }[])
      .map(e => ({ ...e, actors: [c.a.id], day: 2, t: 0, importance: 0 })); // own records as labeled in source; original times unavailable here
    value = await provider.call("reflection", process.env.UW_OR_MODEL_REFLECT ?? model, "reflect", system,
      user + "\nNo verified effective debt is supplied. Keep payment conditions pending; do not infer a debt from the old plan or book. Missing evidence is unknown. Use precise evidence wording for physical outcomes in every field.", Reflection, 2000, c.a.id, out => reflectionIssue(out, c.reflect));
  }
  const result = { id, value, status: value === null ? "failed" : "accepted", elapsedMs: Math.round(performance.now() - start), usage: usage.slice(before) };
  results.push(result); writeFileSync(resolve(output, "results.json"), JSON.stringify({ mode: "original-context replay plus new grounding; partial reconstructed checker contexts for dialogue/reflection", results, usage: provider.usage() }, null, 2));
  console.log(JSON.stringify({ id, status: result.status, calls: usage.length - before, value }));
}
