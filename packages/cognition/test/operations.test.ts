import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActionProposal, DayPlan, Dialogue, Reflection } from "@unwatched/protocol";
import { OpenRouterBrain, isFromFallback, type CallKind, type ProviderUsage } from "../src/index.ts";
import { cleanSchema, strictSchema, stripNulls, wantsStrict } from "../src/schema/json.ts";
import { compactActionSchema } from "../src/schema/compact.ts";
import { CognitiveDayPlan } from "../src/schema/plan.ts";
import { reflectionSchema } from "../src/schema/reflection.ts";
import { contexts, persona } from "./fixtures.ts";

interface Block { type: string; text: string; cache_control?: { type: string } }
interface Body {
  model: string; max_tokens: number;
  messages: { role: string; content: string | Block[] }[];
  response_format: { type: string; json_schema: { name: CallKind; strict: boolean; schema: unknown } };
}
const answer = {
  action_proposal: { action: { kind: "wait" }, remember: [] },
  dialogue: { lines: [{ speaker: "Ángela", text: "Good morning." }, { speaker: "Tomás", text: "How are you?" }], outcome: { a_trust_delta: .05, b_trust_delta: .02, a_remember: "We greeted each other.", b_remember: "We greeted each other.", rumor: null } },
  day_plan: { mood: "Calm", goals: ["Rest"], steps: [{ hour: 9, do: "Rest", place: "market" }] },
  reflection: { summary: "A quiet day.", insights: [], opinions: [], intentions: [], letter_to_owner: null },
  persona_depth: { voice: ["Good morning.", "We can talk tomorrow."], habit: "Looks at the sea", skill: "Carpentry", flaw: "Pride", cameBecause: "Looking for a home" },
  digest: { text: "A quiet day.", headline: "Calm" },
  child: { ...persona, age: 16 },
  paper: { edition: 1, date: "Day 1", weather: "clear", lead: { headline: "Calm", deck: "A day without news", body: "Nothing happened." }, briefs: [], notices: [] },
  judgement: { happened: "Whistled.", plausible: true },
  life: { title: "The life of Ángela", text: "She arrived and left.", epitaph: "We remember her." },
} satisfies Record<CallKind, unknown>;

