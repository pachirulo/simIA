import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActionProposal } from "@unwatched/protocol";
import { OpenRouterProvider } from "../src/provider/openrouter.ts";
import { OpenRouterLogger } from "../src/provider/logging.ts";

const model = "deepseek/deepseek-v4-flash-0731";
const schema = z.object({ text: z.string() });
const metadata = { id: "gen-test", model: "deepseek/deepseek-v4-flash-20260731", provider_name: "Test provider",
  tokens_prompt: 2400, native_tokens_prompt: 6000, native_tokens_completion: 50, native_tokens_cached: 4000,
  native_tokens_reasoning: 0, latency: 500, generation_time: 1200, total_cost: .0002, cache_discount: .0001,
  streamed: false, cancelled: false, finish_reason: "stop", native_finish_reason: "stop",
  provider_responses: [{ provider_name: "First", status: 429 }, { provider_name: "Test provider", status: 200 }] };
const completion = (id = "gen-test", content = '{"text":"Llegué al mesón."}') => ({
  id, model, provider: "Test provider", choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
  usage: { prompt_tokens: 6000, completion_tokens: 50, total_tokens: 6050, cost: .0002,
    prompt_tokens_details: { cached_tokens: 4000 }, completion_tokens_details: { reasoning_tokens: 0 } },
});
const json = (value: unknown) => new Response(JSON.stringify(value));
function events(lines: string[], name: string) { return lines.filter(line => line.startsWith(`openrouter ${name} `)).map(line => JSON.parse(line.slice(`openrouter ${name} `.length))); }
const call = (provider: OpenRouterProvider) => provider.call("day_plan", model, "routine", { shared: "Reglas físicas", own: "Soy Inés." }, "Percepción: café y pan.", schema, 500, "ag_1");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("OpenRouter console diagnostics", () => {
  it("logs full wire request/response and correlates asynchronous API metadata without delaying decisions or billing twice", async () => {
    const lines: string[] = [], posted: unknown[] = [];
    let release!: (response: Response) => void;
    const delayed = new Promise<Response>(resolve => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/generation?")) {
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer PRIVATE_TEST_KEY");
        expect(url).toContain("id=gen-test"); return delayed;
      }
      posted.push(JSON.parse(String(init.body))); return json(completion());
    }));
    const provider = new OpenRouterProvider({ apiKey: "PRIVATE_TEST_KEY", logContent: true, log: line => lines.push(line) });
    const usage = vi.fn(); provider.onUsage = usage;
    expect(await call(provider)).toEqual({ text: "Llegué al mesón." });
    expect(events(lines, "generation")).toHaveLength(0);
    expect(events(lines, "request")[0].body).toEqual(posted[0]);
    expect(events(lines, "response")[0]).toMatchObject({ agentId: "ag_1", id: "gen-test", slot: "routine", durationMs: expect.any(Number), response: completion() });
    expect(events(lines, "validation")[0]).toMatchObject({ id: "gen-test", status: "accepted", value: { text: "Llegué al mesón." } });
    release(json({ data: metadata })); await provider.flushLogs();
    expect(events(lines, "generation")[0]).toMatchObject({ id: "gen-test", metadata });
    const correlated = ["request", "response", "validation", "generation"].map(event => events(lines, event)[0].callId);
    expect(new Set(correlated).size).toBe(1);
    expect(usage).toHaveBeenCalledTimes(1);
    expect(provider.usage()).toEqual({ calls: 1, prompt: 6000, completion: 50, costUsd: .0002 });
    expect(lines.join("\n")).not.toContain("PRIVATE_TEST_KEY");
    expect(lines.join("\n")).not.toContain("Authorization");
  });

  it("keeps raw output separate from the normalized action accepted by cognition", async () => {
    const lines: string[] = [];
    const raw = { action: { kind: "trade", buy: "bread", sell: "" }, remember: [] };
    const fetch = vi.fn(async () => json(completion("gen-trade", JSON.stringify(raw)))); vi.stubGlobal("fetch", fetch);
    const provider = new OpenRouterProvider({ apiKey: "test", logGeneration: false, logContent: true, log: line => lines.push(line) });
    await provider.call("action_proposal", model, "routine", { shared: "rules" }, "state", ActionProposal, 500);
    expect(events(lines, "response")[0].response.choices[0].message.content).toBe(JSON.stringify(raw));
    expect(events(lines, "validation")[0].value.action).toEqual({ kind: "trade", buy: "bread" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("correlates each format repair with its own generation and exact request", async () => {
    const lines: string[] = []; let post = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/generation?")
      ? json({ data: { ...metadata, id: new URL(url).searchParams.get("id") } })
      : json(completion(`gen-${++post}`, post === 1 ? "not JSON" : '{"text":"corregido"}'))));
    const provider = new OpenRouterProvider({ apiKey: "test", logContent: true, log: line => lines.push(line) });
    expect(await call(provider)).toEqual({ text: "corregido" }); await provider.flushLogs();
    const requests = events(lines, "request"), validations = events(lines, "validation");
    expect(requests.map(r => r.attempt)).toEqual([1, 2]);
    expect(requests[0].callId).toBe(requests[1].callId);
    expect(requests[0].body.messages).toHaveLength(2);
    expect(requests[1].body.messages).toHaveLength(4);
    expect(validations.map(v => [v.id, v.status])).toEqual([["gen-1", "not_json"], ["gen-2", "accepted"]]);
    expect(events(lines, "generation").map(g => g.id)).toEqual(["gen-1", "gen-2"]);
    expect(provider.usage().calls).toBe(2);
  });

  it("retries a not-yet-indexed generation GET without replaying the model", async () => {
    vi.useFakeTimers(); const lines: string[] = []; let get = 0, posts = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (!url.includes("/generation?")) { posts++; return json(completion()); }
      return ++get === 1 ? new Response("not indexed", { status: 404 }) : json({ data: metadata });
    }));
    const provider = new OpenRouterProvider({ apiKey: "test", logContent: true, log: line => lines.push(line) });
    expect(await call(provider)).toEqual({ text: "Llegué al mesón." });
    const drain = provider.flushLogs(); await vi.advanceTimersByTimeAsync(1000); await drain;
    expect(posts).toBe(1); expect(get).toBe(2); expect(events(lines, "generation")).toHaveLength(1);
  });

  it.each([403, 404, 500])("bounds metadata retries for HTTP %i without affecting successful output", async status => {
    vi.useFakeTimers(); const lines: string[] = []; let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (!url.includes("/generation?")) return json(completion());
      reads++; return new Response("unavailable", { status });
    }));
    const fallback = vi.fn(), provider = new OpenRouterProvider({ apiKey: "test", logContent: true, log: line => lines.push(line) }); provider.onFallback = fallback;
    expect(await call(provider)).toEqual({ text: "Llegué al mesón." });
    const drain = provider.flushLogs(); await vi.runAllTimersAsync(); await drain;
    expect(reads).toBe(status === 403 ? 1 : 4);
    expect(events(lines, "generation_unavailable")[0]).toMatchObject({ id: "gen-test", reason: `http_${status}` });
    expect(fallback).not.toHaveBeenCalled(); expect(provider.usage().calls).toBe(1);
  });

  it("does not invent missing usage as zero in the console and does not fetch without an ID", async () => {
    const lines: string[] = []; const fetch = vi.fn(async () => json({ choices: completion().choices })); vi.stubGlobal("fetch", fetch);
    const provider = new OpenRouterProvider({ apiKey: "test", logContent: true, log: line => lines.push(line) });
    await call(provider); await provider.flushLogs();
    expect(events(lines, "response")[0]).toMatchObject({ id: null, prompt: null, completion: null, cached: null, costUsd: null, usage: null });
    expect(events(lines, "generation_unavailable")[0].reason).toBe("missing_generation_id");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("defaults to readable decisions and metrics without prompts or full payloads", async () => {
    vi.stubEnv("UW_OR_LOG_CONTENT", undefined); vi.stubEnv("UW_OR_LOG_GENERATION", "0");
    const lines: string[] = [];
    const raw = { action: { kind: "trade", buy: "bread", sell: "" }, intent: "Tengo hambre", remember: [] };
    const fetch = vi.fn(async () => json(completion("gen-readable", JSON.stringify(raw)))); vi.stubGlobal("fetch", fetch);
    const provider = new OpenRouterProvider({ apiKey: "test", log: line => lines.push(line) });
    await provider.call("action_proposal", model, "routine", { shared: "PRIVATE_SYSTEM_PROMPT" }, "PRIVATE_PERCEPTION", ActionProposal, 500, "ag_1");
    await provider.flushLogs();
    const text = lines.join("\n");
    expect(text).toContain("ag_1"); expect(text).toContain('propuesta válida: {"kind":"trade","buy":"bread"}');
    expect(text).toContain("motivo: Tengo hambre"); expect(text).toContain("6000 entrada / 50 salida");
    expect(text).toContain("caché 4000"); expect(text).toContain("$0.000200");
    expect(text).not.toContain("PRIVATE_"); expect(text).not.toContain("response_format"); expect(text).not.toContain("choices");
    expect(lines.every(line => line.length < 400)).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bounds long results and makes repair errors readable", () => {
    const lines: string[] = [];
    const logger = new OpenRouterLogger("test", line => lines.push(line), { logContent: false });
    const trace = { callId: "call", agentId: "a", kind: "reflection" as const, model, slot: "reflect" as const };
    logger.emit("validation", trace, { status: "accepted", value: { summary: "Una reflexión muy larga. ".repeat(200) } });
    logger.emit("validation", trace, { status: "semantic_mismatch", issue: { code: "sell_not_carried", message: "No lleva ese objeto." }, willRetry: true });
    logger.emit("generation", trace, { id: "gen-readable", metadata });
    expect(lines[0]).toContain("…"); expect(lines[0]!.length).toBeLessThan(350);
    expect(lines[1]).toContain("sell_not_carried: No lleva ese objeto. · se repara");
    expect(lines[2]).toContain("nativos 6000/50"); expect(lines[2]).toContain("gen-readable");
    expect(lines[2]).not.toContain("provider_responses");
  });

  it("ignores a broken console sink instead of failing or retrying a billable decision", async () => {
    const fetch = vi.fn(async () => json(completion())); vi.stubGlobal("fetch", fetch);
    const provider = new OpenRouterProvider({ apiKey: "test", logGeneration: false, log: () => { throw new Error("closed console"); } });
    expect(await call(provider)).toEqual({ text: "Llegué al mesón." });
    expect(fetch).toHaveBeenCalledTimes(1); expect(provider.usage().calls).toBe(1);
  });

  it("caps concurrent enrichment and rejects unrelated generation metadata", async () => {
    const lines: string[] = []; const releases: ((response: Response) => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => releases.push(resolve))));
    const logger = new OpenRouterLogger("test", line => lines.push(line), { logContent: true });
    const trace = { callId: "call", agentId: "a", kind: "day_plan" as const, model, slot: "routine" as const, attempt: 1, httpAttempt: 1 };
    for (let i = 0; i < 33; i++) logger.enrich(trace, `gen-${i}`);
    expect(releases).toHaveLength(32);
    expect(events(lines, "generation_unavailable")[0]).toMatchObject({ id: "gen-32", reason: "logging_queue_full" });
    for (const release of releases) release(json({ data: metadata }));
    await logger.flush();
    expect(events(lines, "generation")).toHaveLength(0);
    expect(events(lines, "generation_unavailable").filter(event => event.reason === "invalid_metadata")).toHaveLength(32);
  });
});
