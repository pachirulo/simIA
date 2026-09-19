/** Offline replay of original outputs and selected evidence; no provider calls.
 * Optional argument: pre-change src snapshot, for a fixed-input comparison. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ActionProposal, Dialogue } from "@unwatched/protocol";
import { kaka, kakaReflection, kakaPerception } from "../test/fixtures/kaka.ts";
import { contexts } from "../test/fixtures.ts";
import { reflectionForDiagnostics } from "../src/schema/reflection.ts";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";

const snapshot = process.argv[2];
const previous = snapshot ? {
  reflectionIssue: (await import(pathToFileURL(resolve(snapshot,"semantics/lifecycle.ts")).href)).reflectionIssue,
  decisionIssue: (await import(pathToFileURL(resolve(snapshot,"semantics/decision.ts")).href)).decisionIssue,
  dialogueIssue: (await import(pathToFileURL(resolve(snapshot,"semantics/dialogue.ts")).href)).dialogueIssue,
} : null;
const current = {reflectionIssue, decisionIssue, dialogueIssue};
const rows = kaka.cases.map(row => {
  const check = (validators: typeof current) => {
    if(row.kind === "reflection") {
      const out = reflectionForDiagnostics(row.output);
      return out ? validators.reflectionIssue(out,kakaReflection(row.callId)) : {code:"schema_mismatch"};
    }
    if(row.kind === "action_proposal") {
      const out = ActionProposal.parse(normalizeOptionalStrings(row.output,ActionProposal));
      return validators.decisionIssue(out,kakaPerception(row.callId),row.name);
    }
    const ctx=contexts().converse, data=row.context;
    if(!data.public || !data.system) throw Error("Missing public dialogue context");
    for(const side of ["a","b"] as const) {ctx[side].id=data.public[side].id;ctx[side].persona.name=data.public[side].name;ctx[side].arrivedAt=360;}
    ctx.time=/day \d+ \d+:\d+/u.exec(data.system)?.[0]??"unknown";
    ctx.aMemories=ctx.bMemories=[];
    const out=Dialogue.safeParse(row.output);
    return out.success?validators.dialogueIssue(out.data,ctx):{code:"not_json_or_schema"};
  };
  return {id:row.id,call:row.callId,attempt:row.attempt,agent:row.name,kind:row.kind,...(previous?{before:check(previous)}:{}),after:check(current)};
});
console.log(JSON.stringify({source:kaka.source,method:kaka.method,
  limits:"Offline validator/component comparison, not a new simulation or model repair success rate. Reflection uses the provider's diagnostic normalizer. Role supplements are tested separately, not inserted into original selected evidence. Dialogue private aMemories/bMemories were not captured: empty in this reconstruction; speech attribution still checks the generated lines. Arrival time 360 is confirmed by original engine events.",rows},null,2));
