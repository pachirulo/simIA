/** Manual review labels for this fixed sample. No production validator is used
 * here. Regenerates counts, keeps unknowns and never rewrites the original runs. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../out/plan-closure-20260918");
const rows = JSON.parse(readFileSync(resolve(root, "audit-review.json"), "utf8")) as any[];
const findings: Record<string, { category: string; evidence: string; disposition: string }> = {
  "baseline/84/19": { category: "physical_contradiction", evidence: "Says he has not seen the bakery; event 43 at minute 1020 records Petar reaching it. Negative historical claims are not generally checked.", disposition: "open: negative history versus visited-place evidence" },
  "baseline/85/11": { category: "memory_meaning", evidence: "Petar says he may take Rosa up on the offer; b_remember says he declined the favour.", disposition: "open: paraphrase of acceptance and refusal" },
  "baseline/85/13": { category: "misattribution", evidence: "Selected transcript has Petar introducing the no-local-flour claim; remember attributes it to Rosa.", disposition: "fixed offline: attribution.ts; regression and recorded replay" },
  "baseline/86/4": { category: "physical_contradiction", evidence: "At the inn, proposes moving to the bakery and already remembers having walked there; no prior trip in selected context or earlier events.", disposition: "fixed offline: walked to; regression and recorded replay" },
  "final/85/4": { category: "intent_action", evidence: "Intent selects soup for two coins; bare trade buys bread for one (event 9).", disposition: "fixed before corrected arm: explicit purchase item check" },
  "final/85/6": { category: "intent_action", evidence: "Again selects soup with bare trade; event 13 buys bread for one.", disposition: "fixed before corrected arm: explicit purchase item check" },
  "corrected/84/7": { category: "physical_contradiction", evidence: "At minute 540, still at inn; remembers setting out for council inside the proposal to leave.", disposition: "fixed offline after arm loaded: set out from" },
  "corrected/85/13": { category: "memory_meaning", evidence: "Petar is looking for his brother; a_remember reverses it to the brother looking for Petar.", disposition: "fixed offline after arm loaded: dialogue_relation_reversed" },
  "corrected/86/9": { category: "intent_action", evidence: "At market, action.do narrates I should head to council; emitted deed passes time without dispatching that journey.", disposition: "fixed offline after arm loaded: direct journey inside free deed" },
  "corrected/86/13": { category: "physical_contradiction", evidence: "At minute 840 still at inn; action.move targets market while remember says walked from inn to market at 14:00.", disposition: "fixed offline after arm loaded: walked from" },
};
const unknown: Record<string, string> = {
  "baseline/85/18": "The unqualified no-local-flour belief repeats personal speech; its world truth is not established by a shelf/event receipt.",
  "final/85/10": "Memory expands at my place to his bakery. Shared world primer suggests the association, but the utterance itself does not establish ownership.",
  "corrected/84/5": "Trip to harbor is true in world events, but selected observations lack an explicit travel receipt; current checker conservatively rejects it.",
};
const labels = rows.map(row => ({ key: row.key, kind: row.kind,
  status: row.fallback ? "fallback_not_model_success" : findings[row.key] ? "confirmed_finding" : unknown[row.key] ? "unknown" : "no_confirmed_finding_in_review",
  ...(findings[row.key] ?? {}), ...(unknown[row.key] ? { uncertainty: unknown[row.key] } : {}),
  scope: "Review of accepted output against its supplied context/transcript and recorded world events; not a proof for every paraphrase or hidden fact.",
}));
const metrics = ["baseline", "final", "corrected"].map(variant => {
  const sample = labels.filter(row => row.key.startsWith(variant + "/"));
  const accepted = sample.filter(row => row.status !== "fallback_not_model_success");
  return { variant, operations: sample.length, acceptedOutputs: accepted.length,
    fallbacks: sample.length - accepted.length, unknownOutputs: accepted.filter(row => row.status === "unknown").length,
    confirmedFindings: accepted.filter(row => row.status === "confirmed_finding").length,
    byCategory: Object.fromEntries(["intent_action", "misattribution", "physical_contradiction", "memory_meaning"].map(category => [category,
      { numerator: accepted.filter(row => row.category === category).length, denominator: accepted.length, denominatorMeaning: "accepted outputs, not individual claims" }])),
    effectiveObligationScenarios: { numerator: 0, denominator: 0, meaning: "No independently verified informal settlement scenario in these day runs. See controlled integration tests; do not infer success from zero exposure." },
  };
});
writeFileSync(resolve(root, "manual-audit.json"), JSON.stringify({ reviewer: "Codex source/transcript/event review; independent of production validator decisions", labels, metrics }, null, 2));
console.log(JSON.stringify(metrics));