function provider(reply: (body: Body, index: number) => unknown = b => answer[b.response_format.json_schema.name]) {
  const bodies: Body[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body: Body = JSON.parse(String(init.body)); bodies.push(body);
    const out = reply(body, bodies.length - 1);
    return out instanceof Response ? out : new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(out) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, cost: .002, prompt_tokens_details: { cached_tokens: 60 } },
    }));
  });
  vi.stubGlobal("fetch", fetch);
  return { bodies, fetch };
}
const models = { routine: "haiku", stakes: "sonnet", reflect: "opus" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OpenRouter operation contracts", () => {
  it("performs one structured call per operation with compatible wire schemas and unchanged limits", async () => {
    const { bodies } = provider(); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test", ...models, allowFallback: false });
    brain.primer = c.primer;
    const usage: ProviderUsage[] = []; brain.onUsage = u => usage.push(u);
    expect(ActionProposal.parse(await brain.decide(c.perception, c.a, 1))).toEqual(answer.action_proposal);
      expect(Dialogue.parse(await brain.converse(c.converse))).toEqual({ ...answer.dialogue,
        lines: answer.dialogue.lines.map((line, i) => ({ ...line, speaker: i === 0 ? c.a.id : c.b.id })) });
    expect(DayPlan.parse(await brain.plan(c.plan, 2))).toEqual(answer.day_plan);
    expect(Reflection.parse(await brain.reflect(c.reflect))).toEqual(answer.reflection);
    expect(bodies.map(b => [b.response_format.json_schema.name, b.model, b.max_tokens])).toEqual([
      ["action_proposal", "haiku", 1024], ["dialogue", "haiku", 1500], ["day_plan", "sonnet", 1200], ["reflection", "opus", 2000],
    ]);
    const schemas = [ActionProposal, Dialogue, CognitiveDayPlan, reflectionSchema(c.reflect)];
    bodies.forEach((body, i) => {
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.strict).toBe(true);
      const canonical = cleanSchema(z.toJSONSchema(schemas[i]!));
      expect(body.response_format.json_schema.schema).toEqual(i === 0 ? compactActionSchema(canonical) : canonical);
      const blocks = body.messages[0]!.content as Block[];
      expect(blocks[0]!.text).toContain(c.primer);
      expect(blocks[0]!.text).toContain("Write all prose in English.");
      expect(blocks[0]!.text).not.toContain(JSON.stringify(body.response_format.json_schema.schema));
      expect(blocks[0]!.text).toContain("supplied response schema");
      expect(blocks[0]!.cache_control).toEqual({ type: "ephemeral" });
    });
    expect(usage.every(u => u.agentId === c.a.id)).toBe(true);
    expect(brain.usage()).toEqual({ calls: 4, prompt: 400, completion: 80, costUsd: .008 });
    expect(brain.cachedTokens()).toBe(240);
  });

  it("keeps tier upgrades and citizen overrides live for decide and plan", async () => {
    const { bodies } = provider(); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test", ...models });
    brain.modelsFor = a => a.id === c.a.id ? { stakes: "citizen-stakes" } : null;
    for (const tier of [1, 2, 3] as const) { await brain.decide(c.perception, c.a, tier); await brain.plan(c.plan, tier); }
    expect(bodies.map(b => b.model)).toEqual(["haiku", "haiku", "citizen-stakes", "citizen-stakes", "citizen-stakes", "citizen-stakes"]);
    brain.modelsFor = () => ({ routine: "ceiling" }); await brain.decide(c.perception, c.a, 1);
    expect(bodies.at(-1)!.model).toBe("ceiling");
  });

  it("preserves default models and environment overrides", async () => {
    for (const name of ["UW_OR_MODEL_ROUTINE", "UW_OR_MODEL_STAKES", "UW_OR_MODEL_REFLECT"]) vi.stubEnv(name, undefined);
    const { bodies } = provider(); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test" });
    await brain.decide(c.perception, c.a, 1); await brain.plan(c.plan, 2); await brain.reflect(c.reflect);
    expect(bodies.map(b => b.model)).toEqual(["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-5", "anthropic/claude-opus-5"]);
    vi.stubEnv("UW_OR_MODEL_ROUTINE", "env-routine");
    await new OpenRouterBrain({ apiKey: "test" }).decide(c.perception, c.a, 1);
    expect(bodies.at(-1)!.model).toBe("env-routine");
  });

  it("shares the cached prefix between citizens and locations; a replaced primer is seen on the next call", async () => {
    const { bodies } = provider(); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test", ...models }); brain.primer = c.primer;
    c.a.thinkEvery = 5; c.b.thinkEvery = 20;
    await brain.decide(c.perception, c.a, 1);
    c.b.location = "lane-1"; await brain.decide(c.town.perceive(c.b), c.b, 1);
    const blocks = bodies.map(b => b.messages[0]!.content as Block[]);
    expect(blocks[0]![0]).toEqual(blocks[1]![0]);
    expect(blocks[0]![1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1]![1]!.cache_control).toBeUndefined();
    expect(bodies[0]!.messages[1]).not.toEqual(bodies[1]!.messages[1]);
    brain.primer = "New harbor: hemp and coffee. Feast on day 19.";
    await brain.decide(c.perception, c.a, 1);
    const changed = (bodies[2]!.messages[0]!.content as Block[])[0]!.text;
    expect(changed).toContain(brain.primer); expect(changed).not.toContain(c.primer);
    brain.primer = ""; await brain.decide(c.perception, c.a, 1);
    expect((bodies[3]!.messages[0]!.content as Block[])[0]!.text).not.toContain("New harbor");
  });

  it.each(["decide", "converse", "plan", "reflect"] as const)("preserves marked fallback and onFallback for %s", async operation => {
    const { fetch } = provider(() => new Response("invalid request", { status: 400 })); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test", ...models }); const hook = vi.fn(); brain.onFallback = hook;
    const invoke = {
      decide: () => brain.decide(c.perception, c.a, 1), converse: () => brain.converse(c.converse),
      plan: () => brain.plan(c.plan, 1), reflect: () => brain.reflect(c.reflect),
    };
    const out = await invoke[operation]();
    expect(isFromFallback(out)).toBe(true); expect(JSON.stringify(out)).not.toContain("fromFallback");
    expect(fetch).toHaveBeenCalledTimes(1); expect(hook).toHaveBeenCalledWith(expect.objectContaining({ reason: "openrouter 400" }));
  });

  it("rejects unsupported actions, repairs once, and counts both billable responses even if usage reporting throws", async () => {
    const { bodies } = provider((b, i) => i === 0 ? { action: { kind: "teleport" } } : answer[b.response_format.json_schema.name]);
    const c = contexts(), log = vi.fn(); const brain = new OpenRouterBrain({ apiKey: "test", ...models, allowFallback: false, log });
    brain.onUsage = () => { throw Error("reporter unavailable"); };
    expect(await brain.decide(c.perception, c.a, 1)).toEqual(answer.action_proposal);
    expect(bodies).toHaveLength(2); expect(bodies[1]!.messages).toHaveLength(4);
    expect(bodies[1]!.messages[3]!.content).toContain("schema");
    expect(brain.usage()).toEqual({ calls: 2, prompt: 200, completion: 40, costUsd: .004 });
    expect(brain.cachedTokens()).toBe(120); expect(log).toHaveBeenCalledWith("Provider usage reporting failed");
  });

  it("normalizes strict OpenAI schemas and strips optional nulls before protocol validation", async () => {
    const { bodies } = provider(() => ({ action: { kind: "say", to: null, text: "Hello." }, desire_id: null, intent: null, remember: [] }));
    const c = contexts(); const brain = new OpenRouterBrain({ apiKey: "test", routine: "openai/test" });
    expect(await brain.decide(c.perception, c.a, 1)).toEqual({ action: { kind: "say", text: "Hello." }, remember: [] });
    expect(bodies[0]!.response_format.json_schema.schema).toEqual(strictSchema(compactActionSchema(cleanSchema(z.toJSONSchema(ActionProposal)), true)));
    expect(wantsStrict("~openai/test")).toBe(true); expect(wantsStrict("anthropic/test")).toBe(false);
    const schema = strictSchema(cleanSchema({ type: "object", properties: { a: { type: "string", pattern: "x", maxLength: 3, default: "x" } }, required: [], $schema: "x", oneOf: [] }));
    expect(schema).toEqual({ type: "object", properties: { a: { anyOf: [{ type: "string" }, { type: "null" }] } }, required: ["a"], additionalProperties: false, anyOf: [] });
    expect(stripNulls({ a: null, b: [{ c: null, d: "ok" }] })).toEqual({ b: [{ d: "ok" }] });
  });

  it("retries a rate limit once without losing model, usage or the structured request", async () => {
    const { bodies } = provider((b, i) => i === 0 ? new Response("rate limit", { status: 429 }) : answer[b.response_format.json_schema.name]);
    const c = contexts(); const brain = new OpenRouterBrain({ apiKey: "test", ...models });
    expect(await brain.plan(c.plan, 2)).toEqual(answer.day_plan);
    expect(bodies).toHaveLength(2); expect(bodies[0]).toEqual(bodies[1]); expect(brain.usage().calls).toBe(1);
  });

  it("keeps ancillary calls, primer injection and their structured outputs intact", async () => {
    const { bodies } = provider(); const c = contexts(); const brain = new OpenRouterBrain({ apiKey: "test", ...models, allowFallback: false });
    brain.primer = c.primer;
    expect(await brain.enrich(persona, "Dynamic island")).toEqual(answer.persona_depth);
    expect(await brain.digest(c.town.digestContext(c.a.id, 0)!)).toEqual(answer.digest);
    expect(await brain.child({ parents: [{ persona, coins: 10, job: null, keyMemories: ["Personal memory"] }], home: "House", day: 2, siblings: [] })).toEqual(answer.child);
    expect(await brain.writePaper({ edition: 1, date: "Day 1", weather: "clear", events: [], laws: [], population: 2, arrivals: 2, departures: 0, yesterday: null, market: [], harbor: [], came: [], went: [], tomorrow: "Monday", mayor: null, writings: [] })).toEqual(answer.paper);
    expect(await brain.judge({ agent: c.a, what: "whistle", withName: null, place: "market", placeKind: "market", hour: 9, weather: "clear", nearby: [], inventory: [], coins: 5, stock: [] })).toMatchObject(answer.judgement);
    expect(await brain.life({ name: persona.name, persona, how: "left", note: "", arrivedDay: 1, day: 2, coins: 10, job: null, home: null, events: [], memories: [], people: [], letters: 0, children: [], lettersHome: [], lastThought: null, owned: [], convictions: 0 })).toEqual(answer.life);
    expect(bodies.map(b => b.response_format.json_schema.name)).toEqual(["persona_depth", "digest", "child", "paper", "judgement", "life"]);
    expect(bodies).toHaveLength(6);
    for (const body of bodies) {
      const shared = (body.messages[0]!.content as Block[])[0]!.text;
      expect(shared).toContain(c.primer);
      if (body.response_format.json_schema.name !== "paper") expect(shared).toContain("Write all prose in English.");
    }
  });
});
