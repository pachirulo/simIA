import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Reflection, TownEvent } from "@unwatched/protocol";
import capture from "./fixtures/monchi-reflections.json";
import { contexts } from "./fixtures.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { reflectionSchema } from "../src/schema/reflection.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";

function recorded(index = 0) {
  const fixture = capture.fixtures[index]!, c = contexts();
  c.a.id = fixture.agentId; c.a.persona.name = fixture.name;
  c.a.home = { ...c.a.home!, ...fixture.home }; c.a.coins = fixture.coins; c.a.desires = [];
  Object.assign(c.reflect, { day: fixture.day, dayMemories: fixture.dayMemories, keyMemories: fixture.keyMemories,
    actionEvidence: fixture.actionEvidence, desireEvidence: fixture.desireEvidence.map(e => TownEvent.parse(e)),
    relationships: capture.fixtures.filter(f => f.agentId !== fixture.agentId).map(f => ({ id: f.agentId, name: f.name, trust: 0 })),
  });
  return c.reflect;
}
const reflection = (summary: string): Reflection => ({ summary, insights: [], intentions: [], opinions: [], letter_to_owner: null });
afterEach(() => vi.unstubAllGlobals());

describe("Monchi: captured reflection evidence, reconstructed surrounding agent state", () => {
  it("confirms both Rosa soup consumptions were already in the original request", () => {
    const ctx = recorded(), evidence = reflectionEvidence(ctx).claims;
    expect(ctx.desireEvidence!.filter(e => e.kind === "agent.eat").map(e => e.id)).toEqual([35, 64]);
    expect(groundedClaimIssue("I ate soup twice.", "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I ate soup three times.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate bread twice.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate soup twice.", "summary", { ...evidence, records: evidence.records.filter(r => r.kind !== "agent.eat") })?.code).toBe("memory_unverified_outcome");
  });

  it.each(["I arrived on the island.", "I arrived in town.", "I arrived on the boat."])("recognizes the selected direct initial observation: %s", summary => {
    const ctx = recorded(); ctx.desireEvidence = []; ctx.actionEvidence = [];
    expect(reflectionIssue(reflection(summary), ctx)).toBeNull();
    expect(reflectionIssue(reflection("I arrived at the mill."), ctx)?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(reflection("I arrived on the boat twice."), ctx)?.code).toBe("memory_unverified_outcome");
    ctx.dayMemories = ctx.dayMemories.map(s => s.replace("recorded observation; quoted claims remain claims", "personal interpretation, not verified experience"));
    ctx.keyMemories = ctx.keyMemories.map(s => s.replace("recorded observation; quoted claims remain claims", "reported speech, not verified experience"));
    expect(reflectionIssue(reflection(summary), ctx)?.code).toBe("memory_unverified_outcome");
  });

  it.each(["I have one night paid at the inn.", "One night is paid at the inn.", "Initially I had three nights paid at the harbor inn."])("accepts supported lodging state: %s", summary => {
    expect(reflectionIssue(reflection(summary), recorded())).toBeNull();
  });
  it.each(["I still have three nights paid at the inn.", "I have nine nights paid at the inn.", "I have one night paid at the mill.", "I paid for three nights at the inn.", "I paid Petar ten coins."])("rejects unsupported state or transfer: %s", summary => {
    expect(reflectionIssue(reflection(summary), recorded())?.code).toBe("memory_unverified_outcome");
  });

  it("does not turn housing state into another actor's prepaid room", () => {
    expect(reflectionIssue(reflection("Petar has one night paid at the inn."), recorded())?.code).toBe("memory_unverified_outcome");
  });

  it.each([
    "I got off the boat with forty coins and three nights paid at the inn.",
    "I landed this morning with forty coins and three nights paid at the harbor inn.",
    "Stepped off the boat with a suitcase and 40 coins, and three nights paid at the harbor inn.",
    "I had three nights already paid at the harbor inn.",
    "I arrived this morning with a suitcase and 40 coins.",
    "I arrived by boat this morning with a suitcase and 40 coins.",
    "Got hired as help at the inn.",
    "Just arrived.",
    "Talk to someone at the mill about the damp and whether they're short-handed or need anything fixed.",
  ])("regression from the real targeted replay: %s", summary => {
    expect(reflectionIssue(reflection(summary), recorded())).toBeNull();
  });

  it("keeps initial possessions, hiring and transfers grounded after the narrow grammar fixes", () => {
    expect(reflectionIssue(reflection("I arrived with 90 coins."), recorded())?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(reflection("Petar arrived with 40 coins."), recorded())?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(reflection("Got hired as help at the mill."), recorded())?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(reflection("I handed Petar bread."), recorded())?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(reflection("I still have three nights already paid at the inn."), recorded())?.code).toBe("memory_unverified_outcome");
  });

  it("keeps all six original active payment claims rejected and reports prose with the ID error", () => {
    for (const [index, fixture] of capture.fixtures.entries()) for (const row of fixture.outputs) {
      const issue = reflectionIssue(Reflection.parse(row.output), recorded(index));
      expect(issue, row.id).not.toBeNull();
      expect(issue!.message, row.id).toContain("paid");
    }
    const issue = reflectionIssue(Reflection.parse(capture.fixtures[0]!.outputs[0]!.output), recorded());
    expect(issue?.code).toBe("desire_unknown_id");
    expect(issue?.message).toContain("Also fix summary");
  });

  it("narrows contextual desire IDs while preserving canonical output compatibility", () => {
    const c = recorded(), base = reflection("I am curious."), desire = { title: "Learn the town", why: "I want to belong here", state: "active", evidence: [1] };
    const schema = reflectionSchema(c);
    const valid = { ...base, desires: [desire] };
    expect(schema.safeParse(valid).success).toBe(true); expect(Reflection.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...base, desires: [{ ...desire, id: "new-1" }] }).success).toBe(false);
    expect(schema.safeParse({ ...base, desires: [{ ...desire, state: "fulfilled" }] }).success).toBe(false);
    expect(JSON.stringify(z.toJSONSchema(schema))).not.toContain('"id"');
    const known = contexts();
    expect(reflectionSchema(known.reflect).safeParse({ ...base, desires: [{ ...desire, id: "desire-home" }] }).success).toBe(true);
    expect(reflectionSchema(known.reflect).safeParse({ ...base, desires: [{ ...desire, id: "new-1" }] }).success).toBe(false);
  });

  it("reports schema and physical errors in the same repair and accepts a grounded correction in two calls", async () => {
    const requests: { messages: { content: string }[] }[] = [];
    const valid = { ...reflection("I arrived on the island. I ate soup twice. I have one night paid at the inn."),
      desires: [{ title: "Learn the town", why: "I am curious about life here", state: "active", evidence: [1] }] };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? capture.fixtures[0]!.outputs[0]!.output : valid) } }] }));
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(recorded())).toEqual(valid);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain("desires[0].id");
    expect(requests[1]!.messages.at(-1)!.content).toContain("paid for three nights");
  });

  it("still falls back within the same two responses when the unsupported payment persists", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      const row = capture.fixtures[0]!.outputs[Math.min(calls++, 1)]!;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(row.output) } }] }));
    }));
    const out = await new OpenRouterBrain({ apiKey: "test" }).reflect(recorded());
    expect(calls).toBe(2); expect(isFromFallback(out)).toBe(true);
    expect(reflectionIssue(out, recorded())).toBeNull();
  });
});
