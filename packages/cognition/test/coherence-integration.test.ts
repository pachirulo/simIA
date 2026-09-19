import { afterEach, describe, expect, it, vi } from "vitest";
import { Town, type ReflectContext } from "@unwatched/engine";
import type { Dialogue, Reflection } from "@unwatched/protocol";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";
import { persona } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());
const reflection = (summary: string): Reflection => ({ summary, insights: [], intentions: [], opinions: [], letter_to_owner: null });

describe("conversation, persisted memory and separate delivery/payment receipts", () => {
  it.each(["promised", "delivered", "paid", "explicit-promised", "explicit-delivered", "explicit-paid"])("keeps each stage grounded: %s", async scenario => {
    const explicit = scenario.startsWith("explicit-"), stage = scenario.replace("explicit-", "");
    const delivered = stage !== "promised", paid = stage === "paid";
    const model = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    const driver = new MockBrain(7);
    driver.decide = async () => ({ action: { kind: "wait" }, remember: [] });
    driver.plan = async () => ({ mood: "quiet", goals: [], steps: [] });
    driver.converse = ctx => model.converse(ctx);
    const seen: ReflectContext[] = [];
    let reflecting: ReflectContext | undefined;
    driver.reflect = async ctx => { reflecting = ctx; seen.push(ctx); return model.reflect(ctx); };
    const town = new Town({ seed: 7, brain: driver });
    const ines = town.addAgent({ persona: { ...persona, name: "Inés Vidal" } });
    const pedro = town.addAgent({ persona: { ...persona, name: "Pedro Ibáñez" } });
    const promise = explicit ? "I will pay Pedro ten coins when Pedro delivers bread." : "I will pay Pedro ten coins when he delivers bread.";
    const dialogue: Dialogue = {
      lines: [{ speaker: ines.id, text: promise }, { speaker: pedro.id, text: explicit ? "Agreed." : "I will bring bread when I have flour." }],
      outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: promise,
        b_remember: "Inés will pay ten coins when I deliver bread. I still need flour.", rumor: null },
    };
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      const kind = request.response_format.json_schema.name;
      const output = kind === "dialogue" ? dialogue : reflection(reflecting!.agent.id === ines.id
        ? paid ? "Pedro gave me bread. I paid Pedro 10 coins." : delivered ? "Pedro gave me bread." : promise
        : delivered ? "I gave Inés bread." : "I will deliver bread when I have flour.");
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] }));
    }));
    ines.location = pedro.location = "mill"; ines.seek = pedro.id;
    await town.tick();
    expect(town.events.filter(e => e.kind === "conversation")).toHaveLength(1);
    expect(ines.memory.some(m => m.text.includes(promise) && m.kind === "reflect")).toBe(true);
    expect(ines.debts).toEqual([]);

    // Reload the actual engine snapshot: no parallel memory store in cognition.
    const restored = new Town({ seed: 7, brain: driver }); restored.restore(town.snapshot());
    const a = restored.agents.get(ines.id)!, b = restored.agents.get(pedro.id)!;
    expect(a.memory.some(m => m.text.includes(promise))).toBe(true);
    if (delivered) {
      if (explicit) restored.t++; // Distinct minute remains ordered even in a memory-only transcript.
      a.location = b.location = "mill"; b.inventory = ["bread"];
      expect(restored.apply(b, { kind: "give", to: a.id, item: "bread" }, "delivery")).toBe(true);
      expect(a.inventory).toContain("bread"); expect(b.inventory).not.toContain("bread");
      if (paid) {
        const coinsBefore = [a.coins, b.coins];
        expect(restored.apply(a, { kind: "give", to: b.id, coins: 10 }, "payment")).toBe(true);
        expect([a.coins, b.coins]).toEqual([coinsBefore[0]! - 10, coinsBefore[1]! + 10]);
      }
    }
    for (const citizen of [a, b]) { citizen.asleep = true; citizen.needs.rest = 1; citizen.location = "inn"; }
    restored.t = 1439; await restored.tick();
    const ctx = seen.find(c => c.agent.id === a.id)!;
    expect(ctx).toBeDefined();
    expect(ctx.dayMemories.some(m => m.includes("when") && m.includes("bread"))).toBe(true);
    const sources = reflectionEvidence(ctx);
    const utterance = sources.assertions.find(r => r.speaker === a.persona.name && r.assertion === promise);
    expect(utterance).toMatchObject({ certainty: "reported", condition: { text: explicit ? "when Pedro delivers bread" : "when he delivers bread", status: "unverified" } });
    expect(utterance!.recordedAt).not.toBeNull();
    expect(sources.claims.records.some(r => r.kind === "agent.give" && r.text.includes("bread"))).toBe(delivered);
    expect(sources.claims.records.some(r => r.kind === "agent.give" && r.text.includes("10 coins"))).toBe(paid);
    expect(groundedClaimIssue("I took the bread from Pedro.", "summary", sources.claims)?.code ?? null)
      .toBe(delivered ? null : "memory_unverified_outcome");
    expect(groundedClaimIssue("Pedro took the bread from me.", "summary", sources.claims)?.code)
      .toBe("memory_unverified_outcome");
    if (explicit) {
      expect(sources.commitments).toHaveLength(1);
      expect(sources.commitments[0]!.agreement.status).toBe("observed");
      expect(sources.commitments[0]!.delivery.status).toBe(delivered ? "observed" : "unknown");
      expect(sources.commitments[0]!.payment.status).toBe(paid ? "observed" : "unknown");
      expect(sources.commitments[0]!.outstanding).toBe("unknown");
    }
    const payment = reflection("I paid Pedro 10 coins.");
    expect(reflectionIssue(payment, ctx)?.code ?? null).toBe(paid ? null : "memory_unverified_outcome");
    expect(a.memory.some(m => m.text === (paid ? "Pedro gave me bread. I paid Pedro 10 coins." : delivered ? "Pedro gave me bread." : promise))).toBe(true);
    expect(a.debts).toEqual([]); // This promise/payment does not create an engine loan.
    expect(model.usage().calls).toBe(3); // One dialogue + two reflections; no repair/fallback.
  });
});
