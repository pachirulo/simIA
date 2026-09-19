/** Offline recheck of previously rejected physical claims, using exactly their
 * supplied event records. Does not regenerate responses or claim a new run.
 * tsx .../audit-grounding.ts <new-report.json> <completed-run-dir> [...]
 * Observation-only support and other validators are outside this narrow audit. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { groundedClaimIssue, observedRecords, type EvidenceRecord } from "../src/semantics/evidence.ts";

interface Log {
  event: string; callId: string; id?: string; attempt: number; agentId: string;
  kind: string; status?: string; issue?: { code: string; path: string };
  body?: { messages: { role: string; content: unknown }[] };
  response?: { choices: { message: { content: string } }[] };
}
const target = process.argv[2];
const dirs = process.argv.slice(3);
if (!target || !dirs.length) throw new Error("Requires <new-report.json> <completed-run-dir> [...]");
if (existsSync(target)) throw new Error("Choose a new report; never overwrite previous evidence.");
const reports: unknown[] = [];
let checked = 0, stillRejected = 0;
for (const dir of dirs) {
  const summary = JSON.parse(readFileSync(resolve(dir, "summary.json"), "utf8")) as { citizens: { id: string; name: string }[] };
  const logs: Log[] = readFileSync(resolve(dir, "provider.jsonl"), "utf8").split(/\r?\n/u).flatMap(line => {
    const match = /^openrouter (\w+) (\{.*\})$/u.exec(line);
    return match ? [{ event: match[1]!, ...JSON.parse(match[2]!) }] : [];
  });
  for (const log of logs.filter(l => l.event === "validation" && l.kind === "reflection" && l.issue?.code === "memory_unverified_outcome")) {
    const request = logs.find(l => l.event === "request" && l.callId === log.callId && l.attempt === log.attempt);
    const response = logs.find(l => l.event === "response" && l.id === log.id);
    const name = summary.citizens.find(c => c.id === log.agentId)?.name;
    const user = request?.body?.messages.find(m => m.role === "user")?.content;
    const content = response?.response?.choices[0]?.message.content;
    if (!name || typeof user !== "string" || !content) throw new Error(`Missing captured context for ${log.id}`);
    const personal = user.match(/Personal experience records for desire changes: (\[.*\])\./u)?.[1];
    const records: EvidenceRecord[] = observedRecords(user.match(/^\[event .+$/gmu) ?? []);
    if (personal) records.push(...(JSON.parse(personal) as { id: number; kind: string; text: string }[]).map(e => ({ ...e, source: "event" as const })));
    let claim: unknown = JSON.parse(content);
    for (const key of log.issue!.path.replace(/\[(\d+)\]/gu, ".$1").split(".")) {
      claim = claim && typeof claim === "object" ? Reflect.get(claim, key) : undefined;
    }
    if (typeof claim !== "string") throw new Error(`Captured claim path unavailable: ${log.id} ${log.issue!.path}`);
    const issue = groundedClaimIssue(claim, log.issue!.path, { selfNames: [name, name.split(" ")[0]!], records });
    checked++; if (issue) stillRejected++;
    reports.push({ run: dir, generation: log.id, field: log.issue!.path, claim, before: log.issue!.code, after: issue?.code ?? null, suppliedEvents: records });
  }
}
const report = { scope: "Offline event-only recheck of previously rejected text fields; not whole-response acceptance or an independent truth audit", checked, stillRejected, noLongerRejected: checked - stillRejected, reports };
writeFileSync(target, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checked, stillRejected, noLongerRejected: checked - stillRejected, report: target }));
