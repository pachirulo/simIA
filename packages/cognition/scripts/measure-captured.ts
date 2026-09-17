/** Offline comparison of a captured decide request; arguments: user-message.json system-message.json. */
import { readFileSync } from "node:fs";
import { Perception } from "@unwatched/protocol";
import { z } from "zod";
import { decidePrompt } from "../src/context/decide.ts";
import { DECIDE_SYSTEM, decideRules } from "../src/prompts/decide.ts";
import { actionProposalSchema } from "../src/schema/action.ts";
import { cleanSchema } from "../src/schema/json.ts";
import { buildMessages } from "../src/provider/openrouter.ts";

const [userFile, systemFile] = process.argv.slice(2);
if (!userFile || !systemFile) throw new Error("Pass user and system JSON capture paths");
const user = JSON.parse(readFileSync(userFile, "utf8")) as { content: string };
const system = JSON.parse(readFileSync(systemFile, "utf8")) as { content: { text: string }[] };
const perception = Perception.parse(JSON.parse(user.content.slice(user.content.lastIndexOf("\n\n") + 2)));
const schema = JSON.stringify(cleanSchema(z.toJSONSchema(actionProposalSchema(perception))));
const mechanics = decideRules(perception);
const afterUser = (mechanics ? `Mechanics relevant here:\n${mechanics}\n\n` : "") + decidePrompt(perception);
const after = buildMessages({ shared: DECIDE_SYSTEM, own: system.content.slice(1).map(b => b.text).join("\n") }, afterUser);
const beforeSystem = system.content.reduce((s, b) => s + b.text.length, 0);
const afterSystem = (after[0]!.content as { text: string }[]).reduce((s, b) => s + b.text.length, 0);
const beforeTotal = beforeSystem + user.content.length + schema.length;
const afterTotal = afterSystem + afterUser.length + schema.length;
console.log(JSON.stringify({ units: "characters, not provider tokens; response_format schema counted in both totals", before: { system: beforeSystem, user: user.content.length, schema: schema.length, total: beforeTotal }, after: { system: afterSystem, user: afterUser.length, schema: schema.length, total: afterTotal }, reductionPercent: (1 - afterTotal / beforeTotal) * 100, perceptionPreserved: JSON.stringify(JSON.parse(afterUser.slice(afterUser.lastIndexOf("\n\n") + 2))) === JSON.stringify(perception) }, null, 2));
