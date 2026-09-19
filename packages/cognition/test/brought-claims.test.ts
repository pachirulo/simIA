import { afterEach, describe, expect, it, vi } from "vitest";
import { TownEvent, type Reflection } from "@unwatched/protocol";
import { groundedClaimIssue, observedRecords, type ClaimContext } from "../src/semantics/evidence.ts";
import capture from "./fixtures/seed853-regressions.json";
import { contexts } from "./fixtures.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { MockBrain } from "../src/mock.ts";
import { Town } from "@unwatched/engine";

afterEach(() => vi.unstubAllGlobals());

const gift = "[event 1, minute 500, agent.give] Petar Ilić gave Rosa Vidal bread.";
const observed = (text: string) => `[minute 500; recorded observation; quoted claims remain claims] ${text}`;
const context = (...records: string[]): ClaimContext => ({ selfNames: ["Rosa Vidal"], records: observedRecords(records) });
const check = (text: string, ctx = context()) => groundedClaimIssue(text, "summary", ctx);

describe("brought claims and explicit actor identity", () => {
  it("rejects the captured seed 853 assertion despite its later concession and reported speech", () => {
    const c = contexts(); c.a.persona.name = "Rosa Vidal";
    Object.assign(c.reflect, { ...capture.evidence, desireEvidence: capture.evidence.desireEvidence.map(e => TownEvent.parse(e)) });
    const sentence = capture.reflection.output.summary.split(". ").find(text => text.startsWith("He brought"))!;
    expect(sentence).toContain("even if it's a bit stale");
    expect(check(sentence, reflectionEvidence(c.reflect).claims)?.message).toContain("actor");
  });
  it("requires evidence for carrying, without interpreting it as delivery", () => {
    expect(check("Petar brought a loaf.")?.code).toBe("memory_unverified_outcome");
    const ctx = context(observed("Petar brought a loaf."));
    expect(check("Petar brought a loaf.", ctx)).toBeNull();
    expect(check("Petar brought me a loaf.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I received a loaf from Petar.", ctx)?.code).toBe("memory_unverified_outcome");
  });

  it("accepts a documented delivery to self, preserving item, actor and recipient", () => {
    for (const text of ["Petar brought me bread.", "Petar brought bread to me."]) {
      expect(check(text, context(gift))).toBeNull();
      expect(check(text)?.code).toBe("memory_unverified_outcome");
      expect(check(text, context(gift.replace("Rosa Vidal", "Ana Ruiz")))?.code).toBe("memory_unverified_outcome");
      expect(check(text, context(gift.replace("bread", "soup")))?.code).toBe("memory_unverified_outcome");
    }
    expect(check("Ana brought me bread.", context(gift))?.code).toBe("memory_unverified_outcome");
    expect(check("Petar brought a loaf.", context(gift))?.code).toBe("memory_unverified_outcome");
    expect(check("Petar brought bread.", context(gift))?.code).toBe("memory_unverified_outcome");
  });

  it("does not turn reported speech or promises into observed carrying", () => {
    for (const record of [
      '[event 1, minute 500, agent.say] Petar Ilić: “I brought bread.”',
      "[minute 500; personal interpretation, not verified experience] Petar brought bread.",
      observed("Petar said he brought bread."), observed("Petar promised he would bring bread."),
    ]) expect(check("Petar brought bread.", context(record))?.code).toBe("memory_unverified_outcome");
    for (const text of ["Petar said he brought bread.", "If Petar brought me bread, I could eat.", "Petar never brought bread.", "Petar will have brought bread by tomorrow."])
      expect(check(text)).toBeNull();
  });

  it("treats like he said and as promised as assertions of fulfillment, not uncertainty", () => {
    for (const suffix of ["like he said", "as promised", "as he promised", "like he said he would"]) {
      expect(check(`Petar brought me bread ${suffix}.`)?.code).toBe("memory_unverified_outcome");
      expect(check(`Petar brought me bread ${suffix}.`, context(gift))).toBeNull();
      expect(check(`Petar said he brought me bread ${suffix}.`)).toBeNull();
    }
    expect(check("He brought me a loaf like he said.")?.code).toBe("memory_unverified_outcome");
  });

  it("does not treat English he or other unresolved actors as self or guess from a convenient receipt", () => {
    const ctx = context("[event 1, minute 500, agent.trade] Rosa Vidal bought bread for 1.", gift);
    for (const text of ["He bought bread.", "He has bought bread.", "She bought bread.", "They bought bread.", "He brought me bread."])
      expect(check(text, ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I bought bread.", ctx)).toBeNull();
    expect(check("I have bought bread.", ctx)).toBeNull();
  });

  it("preserves idioms and keeps consumption, quantity and repeated delivery separate", () => {
    for (const text of ["Petar brought up the mill.", "Petar brought me good news.", "Petar brought the matter to my attention."])
      expect(check(text)).toBeNull();
    for (const text of ["Petar brought me bread twice.", "Petar brought me two bread.", "Petar brought me bread and I ate it."])
      expect(check(text, context(gift))?.code).toBe("memory_unverified_outcome");
    expect(check("Petar brought me bread in exchange for soup.", context(gift))?.code).toBe("exchange_unverified");
  });

  it("repairs a captured claim into attributed speech without an extra model call", async () => {
    const c = contexts(); c.a.persona.name = "Rosa Vidal";
    Object.assign(c.reflect, { ...capture.evidence, desireEvidence: capture.evidence.desireEvidence.map(e => TownEvent.parse(e)) });
    const summary = capture.reflection.output.summary.split(". ").find(text => text.startsWith("He brought"))!;
    const invalid: Reflection = { summary, insights: [], intentions: [], opinions: [], letter_to_owner: null };
    const fixed = { ...invalid, summary: "Petar said he brought a loaf. Delivery remains unverified." };
    const requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? invalid : fixed) } }] }));
    }));
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).reflect(c.reflect)).toEqual(fixed);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain("actor");
  });

  it("uses the existing marked fallback when two responses repeat the unverified carrying", async () => {
    const invalid: Reflection = { summary: "Petar brought a loaf.", insights: [], intentions: [], opinions: [], letter_to_owner: null };
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(invalid) } }] })));
    vi.stubGlobal("fetch", fetch);
    const c = contexts(); c.reflect.actionEvidence = []; c.reflect.dayMemories = []; c.reflect.keyMemories = []; c.reflect.desireEvidence = [];
    const result = await new OpenRouterBrain({ apiKey: "test" }).reflect(c.reflect);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(isFromFallback(result)).toBe(true);
    expect(result.summary).not.toContain("brought a loaf");
  });

  it("grounds an intent from an actual delivery after restore, but never from a spoken claim", () => {
    const c = contexts(); c.a.persona.name = "Rosa Vidal"; c.b.persona.name = "Petar Ilić"; c.b.inventory = ["bread"];
    const proposal = { action: { kind: "wait" as const }, intent: "Petar brought me bread as promised. I will wait.", remember: [] };
    expect(c.town.apply(c.b, { kind: "say", text: "I brought you bread." }, "claim")).toBe(true);
    expect(decisionIssue(proposal, c.town.perceive(c.a), c.a.persona.name)?.code).toBe("intent_unverified_premise");
    expect(c.town.apply(c.b, { kind: "give", to: c.a.id, item: "bread" }, "delivery")).toBe(true);
    const restored = new Town({ seed: 13, brain: new MockBrain(13) }); restored.restore(c.town.snapshot());
    const a = restored.agents.get(c.a.id)!;
    expect(a.inventory).toContain("bread");
    expect(decisionIssue(proposal, restored.perceive(a), a.persona.name)).toBeNull();
  });
});
