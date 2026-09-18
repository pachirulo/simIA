import { afterEach, describe, expect, it, vi } from "vitest";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { parse }; } }));
import { AnthropicBrain } from "../src/anthropic.ts";
import { contexts } from "./fixtures.ts";
import { MockBrain } from "../src/mock.ts";

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });
describe("direct Anthropic decision parity", () => {
  it("uses the same contract and repairs a schema-valid but impossible work proposal", async () => {
    const c = contexts(); c.perception.time.weekday = "Sunday"; c.perception.self.job = null;
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
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { action: { kind: "wait" }, intent: "que ".repeat(20), remember: [] } });
    vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue({ action: { kind: "wait" }, remember: ["The options include work."] });
    expect(await new AnthropicBrain().decide(c.perception, c.a, 1)).toEqual({ action: { kind: "wait" }, remember: [] });
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
