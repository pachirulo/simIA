import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenRouterProvider, type ProviderUsage } from "../src/provider/openrouter.ts";

afterEach(() => vi.unstubAllGlobals());
const schema = z.object({ text: z.string() });
function setup(replies: unknown[]) {
  const bodies: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify(replies.shift()));
  }));
  const log = vi.fn(), fallback = vi.fn(), usage: ProviderUsage[] = [];
  const p = new OpenRouterProvider({ apiKey: "test", log, logGeneration: false });
  p.onUsage = u => usage.push(u); p.onFallback = fallback;
  const call = (model = "deepseek/deepseek-v4-flash-0731") => p.call("day_plan", model, "routine", { shared: "JSON" }, "test", schema, 1200);
  return { p, bodies, log, fallback, usage, call };
}
const reply = (finish: string, content: string | null) => ({ id: "gen-test", provider: "Test", choices: [{ finish_reason: finish, message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 1200, completion_tokens_details: { reasoning_tokens: 994 }, cost: .001 } });

it.each([null, '{"text":', '{"text":"complete but truncated"}'])("rejects length even for parseable content (%s) and retries once with a bounded budget", async content => {
  const s = setup([reply("length", content), reply("stop", '{"text":"ok"}')]);
  expect(await s.call()).toEqual({ text: "ok" });
  expect(s.bodies.map(b => b.max_tokens)).toEqual([1200, 2400]);
  expect(s.bodies[0].reasoning).toEqual({ enabled: false });
  expect(s.bodies[0].stream).toBe(false);
  expect(s.bodies[0].provider).toEqual({ require_parameters: true });
  expect(s.bodies[0].messages).toEqual(s.bodies[1].messages);
  expect(s.usage[0]).toMatchObject({ reasoningTokens: 994, finishReason: "length", provider: "Test", generationId: "gen-test" });
  expect(s.p.usage()).toEqual({ calls: 2, prompt: 200, completion: 2400, costUsd: .002 });
  expect(s.fallback).not.toHaveBeenCalled();
});
it("stops after the second truncation and retains both usage records", async () => {
  const s = setup([reply("length", ""), reply("length", "")]);
  expect(await s.call()).toBeNull(); expect(s.bodies).toHaveLength(2);
  expect(s.fallback).toHaveBeenCalledWith(expect.objectContaining({ reason: "finish_reason=length" }));
  expect(s.usage).toHaveLength(2);
});
it("does not treat filtered output as valid JSON", async () => {
  const s = setup([reply("content_filter", '{"text":"ok"}')]);
  expect(await s.call()).toBeNull(); expect(s.bodies).toHaveLength(1);
});
it("keeps other models' reasoning configuration unchanged", async () => {
  const s = setup([reply("stop", '{"text":"ok"}')]);
  await s.call("anthropic/claude-haiku-4.5");
  expect(s.bodies[0].reasoning).toBeUndefined(); expect(s.bodies[0].max_tokens).toBe(1200);
});
it("repairs empty and incomplete JSON only within the existing two-attempt limit", async () => {
  const s = setup([reply("stop", null), reply("stop", '{"text":')]);
  expect(await s.call()).toBeNull(); expect(s.bodies).toHaveLength(2);
  expect(s.bodies[1].messages).toHaveLength(2);
});
it("handles an HTTP 200 provider error without a JSON repair request", async () => {
  const s = setup([{ error: { code: 502, message: "provider failed" } }]);
  expect(await s.call()).toBeNull(); expect(s.bodies).toHaveLength(1);
});
