import { afterEach, describe, expect, it, vi } from "vitest";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { parse }; } }));
import { AnthropicBrain } from "../src/anthropic.ts";
import { contexts } from "./fixtures.ts";
import { MockBrain } from "../src/mock.ts";
import { isFromFallback } from "../src/provider/response.ts";
import { misattributedRumor, inventedDebt, malformedFlour, substitutedBread } from "./fixtures/coherence.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { conservativeDecisionFallback, conservativeReflectionFallback } from "../src/fallbacks.ts";

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });
describe("direct Anthropic decision parity", () => {
  it.each(["decide", "reflect"] as const)("keeps %s fallback free of mock world stories", async operation => {
    const c = contexts();
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    const mockDecision = vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue({ action: { kind: "say", text: "The boat was late again." }, remember: [] });
    const mockReflection = vi.spyOn(MockBrain.prototype, "reflect").mockResolvedValue({ ...conservativeReflectionFallback(), summary: "The boat was late again." });
    const brain = new AnthropicBrain();
    const out = operation === "decide" ? await brain.decide(c.perception, c.a, 1) : await brain.reflect(c.reflect);
    expect(out).toEqual(operation === "decide" ? conservativeDecisionFallback() : conservativeReflectionFallback());
    expect(isFromFallback(out)).toBe(true);
    expect(mockDecision).not.toHaveBeenCalled(); expect(mockReflection).not.toHaveBeenCalled();
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("requests English character depth while preserving the supplied name and biography", async () => {
    const { a } = contexts();
    const depth = { voice: ["We can talk tomorrow."], habit: "Adjusts her sleeves", skill: "Carpentry", flaw: "Pride", cameBecause: "Looking for work" };
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: depth });
    expect(await new AnthropicBrain().enrich(a.persona, "The island")).toEqual(depth);
    const request = parse.mock.calls[0]![0];
    expect(request.system).toContain("Write all prose in English.");
    expect(request.messages[0].content).toContain(a.persona.name);
    expect(request.messages[0].content).toContain(a.persona.summary);
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("withholds private dialogue data and uses a public fallback with one SDK response", async () => {
    const c = contexts(); c.a.persona.secret = "PRIVATE_SECRET"; c.b.persona.summary = "PRIVATE_BIOGRAPHY";
    c.converse.aMemories = ["PRIVATE_MEMORY"];
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    const result = await new AnthropicBrain().converse(c.converse);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(parse.mock.calls)).not.toContain("PRIVATE_");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(isFromFallback(result)).toBe(true);
  });
  it("repairs an unsupported premise while retaining the same action and selected evidence boundary", async () => {
    const c = contexts(); c.perception.recent = [];
    c.a.memory.push({ t: 400, text: "I bought bread.", kind: "obs", importance: 1 });
    const invalid = { action: { kind: "wait" }, intent: "I bought bread.", remember: [] };
    const fixed = { ...invalid, intent: "That purchase is unverified. I will wait." };
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: invalid })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: fixed });
    expect(await new AnthropicBrain().decide(c.perception, c.a, 1)).toEqual(fixed);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1]![0].messages.at(-1).content).toContain("premise of intent");
  });
  it("rejects invalid personal evidence in reflection and guards its fallback within one SDK response", async () => {
    const c = contexts();
    const invalid = { summary: "I am reconsidering my plans.", insights: [], opinions: [], intentions: [], letter_to_owner: null,
      desires: [{ id: "desire-home", title: "A home of my own", why: "A place to stay", state: "active" as const, evidence: [999] }] };
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: invalid });
    vi.spyOn(MockBrain.prototype, "reflect").mockResolvedValue(invalid);
    const out = await new AnthropicBrain().reflect(c.reflect);
    expect(isFromFallback(out)).toBe(true); expect(out.desires).toBeUndefined();
    expect(reflectionIssue(out, c.reflect)).toBeNull(); expect(parse).toHaveBeenCalledTimes(1);
  });
  it("retains the same action's desire association after memory repair without another call", async () => {
    const c = contexts(); c.perception.recent = [];
    const action = { kind: "trade", buy: "bread" };
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { action, desire_id: "food", remember: ["I bought bread."] } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { action, remember: [] } });
    expect(await new AnthropicBrain().decide(c.perception, c.a, 1)).toEqual({ action, desire_id: "food", remember: [] });
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("uses the same contract and repairs a schema-valid but impossible work proposal", async () => {
    const c = contexts(); c.perception.time.weekday = "Sunday"; c.perception.self.job = null;
    c.perception.place.jobs_open = ["market-help"];
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { action: { kind: "work" }, remember: [] } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { action: { kind: "apply" }, remember: [] } });
    const brain = new AnthropicBrain();
    expect(await brain.decide(c.perception, c.a, 1)).toEqual({ action: { kind: "apply" }, remember: [] });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0]![0].system[0].text).toContain("NOT currently valid");
    expect(parse.mock.calls[1]![0].messages.at(-1).content).toContain("NOT executed");
  });

  it("does not let a model loop or an invalid mock fallback enter remember", async () => {
    const c = contexts();
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { action: { kind: "wait" }, intent: "that ".repeat(20), remember: [] } });
    vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue({ action: { kind: "wait" }, remember: ["The options include work."] });
    expect(await new AnthropicBrain().decide(c.perception, c.a, 1)).toEqual({ action: { kind: "wait" }, remember: [] });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not deliver a silent change of goal as a faithful repair", async () => {
    const c = contexts();
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: malformedFlour })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: substitutedBread });
    const out = await new AnthropicBrain().decide(c.perception, c.a, 1);
    expect(parse).toHaveBeenCalledTimes(2); expect(isFromFallback(out)).toBe(true);
  });

  it("guards conversation and reflection outputs, including their fallback, without extra SDK calls", async () => {
    const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez";
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: misattributedRumor });
    vi.spyOn(MockBrain.prototype, "converse").mockResolvedValue(misattributedRumor);
    const dialogue = await new AnthropicBrain().converse(c.converse);
    expect(isFromFallback(dialogue)).toBe(true); expect(dialogueIssue(dialogue, c.converse)).toBeNull();
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: inventedDebt });
    vi.spyOn(MockBrain.prototype, "reflect").mockResolvedValue(inventedDebt);
    const reflection = await new AnthropicBrain().reflect(c.reflect);
    expect(isFromFallback(reflection)).toBe(true); expect(reflectionIssue(reflection, c.reflect)).toBeNull();
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
