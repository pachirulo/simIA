/** Mechanical counters only. Semantic labels are reviewed separately; never
 * equate a validator's acceptance/rejection with audited model correctness. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../out/plan-closure-20260918");
const read = (file: string): any[] => existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
const runs: unknown[] = [], review: unknown[] = [];
for (const variant of ["baseline", "final", "corrected"]) for (const seed of [84, 85, 86]) {
  const dir = resolve(root, `${variant}-runs/seed${seed}`), file = resolve(dir, "summary.json");
  if (!existsSync(file)) continue;
  const summary = JSON.parse(readFileSync(file, "utf8")), inputs = read(resolve(dir, "inputs.jsonl")), outputs = read(resolve(dir, "outputs.jsonl"));
  const events = read(resolve(dir, "events.jsonl")), usage = read(resolve(dir, "usage.jsonl"));
  const diagnostics = readFileSync(resolve(dir, "provider.log"), "utf8").split("\n").flatMap(line => {
    const m = /^openrouter (\w+) (\{.*\})$/u.exec(line); return m ? [{ event: m[1], ...JSON.parse(m[2]!) }] : [];
  });
  const decisions = new Map<string, any>();
  let repetitions = 0, repetitionsWithChange = 0;
  for (const out of outputs) {
    const supplied = inputs.find(input => input.id === out.id)?.input;
    const p = out.kind === "decide" ? supplied?.[0] : null;
    if (p && !out.fallback) {
      const previous = decisions.get(p.agent_id);
      if (previous && JSON.stringify(previous.action) === JSON.stringify(out.result.action)) {
        repetitions++;
        const state = (value: any) => [value.self.location, value.self.coins, value.self.job, value.self.inventory];
        if (JSON.stringify(state(p)) !== JSON.stringify(state(previous.p)) || p.self.needs.hunger < previous.p.self.needs.hunger) repetitionsWithChange++;
      }
      decisions.set(p.agent_id, { p, action: out.result.action });
    }
    review.push({ key: `${variant}/${seed}/${out.id}`, kind: out.kind, t: out.t, fallback: out.fallback ?? null, result: out.result,
      input: supplied, semanticReview: "unreviewed" });
  }
  const validations = diagnostics.filter(d => d.event === "validation" && d.kind !== "paper");
  const rejections = validations.filter(d => !["accepted"].includes(d.status));
  const repairs = diagnostics.filter(d => d.event === "repair_comparison");
  runs.push({ ...summary, outputs: outputs.length, acceptedModelOutputs: outputs.filter(out => !out.fallback && !out.error).length,
    outputsByKind: Object.fromEntries(["plan", "decide", "converse", "reflect"].map(kind => [kind, outputs.filter(out => out.kind === kind).length])),
    rejections: rejections.length, rejectionsByStatus: Object.fromEntries([...new Set(rejections.map(d => d.status))].map(status => [status, rejections.filter(d => d.status === status).length])),
    actionRepairs: repairs.map(d => ({ status: d.status, changed: d.changed })),
    responseCount: usage.length, unknownCostResponses: usage.filter(u => u.costUsd === null).length,
    transportErrors: diagnostics.filter(d => ["http_error", "transport_error"].includes(d.event)).length,
    repetitions: { numerator: repetitions, denominator: outputs.filter(out => out.kind === "decide" && !out.fallback).length, withObservedChange: repetitionsWithChange, attribution: "unknown; changes can be habits or others" },
    worldEvents: Object.fromEntries([...new Set(events.map(e => e.kind))].map(kind => [kind, events.filter(e => e.kind === kind).length])),
    meanOperationLatencyMs: outputs.reduce((sum, out) => sum + out.elapsedMs, 0) / outputs.length,
  });
}
writeFileSync(resolve(root, "counters.json"), JSON.stringify({ note: "Mechanical counters, not semantic quality labels. paper excluded from semantic review but included in billed usage.", runs }, null, 2));
writeFileSync(resolve(root, "audit-review.json"), JSON.stringify(review, null, 2));
console.log(JSON.stringify(runs));
