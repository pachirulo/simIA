import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal } from "@unwatched/protocol";
import { contexts } from "./fixtures.ts";
import captured from "./fixtures/kakatres-closure.json";
import { compareRepair, repairAnchor } from "../src/semantics/repair.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { conservativeDecisionFallback, conservativeReflectionFallback } from "../src/fallbacks.ts";

const row = (attempt: number) => captured.cases.find(r => r.callId === "3de32c50" && r.attempt === attempt)!.output;
const original = row(1), corrected = ActionProposal.parse(row(2));
const anchor = (value: unknown = original) => repairAnchor(value, { code: "schema_mismatch", path: "action.kind", message: "Invalid discriminator" })!;
const reply = (output: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Kakatres bounded closure", () => {
  it("recognizes the exact buy/item to trade/buy repair as preserved", () => {
    expect(ActionProposal.safeParse(original).success).toBe(false);
    const before = structuredClone(original);
    expect(compareRepair(anchor(), corrected)).toMatchObject({ status: "preserved", issue: null,
      changed: ["action.kind", "action.item", "action.buy"] });
    expect(original).toEqual(before);
    expect(ActionProposal.safeParse(original).success).toBe(false); // Comparison never executes/coerces it.
  });

  it("permits empty optional/invalid-field removal during the same structural repair", () => {
    const malformed = { ...original, action: { ...original.action, sell: "", note: "irrelevant schema field" }, desire_id: "food" };
    expect(compareRepair(anchor(malformed), { ...corrected, desire_id: "food" }).status).toBe("preserved");
    const emptyPartner = { ...original, action: { kind: "buy", item: "bread", with: "" } };
    expect(compareRepair(anchor(emptyPartner), { ...corrected, action: { kind: "trade", buy: "bread" } }).status).toBe("preserved");
    expect(compareRepair(anchor({ ...original, desire_id: "food" }), corrected).status).toBe("preserved");
  });

  it.each([
    { kind: "trade", with: "inn", buy: "soup" },
    { kind: "trade", with: "market", buy: "bread" },
    { kind: "trade", with: "Ivana Horvat", buy: "bread" },
    { kind: "trade", with: "inn", sell: "bread" },
    { kind: "use", item: "bread" },
    { kind: "wait" },
  ])("still rejects material drift: %j", action => {
    expect(compareRepair(anchor(), { ...corrected, action }).issue?.code).toBe("repair_intention_drift");
  });

  it("does not grant the structural exception to a different intent, goal or conflicting item", () => {
    expect(compareRepair(anchor(), { ...corrected, intent: "I'll buy bread to give to Ivana." }).status).toBe("drift");
    expect(compareRepair(anchor({ ...original, desire_id: "food" }), { ...corrected, desire_id: "gift" }).status).toBe("drift");
    expect(compareRepair(anchor({ ...original, action: { ...original.action, buy: "soup" } }), corrected).status).toBe("drift");
    const withPerson = { ...original, action: { ...original.action, with: "Ivana Horvat" } };
    expect(compareRepair(anchor(withPerson), { ...corrected, action: { kind: "trade", with: "Rosa Vidal", buy: "bread" } }).status).toBe("drift");
  });

  it("accepts the captured two-response repair and executes bread at the inn without fallback speech", async () => {
    const c = contexts(); c.a.location = "inn"; c.a.persona.name = "Petar Ilić";
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => reply(++calls === 1 ? original : corrected)));
    const brain = new OpenRouterBrain({ apiKey: "test", logGeneration: false });
    const result = await brain.decide(c.town.perceive(c.a), c.a, 1);
    expect(result).toEqual(corrected); expect(isFromFallback(result)).toBe(false); expect(calls).toBe(2);
    const start = c.town.events.length;
    expect(c.town.apply(c.a, result.action, result.intent ?? "")).toBe(true);
    expect(c.a.inventory).toContain("bread");
    expect(c.town.events.slice(start).some(e => e.kind === "agent.trade" && e.text.includes("bought bread"))).toBe(true);
    expect(c.town.events.slice(start).some(e => e.kind === "agent.say")).toBe(false);
  });

  it("provider failure cannot deliver the mock's boat story, purchases, employment or synthetic memories", async () => {
    const c = contexts(); c.a.location = c.b.location = "inn";
    const scripted = vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue({
      action: { kind: "say", to: c.b.id, text: "The boat was late again." }, remember: ["I bought bread and paid for lodging."] });
    vi.stubGlobal("fetch", vi.fn(async () => reply("invalid completion")));
    const brain = new OpenRouterBrain({ apiKey: "test", logGeneration: false });
    const result = await brain.decide(c.town.perceive(c.a), c.a, 1);
    expect(isFromFallback(result)).toBe(true); expect(result).toEqual(conservativeDecisionFallback());
    expect(scripted).not.toHaveBeenCalled();
    const start = c.town.events.length;
    expect(c.town.apply(c.a, result.action, "provider fallback")).toBe(true);
    expect(c.town.events.slice(start)).toEqual([]);
  });

  it("reflection fallback cannot turn low trust or mock prose into third-party facts", async () => {
    const c = contexts(); c.reflect.relationships[0]!.trust = .1;
    const scripted = vi.spyOn(MockBrain.prototype, "reflect").mockResolvedValue({ ...conservativeReflectionFallback(),
      summary: "The boat was late again.", opinions: [{ about: c.b.id, opinion: "They talk behind my back.", trust_delta: -.1 }] });
    vi.stubGlobal("fetch", vi.fn(async () => reply("invalid completion")));
    const result = await new OpenRouterBrain({ apiKey: "test", logGeneration: false }).reflect(c.reflect);
    expect(result).toEqual(conservativeReflectionFallback()); expect(isFromFallback(result)).toBe(true);
    expect(scripted).not.toHaveBeenCalled();
  });

  it("preserves strict no-fallback mode", async () => {
    const c = contexts(); vi.stubGlobal("fetch", vi.fn(async () => reply("invalid completion")));
    await expect(new OpenRouterBrain({ apiKey: "test", logGeneration: false, allowFallback: false }).decide(c.perception, c.a, 1)).rejects.toThrow("no synthetic response delivered");
  });
});
