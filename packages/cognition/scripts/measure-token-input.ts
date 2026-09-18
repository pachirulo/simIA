import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Perception, ActionProposal } from "@unwatched/protocol";
import { compactDecidePrompt } from "../src/context/decide.ts";
import { DECIDE_SYSTEM, decideRules } from "../src/prompts/decide.ts";
import { compactActionSchema } from "../src/schema/compact.ts";
import { cleanSchema } from "../src/schema/json.ts";

/** Replays captured INPUTS offline, never the world or the LLM. Export exact text
 * for an external tokenizer; chars/4 is deliberately not called billed tokens.
 * Run with a baseline capture from capture-requests.mjs and an output JSON path.
 */
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: tsx scripts/measure-token-input.ts <before.jsonl> <output.json>");
const capture = readFileSync(input, "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
const canonical = cleanSchema(z.toJSONSchema(ActionProposal));
const measurements = capture.filter(row => row.phase === "request" && row.body.response_format.json_schema.name === "action_proposal").map(row => {
  const body = row.body;
  const user: string = body.messages[1].content;
  const boundary = user.lastIndexOf("\n\n");
  const rawPerception = JSON.parse(user.slice(boundary + 2));
  // Validate without using the parsed copy: retain serialization order and every field.
  Perception.parse(rawPerception);
  const p = rawPerception as Perception;
  const beforeSystem: string = body.messages[0].content[0].text;
  const prefixEnd = beforeSystem.indexOf("\n\nAnswer with a single JSON object");
  // This benchmark's headless runner has no primer. Reject unexpected captures so
  // an opaque production primer can never silently disappear from the comparison.
  if (prefixEnd < 0 || beforeSystem.slice(0, prefixEnd).includes("\n\n")) throw new Error("Expected a headless capture without primer");
  const beforeMechanicsEnd = user.indexOf("\n\n");
  const mechanics = decideRules(p);
  return {
    id: row.id,
    before: {
      base: beforeSystem,
      persona: body.messages[0].content[1]?.text ?? "",
      mechanics: user.startsWith("Mechanics relevant here:") ? user.slice(0, beforeMechanicsEnd + 2) : "",
      instructions: user.slice(user.startsWith("Mechanics relevant here:") ? beforeMechanicsEnd + 2 : 0, boundary + 2),
      perception: user.slice(boundary + 2),
      schema: JSON.stringify(body.response_format.json_schema.schema),
    },
    after: {
      base: DECIDE_SYSTEM + beforeSystem.slice(prefixEnd),
      persona: body.messages[0].content[1]?.text ?? "",
      mechanics: mechanics ? "Mechanics relevant here:\n" + mechanics + "\n\n" : "",
      instructions: compactDecidePrompt(p).slice(0, -JSON.stringify(p).length),
      perception: JSON.stringify(p),
      schema: JSON.stringify(compactActionSchema(canonical)),
    },
    // These are SUBSETS of perception, not additive blocks.
    perceptionFields: Object.fromEntries(Object.entries(p).map(([key, value]) => [key, JSON.stringify(value)])),
  };
});
writeFileSync(output, JSON.stringify(measurements, null, 2), "utf8");
console.log(`Measured ${measurements.length} frozen action_proposal inputs; no network calls.`);
