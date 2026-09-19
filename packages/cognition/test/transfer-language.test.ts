import { afterEach, describe, expect, it, vi } from "vitest";
import { groundedClaimIssue, observedRecords, type ClaimContext } from "../src/semantics/evidence.ts";
import { contexts } from "./fixtures.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { Town } from "@unwatched/engine";
import { MockBrain } from "../src/mock.ts";
import type { Reflection } from "@unwatched/protocol";

afterEach(() => vi.unstubAllGlobals());

const evidence = (...lines: string[]): ClaimContext => ({ selfNames: ["Rosa Vidal"], records: observedRecords(lines) });
const check = (text: string, ctx = evidence()) => groundedClaimIssue(text, "summary", ctx);
const gift = "[event 1, minute 500, agent.give] Petar Ilić gave Rosa Vidal bread.";

describe("transfer wording preserves operation, direction and exchange uncertainty", () => {
  it("recognizes handed/delivered as transfer claims, requiring their own receipt", () => {
    for (const text of ["Petar handed me bread.", "Petar delivered bread to me."]) {
      expect(check(text)?.code).toBe("memory_unverified_outcome");
      expect(check(text, evidence(gift))).toBeNull();
      expect(check(text, evidence(gift.replace("Rosa Vidal", "Ana Ruiz")))?.code).toBe("memory_unverified_outcome");
    }
  });

  it("recognizes received from an actual gift without borrowing another recipient's item", () => {
    expect(check("I received bread from Petar.")?.code).toBe("memory_unverified_outcome");
    expect(check("I received bread from Petar.", evidence(gift))).toBeNull();
    expect(check("I received soup from Petar.", evidence(gift))?.code).toBe("memory_unverified_outcome");
    expect(check("I received bread from Ana.", evidence(gift))?.code).toBe("memory_unverified_outcome");
    expect(check("I received bread from Petar.", evidence(gift.replace("Rosa Vidal", "Ana Ruiz")))?.code).toBe("memory_unverified_outcome");
  });

  it("uses personal first-person receipts without needing a guessed identity", () => {
    const ctx = evidence("[minute 500; recorded observation; quoted claims remain claims] Petar Ilić gave me bread.");
    ctx.selfNames = [];
    expect(check("I received bread from Petar.", ctx)).toBeNull();
  });

  it("does not equate carrying, promises, theft, purchase or inventory with receiving a gift", () => {
    for (const record of [
      "[minute 500; recorded observation; quoted claims remain claims] Petar brought bread.",
      "[event 1, minute 500, agent.take] Rosa Vidal took bread from Petar Ilić.",
      "[event 1, minute 500, agent.trade] Rosa Vidal bought bread for 1.",
      '[event 1, minute 500, agent.say] Petar Ilić: “I gave Rosa bread.”',
      "[minute 500; personal interpretation, not verified experience] Petar gave me bread.",
    ]) expect(check("I received bread from Petar.", evidence(record))?.code).toBe("memory_unverified_outcome");
  });

  it("preserves attributed speech, conditional delivery and future hopes", () => {
    for (const text of ["Petar said he delivered bread to me.", "If Petar handed me bread, I could eat.", "I will have received bread by tomorrow.", "I haven't received bread."]) {
      expect(check(text)).toBeNull();
    }
  });

  it("does not reinterpret communication or emotional support as inventory transfers", () => {
    for (const text of ["I received advice.", "I received a letter.", "I received a warm welcome.", "I delivered a speech.", "I exchanged words with Petar."]) {
      expect(check(text)).toBeNull();
    }
  });

  it("accepts a generic real trade after restore without fabricating the missing item detail", () => {
    const c = contexts(); c.a.persona.name = "Rosa Vidal"; c.b.persona.name = "Petar Ilić";
    c.a.inventory = ["soup"]; c.b.inventory = ["bread"];
    expect(c.town.apply(c.a, { kind: "trade", with: c.b.id, buy: "bread", sell: "soup" }, "barter")).toBe(true);
    const restored = new Town({ seed: 13, brain: new MockBrain(13) }); restored.restore(c.town.snapshot());
    expect(restored.agents.get(c.a.id)!.inventory).toEqual(["bread"]);
    expect(restored.agents.get(c.b.id)!.inventory).toEqual(["soup"]);
    // Snapshots restore state, not the event list. Use the actually emitted
    // receipt retained by the caller; never pretend restore fabricated it.
    const receipt = c.town.events.find(e => e.kind === "agent.trade")!;
    expect(receipt.text).toBe("Rosa Vidal traded with Petar Ilić.");
    const ctx = evidence(`[event ${receipt.id}, minute ${receipt.t}, ${receipt.kind}] ${receipt.text}`);
    expect(check("I traded with Petar.", ctx)).toBeNull();
    expect(check("I traded with Ana.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I exchanged soup for bread with Petar.", ctx)?.code).toBe("memory_unverified_outcome");
  });

  it("repairs an unsupported exchange into separately supported transfers within two responses", async () => {
    const c = contexts(); c.a.persona.name = "Rosa Vidal"; c.b.persona.name = "Petar Ilić";
    c.reflect.actionEvidence = [gift, "[event 2, minute 510, agent.give] Rosa Vidal gave Petar Ilić soup."];
    c.reflect.dayMemories = []; c.reflect.keyMemories = []; c.reflect.desireEvidence = [];
    const invalid: Reflection = { summary: "Petar gave me bread in exchange for soup.", insights: [], intentions: [], opinions: [], letter_to_owner: null };
    const fixed = { ...invalid, summary: "Petar handed me bread. I gave Petar soup. The link to our bargain is unverified." };
    const requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? invalid : fixed) } }] }));
    }));
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).reflect(c.reflect)).toEqual(fixed);
    expect(requests).toHaveLength(2); expect(requests[1]!.messages.at(-1)!.content).toContain("reciprocal gifts");
    expect(check("I received bread from Petar.", reflectionEvidence(c.reflect).claims)).toBeNull();
  });

  it("does not certify a detailed barter from two independent gifts or a generic trade event", () => {
    const ctx = evidence(gift, "[event 2, minute 510, agent.give] Rosa Vidal gave Petar Ilić soup.",
      "[event 3, minute 520, agent.trade] Rosa Vidal traded with Petar Ilić.");
    expect(check("I traded soup for bread with Petar.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I traded with Petar.", ctx)).toBeNull();
    expect(check("Petar gave me bread. I gave Petar soup.", ctx)).toBeNull();
    expect(check("Petar gave me bread for the journey.", ctx)).toBeNull();
    expect(check("Petar gave me bread in exchange for soup.", ctx)?.code).toBe("exchange_unverified");
    expect(check("Petar gave me bread for the soup.", ctx)?.code).toBe("exchange_unverified");
  });

  it("does not certify consumption, amount or repetition from a delivery", () => {
    const ctx = evidence(gift);
    expect(check("I received bread and ate it.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I received bread twice.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I received two bread.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I received a loaf.", ctx)).toBeNull();
    expect(check("I received two loaves.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("I received a meat loaf.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(check("Petar handed me soup.", ctx)?.code).toBe("memory_unverified_outcome");
  });
});
