import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Reflection } from "@unwatched/protocol";
import { Town } from "@unwatched/engine";
import { z } from "zod";
import { ponchoCase, ponchoPerception, ponchoReflection } from "./fixtures/poncho.ts";
import { contexts } from "./fixtures.ts";
import { groundedClaimIssue, observedRecords } from "../src/semantics/evidence.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { reflectionIssue, planIssue } from "../src/semantics/lifecycle.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { institutionIssue, perceivedMayor } from "../src/semantics/institution.ts";
import { speechMemoryIssue } from "../src/semantics/speech-memory.ts";
import { normalizeReflection, reflectionSchema } from "../src/schema/reflection.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { MockBrain } from "../src/mock.ts";

const blank = (summary: string): Reflection => ({ summary, insights: [], opinions: [], intentions: [], letter_to_owner: null });
const petar = "gen-1789760274-ehVDJm69WCVH6AznvH4P";
const purchase = "gen-1789760208-83WfGZQ9an7vQJhbtXhm";
const purchaseRepair = "gen-1789760210-1JbptjOb2DkyWDAMsKgz";
const missingBread = "gen-1789760196-FK8EGnmWlKL9Ims810tb";
afterEach(() => vi.unstubAllGlobals());

describe("Poncho: initial state, separate receipts and bounded compound claims", () => {
  it.each([
    "I arrived on the boat with 40 coins and three nights paid at the inn.",
    "I arrived this morning with forty coins and three nights paid.",
    "I arrived with forty coins and three nights paid at the harbor inn. I still have two nights paid at the inn.",
  ])("recognizes each backed component without asserting a personal transfer: %s", text => {
    expect(reflectionIssue(blank(text), ponchoReflection("ag_2"))).toBeNull();
  });
  it.each([
    "I arrived on the boat with 90 coins and three nights paid at the inn.",
    "I arrived on the boat with 40 coins and nine nights paid at the inn.",
    "I arrived on the boat with 40 coins and three nights paid at the mill.",
    "I still have three nights paid at the inn.",
    "I paid for three nights at the inn.",
  ])("keeps quantity, place, current state and payment constraints: %s", text => {
    expect(reflectionIssue(blank(text), ponchoReflection("ag_2"))).not.toBeNull();
  });
  it("accepts the authentic compound arrival/meal/hiring summary from Petar's repair", () => {
    const out = Reflection.parse(ponchoCase(petar).output);
    expect(groundedClaimIssue(out.summary, "summary", reflectionEvidence(ponchoReflection("ag_2")).claims)).toBeNull();
  });
  it("separates eating from a wage, requiring receipts for both and preserving explicit chronology", () => {
    const ctx = ponchoReflection("ag_2"), evidence = reflectionEvidence(ctx).claims;
    expect(groundedClaimIssue("I ate soup for 2, and got taken on as help at the inn for 2 coins a shift.", "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I ate soup for 2, then got taken on as help at the inn for 2 coins a shift.", "summary", evidence)?.code).toBe("memory_event_order");
    expect(groundedClaimIssue("I got taken on as help at the inn for 2 coins a shift, then ate soup for 2.", "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I ate soup for 9.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate soup for 2.", "summary", { ...evidence, records: evidence.records.filter(r => r.kind !== "agent.eat") })?.code).toBe("memory_unverified_outcome");
  });
  it("resolves bowl of soup only with a purchase receipt, and hunger relief requires consumption", () => {
    const p = ponchoPerception(purchase);
    expect(p.self.inventory).toContain("soup"); expect(p.self.coins).toBe(38);
    expect(p.recent.some(s => s.includes("bought soup"))).toBe(false);
    expect(decisionIssue(ActionProposal.parse(ponchoCase(purchaseRepair).output), p, "Petar Ilić")?.code).toBe("memory_unverified_outcome");
    const evidence = { records: observedRecords(["[event 16, minute 480, agent.trade] Petar Ilić bought soup for 2."]), selfNames: ["Petar Ilić"] };
    // Counterfactual control: the historical decision did NOT receive this receipt.
    expect(groundedClaimIssue("I bought a bowl of soup at the inn for 2 coins.", "memory", evidence)).toBeNull();
    expect(groundedClaimIssue("I bought a bowl of soup, easing my hunger.", "memory", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I bought two bowls of soup.", "memory", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I bought a bowl of fish soup.", "memory", evidence)?.code).toBe("memory_unverified_outcome");
  });
  it.each(["I bought soup and bread. I ate both.", "I bought soup and bread, and I ate them both."])("resolves a local plural reference using independent eat receipts: %s", text => {
    const evidence = reflectionEvidence(ponchoReflection("ag_2")).claims;
    expect(groundedClaimIssue(text, "summary", evidence)).toBeNull();
    expect(groundedClaimIssue(text, "summary", { ...evidence, records: evidence.records.filter(r => r.kind !== "agent.eat" || !r.text.includes("bread")) })?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate both.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
  });
  it("requires distinct events for two portions, not duplicate receipts or an ambiguous actor", () => {
    const events = ["[event 1, minute 480, agent.trade] Petar Ilić bought soup for 2.", "[event 2, minute 540, agent.trade] Petar Ilić bought soup for 2.",
      "[event 3, minute 600, agent.eat] Petar Ilić ate soup.", "[event 4, minute 660, agent.eat] Petar Ilić ate soup."];
    const evidence = { records: observedRecords(events), selfNames: ["Petar Ilić"] };
    expect(groundedClaimIssue("I bought two bowls of soup. I ate both.", "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I bought two bowls of soup. I ate both.", "summary", { ...evidence, records: observedRecords([...events.slice(0, 3), events[2]!]) })?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I bought soup and bread. Rosa ate both.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
  });
  it("does not infer a past trip from present location or the initial boat arrival", () => {
    const p = ponchoPerception(missingBread), evidence = { records: observedRecords(p.recent), selfNames: ["Ivana Horvat"] };
    expect(p.place.id).toBe("inn"); expect(p.nearby[0]!.name).toBe("Rosa Vidal");
    expect(groundedClaimIssue("I arrived at the inn and saw Rosa Vidal here.", "memory", evidence)?.code).toBe("memory_unverified_outcome");
    // Separate counterfactual: with the selected move receipt, arrival is backed.
    expect(groundedClaimIssue("I arrived at the inn.", "memory", { ...evidence, records: observedRecords(["[event 8, minute 360, agent.move] Ivana Horvat went to the harbor inn."]) })).toBeNull();
  });
});

describe("Poncho: schema and repair without extra attempts", () => {
  it("normalizes only absent optional identity and rejects aliases/overlong references", () => {
    const ctx = ponchoReflection("ag_1"), schema = reflectionSchema(ctx);
    const raw = { ...blank("I am curious."), self: null };
    expect(schema.safeParse(normalizeReflection(raw)).success).toBe(true); expect(raw.self).toBeNull();
    for (const fields of [{ opinionChanges: [] }, { letter: null }, { projects: [{ title: "Some goal", status: "done" }] },
      { projects: [{ title: "Some goal", standing: "Started" }] }, { beliefs: [{ about: "inn", belief: "Calm", sureness: .5 }] },
      { beliefs: [{ about: "a".repeat(61), belief: "Calm", confidence: .5 }] }]) {
      expect(schema.safeParse(normalizeReflection({ ...blank("Calm."), ...fields })).success).toBe(false);
    }
    expect(schema.safeParse({ summary: "Calm." }).success).toBe(false);
    expect(z.toJSONSchema(schema).additionalProperties).toBe(false);
  });
  it("gives the one repair exact keys, reference limits and semantic diagnostics despite missing mandatory fields", async () => {
    const requests: { messages: { content: string }[] }[] = [];
    const bad = { ...ponchoCase("gen-1789760250-ckVdIdetcxEnsFWdNzNY").output, summary: "I paid Petar ten coins." };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? bad : blank("I am still learning.")) } }] }));
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(ponchoReflection("ag_1"))).toEqual(blank("I am still learning.")); expect(requests).toHaveLength(2);
    const note = requests[1]!.messages.at(-1)!.content;
    expect(note).toContain("about: a short topic/name <=60 characters"); expect(note).toContain("letter_to_owner");
    expect(note).toContain("status, standing or sureness"); expect(note).toContain("I paid Petar ten coins");
    expect(buildReflectContext(ponchoReflection("ag_1")).user).toContain("Do not copy a full belief into about");
  });
  it("uses one response for otherwise valid self:null and does not loosen canonical Reflection", async () => {
    const raw = { ...blank("I am curious."), self: null };
    expect(Reflection.safeParse(raw).success).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(raw) } }] }))));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(ponchoReflection("ag_3"))).toEqual(blank("I am curious.")); expect(brain.usage().calls).toBe(1);
  });
  it("reports the missing bread immediately alongside the unrelated memory, preserving the operation", async () => {
    const use = "gen-1789760230-KVuFZDShMEekKPunV4iq";
    const useIssue = decisionIssue(ActionProposal.parse(ponchoCase(use).output), ponchoPerception(use), "Ivana Horvat");
    expect(useIssue?.code).toBe("use_not_carried"); expect(useIssue?.message).toContain("action.buy");
    const p = ponchoPerception(missingBread), out = ActionProposal.parse(ponchoCase(missingBread).output);
    const invalid = decisionIssue(out, p, "Ivana Horvat");
    expect(invalid?.code).toBe("trade_item_intent_mismatch"); expect(invalid?.message).toContain('action.buy to "bread"'); expect(invalid?.message).toContain("Also fix remember[0]");
    const requests: { messages: { content: string }[] }[] = [];
    const repaired = { ...out, action: { kind: "trade", with: "inn", buy: "bread" }, remember: [] };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? out : repaired) } }] }));
    }));
    const c = contexts(); c.a.persona.name = "Ivana Horvat";
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(p, c.a, 1)).toEqual(repaired);
    expect(requests).toHaveLength(2); expect(requests[1]!.messages.at(-1)!.content).toContain('action.buy to "bread"');
  });
  it("keeps a repeated invalid trade as a fallback instead of silently supplying buy", async () => {
    const out = ActionProposal.parse(ponchoCase(missingBread).output);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(out) } }] }))));
    const c = contexts(), brain = new OpenRouterBrain({ apiKey: "test" });
    expect(isFromFallback(await brain.decide(ponchoPerception(missingBread), c.a, 1))).toBe(true); expect(brain.usage().calls).toBe(2);
  });
});

