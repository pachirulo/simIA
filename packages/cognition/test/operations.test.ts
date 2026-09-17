import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActionProposal, DayPlan, Dialogue, Reflection } from "@unwatched/protocol";
import { OpenRouterBrain, isFromFallback, type CallKind, type ProviderUsage } from "../src/index.ts";
import { cleanSchema, strictSchema, stripNulls, wantsStrict } from "../src/schema/json.ts";
import { contexts, persona } from "./fixtures.ts";

interface Block { type: string; text: string; cache_control?: { type: string } }
interface Body {
  model: string; max_tokens: number;
  messages: { role: string; content: string | Block[] }[];
  response_format: { type: string; json_schema: { name: CallKind; strict: boolean; schema: unknown } };
}
const answer = {
  action_proposal: { action: { kind: "wait" }, remember: [] },
  dialogue: { lines: [{ speaker: "Ángela", text: "Buenos días." }, { speaker: "Tomás", text: "¿Cómo estás?" }], outcome: { a_trust_delta: .05, b_trust_delta: .02, a_remember: "Nos saludamos.", b_remember: "Nos saludamos.", rumor: null } },
  day_plan: { mood: "Tranquila", goals: ["Descansar"], steps: [{ hour: 9, do: "Descansar", place: "market" }] },
  reflection: { summary: "Un día tranquilo.", insights: [], opinions: [], intentions: [], letter_to_owner: null },
  persona_depth: { voice: ["Buenos días.", "Mañana hablamos."], habit: "Mira el mar", skill: "Carpintería", flaw: "Orgullo", cameBecause: "Buscaba una casa" },
  digest: { text: "Un día tranquilo.", headline: "Calma" },
  child: { ...persona, age: 16 },
  paper: { edition: 1, date: "Día 1", weather: "clear", lead: { headline: "Calma", deck: "Un día sin noticias", body: "No pasó nada." }, briefs: [], notices: [] },
  judgement: { happened: "Silbó.", plausible: true },
  life: { title: "La vida de Ángela", text: "Llegó y se marchó.", epitaph: "La recordamos." },
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
  it("performs exactly one structured call for each primary operation with the original schemas and limits", async () => {
    const { bodies } = provider(); const c = contexts();
    const brain = new OpenRouterBrain({ apiKey: "test", ...models, allowFallback: false });
    brain.primer = c.primer;
    const usage: ProviderUsage[] = []; brain.onUsage = u => usage.push(u);
    expect(ActionProposal.parse(await brain.decide(c.perception, c.a, 1))).toEqual(answer.action_proposal);
    expect(Dialogue.parse(await brain.converse(c.converse))).toEqual(answer.dialogue);
    expect(DayPlan.parse(await brain.plan(c.plan, 2))).toEqual(answer.day_plan);
    expect(Reflection.parse(await brain.reflect(c.reflect))).toEqual(answer.reflection);
    expect(bodies.map(b => [b.response_format.json_schema.name, b.model, b.max_tokens])).toEqual([
      ["action_proposal", "haiku", 1024], ["dialogue", "haiku", 1500], ["day_plan", "sonnet", 1200], ["reflection", "opus", 2000],
    ]);
    const schemas = [ActionProposal, Dialogue, DayPlan, Reflection];
    bodies.forEach((body, i) => {
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.strict).toBe(true);
      expect(body.response_format.json_schema.schema).toEqual(cleanSchema(z.toJSONSchema(schemas[i]!)));
      const blocks = body.messages[0]!.content as Block[];
      expect(blocks[0]!.text).toContain(c.primer);
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
    brain.primer = "Puerto nuevo: cáñamo y café. Fiesta el día 19.";
    await brain.decide(c.perception, c.a, 1);
    const changed = (bodies[2]!.messages[0]!.content as Block[])[0]!.text;
    expect(changed).toContain(brain.primer); expect(changed).not.toContain(c.primer);
    brain.primer = ""; await brain.decide(c.perception, c.a, 1);
    expect((bodies[3]!.messages[0]!.content as Block[])[0]!.text).not.toContain("Puerto nuevo");
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
    const { bodies } = provider(() => ({ action: { kind: "say", to: null, text: "Hola." }, desire_id: null, intent: null, remember: [] }));
    const c = contexts(); const brain = new OpenRouterBrain({ apiKey: "test", routine: "openai/test" });
    expect(await brain.decide(c.perception, c.a, 1)).toEqual({ action: { kind: "say", text: "Hola." }, remember: [] });
    expect(bodies[0]!.response_format.json_schema.schema).toEqual(strictSchema(cleanSchema(z.toJSONSchema(ActionProposal))));
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
    expect(await brain.enrich(persona, "Isla dinámica")).toEqual(answer.persona_depth);
    expect(await brain.digest(c.town.digestContext(c.a.id, 0)!)).toEqual(answer.digest);
    expect(await brain.child({ parents: [{ persona, coins: 10, job: null, keyMemories: ["Recuerdo propio"] }], home: "Casa", day: 2, siblings: [] })).toEqual(answer.child);
    expect(await brain.writePaper({ edition: 1, date: "Día 1", weather: "clear", events: [], laws: [], population: 2, arrivals: 2, departures: 0, yesterday: null, market: [], harbor: [], came: [], went: [], tomorrow: "Lunes", mayor: null, writings: [] })).toEqual(answer.paper);
    expect(await brain.judge({ agent: c.a, what: "silbar", withName: null, place: "market", placeKind: "market", hour: 9, weather: "clear", nearby: [], inventory: [], coins: 5, stock: [] })).toMatchObject(answer.judgement);
    expect(await brain.life({ name: persona.name, persona, how: "left", note: "", arrivedDay: 1, day: 2, coins: 10, job: null, home: null, events: [], memories: [], people: [], letters: 0, children: [], lettersHome: [], lastThought: null, owned: [], convictions: 0 })).toEqual(answer.life);
    expect(bodies.map(b => b.response_format.json_schema.name)).toEqual(["persona_depth", "digest", "child", "paper", "judgement", "life"]);
    expect(bodies).toHaveLength(6);
    for (const body of bodies) expect((body.messages[0]!.content as Block[])[0]!.text).toContain(c.primer);
  });
});
