import { z } from "zod";
import { ActionProposal, Dialogue, DayPlan, Reflection } from "@unwatched/protocol";
import { buildDecideContext } from "../src/context/decide.ts";
import { buildConverseContext } from "../src/context/converse.ts";
import { buildPlanContext } from "../src/context/plan.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { cachePersona, withPrimer, type CognitiveContext } from "../src/context/shared.ts";
import { buildMessages } from "../src/provider/openrouter.ts";
import { cleanSchema } from "../src/schema/json.ts";
import { compactActionSchema } from "../src/schema/compact.ts";
import { WORLD, personaBlock, decidePrompt, conversePrompt, planPrompt, reflectPrompt } from "../src/prompts.ts";
import type { CallKind } from "../src/model/router.ts";
import { contexts } from "../test/fixtures.ts";

/** No network or tokenizer dependency: include the response_format schema and,
 * only for the historical legacy baseline, its second copy in system. */
function size(kind: CallKind, context: CognitiveContext, schema: z.ZodType, primer: string, legacy = false) {
  const canonical = cleanSchema(z.toJSONSchema(schema));
  const schemaText = JSON.stringify(!legacy && kind === "action_proposal" ? compactActionSchema(canonical) : canonical);
  const messages = buildMessages(withPrimer(kind, context.system, primer), context.user);
  const blocks = messages[0]!.content as { text: string }[];
  const system = blocks.reduce((sum, block) => sum + block.text.length, 0) + (legacy ? schemaText.length : 0);
  return { system, user: context.user.length, total: system + context.user.length + schemaText.length };
}

const c = contexts();
const own = { shared: WORLD, own: personaBlock(c.a), cacheOwn: cachePersona(c.a) };
const plot = { ...c.perception, place: { ...c.perception.place, kind: "plot" }, options: [...c.perception.options, "build", "start_project", "propose_skill", "repair"] satisfies typeof c.perception.options };
const rows: { name: string; kind: CallKind; before: CognitiveContext; after: CognitiveContext; schema: z.ZodType }[] = [
  { name: "decide (market)", kind: "action_proposal", before: { system: own, user: decidePrompt(c.perception) }, after: buildDecideContext(c.perception, c.a), schema: ActionProposal },
  { name: "decide (building/learning)", kind: "action_proposal", before: { system: own, user: decidePrompt(plot) }, after: buildDecideContext(plot, c.a), schema: ActionProposal },
  { name: "converse", kind: "dialogue", before: { system: { shared: WORLD, own: conversePrompt.system(c.converse) }, user: conversePrompt.user(c.converse) }, after: buildConverseContext(c.converse), schema: Dialogue },
  { name: "plan", kind: "day_plan", before: { system: own, user: planPrompt(c.plan) }, after: buildPlanContext(c.plan), schema: DayPlan },
  { name: "reflect", kind: "reflection", before: { system: own, user: reflectPrompt(c.reflect) }, after: buildReflectContext(c.reflect), schema: Reflection },
];
console.log("Offline context comparison. Same engine fixture, persona, dynamic primer and protocol schema on both sides.");
console.log("Baseline: legacy WORLD and duplicate schema. Counts include response_format schema on BOTH sides; chars/4 is an estimate, not billed tokens.");
console.log("| Operation | System chars before → after | User chars before → after | Total chars before → after | Reduction | Approx. tokens before → after (chars/4) |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const row of rows) {
  const before = size(row.kind, row.before, row.schema, c.primer, true);
  const after = size(row.kind, row.after, row.schema, c.primer);
  console.log(`| ${row.name} | ${before.system} → ${after.system} | ${before.user} → ${after.user} | ${before.total} → ${after.total} | ${((1 - after.total / before.total) * 100).toFixed(1)}% | ${Math.ceil(before.total / 4)} → ${Math.ceil(after.total / 4)} |`);
}
