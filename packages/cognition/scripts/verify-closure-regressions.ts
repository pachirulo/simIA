/** Offline counterfactual against the preserved HEAD source and current code.
 * Requires the read-only preplan checkout prepared in the closure study. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { contexts } from "../test/fixtures.ts";
import { incoherentMeal, malformedFlour, substitutedBread, misattributedRumor, inventedDebt, inventedMeal } from "../test/fixtures/coherence.ts";

const study = resolve(import.meta.dirname, "../out/plan-closure-20260918");
const fetchBefore = globalThis.fetch;
const results: unknown[] = [];
try {
  for (const variant of ["preplan", "current"]) {
    const source = variant === "preplan" ? resolve(study, "preplan/src/openrouter.ts") : resolve(import.meta.dirname, "../src/openrouter.ts");
    const { OpenRouterBrain } = await import(pathToFileURL(source).href);
    for (const [name, replies] of Object.entries({ R1: [incoherentMeal], R2: [malformedFlour, substitutedBread], R3: [misattributedRumor], R4a: [inventedMeal], R4b: [inventedDebt] })) {
      const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez";
      c.perception.recent = []; c.perception.self.inventory = ["bread"];
      c.perception.place.id = name === "R2" ? "mill" : "inn";
      c.perception.place.for_sale = [{ item: "bread", price: 1 }, { item: "flour", price: 1 }];
      c.reflect.actionEvidence = []; c.reflect.dayMemories = []; c.reflect.keyMemories = []; c.reflect.desireEvidence = [];
      let calls = 0;
      globalThis.fetch = async () => {
        const content = replies[Math.min(calls++, replies.length - 1)];
        return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] }));
      };
      const brain = new OpenRouterBrain({ apiKey: "offline-test", allowFallback: false, logGeneration: false });
      let value: unknown = null, error: string | null = null;
      try { value = name === "R3" ? await brain.converse(c.converse) : name === "R4b" ? await brain.reflect(c.reflect) : await brain.decide(c.perception, c.a, 1); }
      catch (err) { error = String(err); }
      results.push({ variant, name, calls, delivered: value !== null, value, error });
    }
  }
} finally { globalThis.fetch = fetchBefore; }
const report = { mode: "offline controlled HTTP; synthetic fixtures, HEAD versus current; same current engine/pack", results };
writeFileSync(resolve(study, "critical-regressions.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
