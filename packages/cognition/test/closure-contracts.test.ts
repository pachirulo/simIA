import { afterEach, expect, it, vi } from "vitest";
import { contexts } from "./fixtures.ts";
import { buildConverseContext, sharedSpeech } from "../src/context/converse.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import type { Action } from "@unwatched/protocol";
import { Reflection } from "@unwatched/protocol";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";

afterEach(() => vi.unstubAllGlobals());
const check = (action: Action, p = contexts().perception) => decisionIssue({ action, remember: [] }, p);

it("withholds both biographies, secrets and private state from the shared writer", async () => {
  const c = contexts();
  for (const agent of [c.a, c.b]) {
    agent.persona = { ...agent.persona, summary: "PRIVATE_BIOGRAPHY", secret: "PRIVATE_SECRET", want: "PRIVATE_WANT", fear: "PRIVATE_FEAR", voice: ["PRIVATE_VOICE"] };
    agent.inventory = ["PRIVATE_ITEM"]; agent.intentions = ["PRIVATE_INTENTION"];
  }
  c.converse.aMemories = ["[observation] PRIVATE_A_MEMORY"]; c.converse.bMemories = ["[observation] PRIVATE_B_MEMORY"];
  c.converse.rumorsA = ["PRIVATE_RUMOR"]; c.converse.aToday = "PRIVATE_PLAN";
  const before = structuredClone(c.converse);
  expect(JSON.stringify(buildConverseContext(c.converse))).not.toContain("PRIVATE_");
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "bad json" }, finish_reason: "stop" }] }));
  }));
  const result = await new OpenRouterBrain({ apiKey: "test" }).converse(c.converse);
  expect(bodies).toHaveLength(2);
  expect(JSON.stringify(bodies)).not.toContain("PRIVATE_");
  expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  expect(isFromFallback(result)).toBe(true);
  expect(c.converse).toEqual(before);
});

it("includes only explicitly shared speech with its original speaker, not shared interpretations", () => {
  const c = contexts();
  const record = `[minute 360; reported speech, not verified experience] ${c.a.persona.name}: “I can meet tomorrow.” ${c.b.persona.name}: “Maybe.”`;
  c.converse.aMemories = c.converse.bMemories = [record, "[minute 400; personal interpretation, not verified experience] PRIVATE_INTERPRETATION"];
  expect(sharedSpeech(c.converse)).toEqual([{ speaker: c.a.persona.name, text: "I can meet tomorrow." }, { speaker: c.b.persona.name, text: "Maybe." }]);
  expect(JSON.stringify(buildConverseContext(c.converse))).not.toContain("PRIVATE_INTERPRETATION");
  c.converse.bMemories = [];
  expect(sharedSpeech(c.converse)).toEqual([]);
});

it("checks local openings and current employment without treating job titles as exhaustive IDs", () => {
  const p = contexts().perception; p.self.job = null; p.place.jobs_open = [];
  expect(check({ kind: "apply" }, p)?.code).toBe("apply_no_local_opening");
  p.place.jobs_open = ["market-help"];
  expect(check({ kind: "apply", job: "help" }, p)).toBeNull();
  p.self.job = "dock-hand";
  expect(check({ kind: "apply" }, p)?.code).toBe("apply_already_employed");
  expect(check({ kind: "quit" }, p)).toBeNull();
  p.self.job = null; expect(check({ kind: "quit" }, p)?.code).toBe("quit_no_job");
});

it("checks gifts against personal resources and presence while preserving generosity", () => {
  const c = contexts(), p = c.perception; p.self.inventory = ["bread"]; p.self.coins = 5;
  expect(check({ kind: "give", to: "absent", item: "bread" }, p)?.code).toBe("give_not_present");
  expect(check({ kind: "give", to: c.b.id, item: "soup" }, p)?.code).toBe("give_not_carried");
  expect(check({ kind: "give", to: c.b.id, coins: 6 }, p)?.code).toBe("give_insufficient_coins");
  expect(check({ kind: "give", to: c.b.id, coins: 5, item: "bread" }, p)).toBeNull();
  expect(check({ kind: "give", to: c.b.id }, p)?.code).toBe("give_empty");
});

it("requires repair materials and respects explicit intact buildings and unknown damage", () => {
  const p = contexts().perception; p.self.inventory = []; p.place.broken = true;
  expect(check({ kind: "repair" }, p)?.code).toBe("repair_materials");
  p.self.inventory = ["planks", "planks"]; delete p.place.broken;
  expect(check({ kind: "repair" }, p)).toBeNull();
  p.place.broken = false; expect(check({ kind: "repair" }, p)?.code).toBe("repair_not_damaged");
  p.place.broken = true; expect(check({ kind: "repair" }, p)).toBeNull();
});

it("does not grant spending authority through a title or confuse public money with personal money", () => {
  const p = contexts().perception;
  p.place.council = { mayor: "Someone", treasury: 1000, works: [], can_fund: [], open_laws: [] };
  expect(check({ kind: "fund", what: "bridge" }, p)?.code).toBe("fund_not_authorized");
  p.place.council.can_fund = [{ what: "bridge", coins: 20 }]; p.place.council.treasury = 10;
  expect(check({ kind: "fund", what: "bridge" }, p)?.code).toBe("fund_insufficient_treasury");
  p.place.council.treasury = 20; expect(check({ kind: "fund", what: " Bridge " }, p)).toBeNull();
});

it.each([
  { summary: "I ate bread." }, { insights: ["I ate bread."] }, { intentions: ["Since I ate bread, I will rest."] },
  { beliefs: [{ about: "Dinner", belief: "I ate bread.", confidence: .5 }] },
  { projects: [{ title: "Dinner", progress: "I ate bread." }] }, { letter_to_owner: "I ate bread." },
  { saying: "I ate bread." },
])("checks physical assertions in every relevant reflection field: %j", field => {
  const c = contexts(); c.a.persona.name = "Rosa Vidal";
  c.reflect.actionEvidence = []; c.reflect.dayMemories = []; c.reflect.keyMemories = []; c.reflect.desireEvidence = [];
  const out = Reflection.parse({ summary: "I am thinking.", insights: [], intentions: [], opinions: [], letter_to_owner: null, ...field });
  expect(reflectionIssue(out, c.reflect)?.code).toBe("memory_unverified_outcome");
  c.reflect.actionEvidence = ["[event 1, minute 500, agent.eat] Rosa Vidal ate bread."];
  expect(reflectionIssue(out, c.reflect)).toBeNull();
});