describe("Poncho: biography and pre-execution speech", () => {
  it("keeps aspirations/history and requires separate support for present incumbency", () => {
    for (const text of ["A second term as mayor.", "I want to become mayor.", "I used to be mayor.", "Keep my former mayor's reputation intact."]) expect(institutionIssue(text, "self", false)).toBeNull();
    expect(institutionIssue("I am the mayor.", "self", false)?.code).toBe("institutional_role_unverified");
    expect(institutionIssue("I'm the mayor.", "self", false)?.code).toBe("institutional_role_unverified");
    expect(institutionIssue("As mayor I will spend the treasury.", "intent", null)?.code).toBe("institutional_role_unverified");
    expect(institutionIssue("I am the mayor.", "self", true)).toBeNull();
    const p = ponchoPerception(missingBread); expect(perceivedMayor(p, "Ivana Horvat")).toBeNull();
    p.place.council = { mayor: "Rosa Vidal", treasury: 0, works: [], can_fund: [], open_laws: [] };
    expect(perceivedMayor(p, "Ivana Horvat")).toBe(false);
    expect(reflectionIssue(blank("I am the mayor."), ponchoReflection("ag_1"))).toBeNull();
    expect(reflectionIssue({ ...blank("I am curious."), self: { summary: "I am the mayor." } }, ponchoReflection("ag_3"))?.code).toBe("institutional_role_unverified");
    const c = contexts(); expect(planIssue({ mood: "I am the mayor.", goals: [], steps: [] }, c.plan)?.code).toBe("institutional_role_unverified");
  });
  it("does not certify said hello from the current proposal or another speaker's utterance", () => {
    const row = ponchoCase("gen-1789760196-cXbrsLAVmbYwhbmaMbbu");
    expect(decisionIssue(ActionProposal.parse(normalizeOptionalStrings(row.output, ActionProposal)), ponchoPerception(row.id), "Rosa Vidal")?.code).toBe("memory_unexecuted_speech");
    expect(speechMemoryIssue("Said hello to Ivana.", "remember[0]", [])?.code).toBe("memory_unexecuted_speech");
    expect(speechMemoryIssue("I intend to say hello to Ivana.", "remember[0]", [])).toBeNull();
    expect(speechMemoryIssue("I said to Ivana: \"Hello\".", "remember[0]", ['[minute 420; recorded observation; quoted claims remain claims] I said to Ivana: "Hello"'])).toBeNull();
    expect(speechMemoryIssue("I said to Petar: \"Hello\".", "remember[0]", ['[minute 420; recorded observation; quoted claims remain claims] I said to Ivana: "Hello"'])?.code).toBe("memory_unexecuted_speech");
    expect(speechMemoryIssue("Said hello to Ivana.", "remember[0]", ['[minute 420; personal interpretation, not verified experience] I said to Ivana: "Hello"'])?.code).toBe("memory_unexecuted_speech");
  });

  it("does not persist a proposed greeting when the real world rejects say after the target leaves", async () => {
    const c = contexts(), driver = new MockBrain(42), model = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    const logs: string[] = [];
    const town = new Town({ seed: 42, brain: driver, log: line => logs.push(line) });
    const a = town.addAgent({ persona: { ...c.a.persona, name: "Rosa Vidal" } });
    const b = town.addAgent({ persona: { ...c.b.persona, name: "Ivana Horvat" } });
    a.location = b.location = "inn";
    town.t = 420; a.thinkEvery = b.thinkEvery = 1;
    a.plan = b.plan = { day: town.day, mood: "quiet", goals: [], steps: [] };
    driver.plan = async () => ({ mood: "quiet", goals: [], steps: [] });
    driver.decide = (p, agent, tier) => agent.id === a.id ? model.decide(p, agent, tier) : Promise.resolve({ action: { kind: "wait" }, remember: [] });
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      const out = { action: { kind: "say", to: b.id, text: "Hello" }, intent: "Say hello to Ivana.", remember: calls === 1 ? ["Said hello to Ivana."] : [] };
      if (calls === 2) b.location = "mill"; // race after the supplied perception
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(out) } }] }));
    }));
    await town.tick();
    expect(calls, logs.join("\n")).toBe(2);
    expect(town.events.some(e => e.kind === "action.rejected" && e.actors.includes(a.id))).toBe(true);
    expect(town.events.some(e => e.kind === "agent.say" && e.actors[0] === a.id)).toBe(false);
    expect(a.memory.some(m => /said hello|I said.*Hello/iu.test(m.text))).toBe(false);
  });
});
