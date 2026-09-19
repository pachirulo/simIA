import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Dialogue, Perception, Reflection, TownEvent } from "@unwatched/protocol";
import { Town } from "@unwatched/engine";
import capture from "./fixtures/seed468-regressions.json";
import { contexts } from "./fixtures.ts";
import { conditionIssue, groundedClaimIssue } from "../src/semantics/evidence.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { canonicalDialogue } from "../src/semantics/dialogue.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { worldPrimerOf } from "../src/context/world-primer.ts";

afterEach(() => vi.unstubAllGlobals());
function recordedReflection() {
  const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez";
  c.reflect.relationships[0]!.name = c.b.persona.name;
  // The captured midnight prompt supplies two remaining nights, not the three
  // nights in a freshly created test agent's initial state.
  c.a.home!.nightsPaid = 2;
  Object.assign(c.reflect, { ...capture.evidence, desireEvidence: capture.evidence.desireEvidence.map(e => TownEvent.parse(e)) });
  return c;
}

describe("seed 468: original captured outputs and supplied evidence", () => {
  it("does not join paid lodging and 'I promised nothing' into a payment promise", () => {
    const c = recordedReflection();
    expect(conditionIssue(capture.firstReflection.output.summary, "summary", c.reflect.dayMemories)).toBeNull();
    expect(conditionIssue("I agreed to pay Pedro ten coins.", "summary", ["I will pay Pedro ten coins when he delivers bread."])?.code).toBe("agreement_condition_lost");
    expect(conditionIssue("I did not promise to pay Pedro.", "summary", c.reflect.dayMemories)).toBeNull();
  });

  it("accepts the original second summary's purchases and prepaid lodging without accepting invented payments", () => {
    const c = recordedReflection(), evidence = reflectionEvidence(c.reflect).claims;
    expect(groundedClaimIssue(capture.reflection.output.summary, "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I have two nights paid at the inn.", "summary", evidence)).toBeNull();
    expect(groundedClaimIssue("I paid Pedro ten coins.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I paid for three nights at the inn.", "summary", evidence)?.code).toBe("memory_unverified_outcome");
    expect(reflectionIssue(Reflection.parse(capture.reflection.output), c.reflect)).toBeNull();
  });

  it("rejects job IDs and invented shopkeepers before execution, keeping a real local purchase valid", () => {
    const p = Perception.parse(capture.trade.perception), out = ActionProposal.parse(capture.trade.output);
    for (const withValue of ["bakery.cook", "market stall", "the inn's keeper", "market", p.place.name]) {
      expect(decisionIssue({ ...out, action: { kind: "trade", buy: "bread", with: withValue } }, p)?.code).toBe("trade_target_not_present");
    }
    expect(decisionIssue({ ...out, action: { kind: "trade", buy: "bread" } }, p)).toBeNull();
    const c = contexts();
    expect(decisionIssue({ action: { kind: "trade", with: c.b.id, buy: "flour" }, remember: [] }, c.perception)).toBeNull();
  });

  it("resolves A/B by their input identity, preserves order/text and does not silently rewrite outcomes", () => {
    const c = recordedReflection();
    const ctx = { ...c.converse, a: c.b, b: c.a };
    const raw = Dialogue.parse(capture.dialogue.output), before = structuredClone(raw);
    const result = canonicalDialogue(raw, ctx);
    expect(result.lines.map(l => l.speaker)).toEqual([c.a.id, c.b.id, c.a.id, c.b.id, c.a.id]);
    expect(result.lines.map(l => l.text)).toEqual(raw.lines.map(l => l.text));
    expect(result.outcome).toEqual(raw.outcome); expect(raw).toEqual(before);
  });

  it("persists a B-first exchange with repeated speakers using the real engine and provider adapter", async () => {
    const c = contexts(), model = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    const brain = new MockBrain(7);
    brain.decide = async () => ({ action: { kind: "wait" }, remember: [] });
    brain.plan = async () => ({ mood: "quiet", goals: [], steps: [] });
    brain.converse = ctx => model.converse(ctx);
    const raw: Dialogue = { lines: [{ speaker: "B", text: "I will start." }, { speaker: "B", text: "And I keep talking." }, { speaker: "A", text: "I am listening." }],
      outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "", b_remember: "", rumor: null } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(raw) } }] }))));
    const town = new Town({ seed: 7, brain }), a = town.addAgent({ persona: c.a.persona }), b = town.addAgent({ persona: c.b.persona });
    a.location = b.location = "mill"; a.seek = b.id;
    await town.tick();
    expect(town.events.find(e => e.kind === "conversation")?.payload?.lines).toEqual([
      { speaker: b.id, text: "I will start." }, { speaker: b.id, text: "And I keep talking." }, { speaker: a.id, text: "I am listening." },
    ]);
    expect(model.usage().calls).toBe(1);
  });

  it("repairs the known schema errors together within two responses, without fabricating evidence", async () => {
    const requests: { messages: { content: string }[] }[] = [];
    const valid = { summary: "I still have doubts.", insights: [], intentions: [], opinions: [], letter_to_owner: null };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? capture.invalidReflection.output : valid) } }] }));
    }));
    const c = recordedReflection(), brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(c.reflect)).toEqual(valid);
    expect(requests).toHaveLength(2);
    const note = requests[1]!.messages.at(-1)!.content;
    expect(note).toContain("desires.0.id"); expect(note).toContain("desires.1.evidence");
    expect(note).toContain("beliefs.2.confidence"); expect(note).toContain("rather than inventing evidence");
    expect(buildReflectContext(c.reflect).user).toContain("never an empty array");
  });

  it("supplies current world names, jobs and changes through the shared primer", () => {
    const { town } = contexts(), before = worldPrimerOf(town);
    expect(before).toContain(`${town.places.get("bakery")!.id}: ${town.places.get("bakery")!.name}`);
    expect(before).toContain(town.pack.jobs[0]!.title);
    town.places.get("bakery")!.name = "Horno cambiado";
    expect(worldPrimerOf(town)).toContain("bakery: Horno cambiado");
    expect(before).not.toContain("Horno cambiado");
  });
});
