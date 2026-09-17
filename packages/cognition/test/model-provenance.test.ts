import { afterEach, describe, expect, it, vi } from "vitest";
import { brainTrace, type AgentState, type JudgeContext, type ReflectContext } from "@unwatched/engine";
import { OpenRouterBrain } from "../src/index.ts";

const agent = { id: "ada", owner: "owner", brainKind: "hosted", funded: true, persona: { name: "Ada", age: 30, origin: "mainland", summary: "A visitor.", want: "Work.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Listens.", traits: { warmth: .5, pride: .5, caution: .5, honesty: .5, ambition: .5 } }, relationships: new Map(), memory: [], inventory: [] } as unknown as AgentState;
const ctx = { agent, what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "clear", nearby: [], inventory: [], coins: 0, stock: [] } as JudgeContext;

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter model provenance", () => {
  it("uses the model returned by the provider, including a resolved alias", async () => {
    const answer = { happened: "A whistle carried.", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ model: "vendor/resolved-model-202609", choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 })));
    const out = await new OpenRouterBrain({ apiKey: "test", routine: "vendor/alias", stakes: "stakes", reflect: "reflect" }).judge(ctx);
    expect(brainTrace(out)).toEqual({ model: "vendor/resolved-model-202609", modelTier: "ROUTINE", modelCallId: 1 });
  });

  it("marks a synthetic fallback without claiming the requested model produced it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no credit", { status: 402 })));
    const out = await new OpenRouterBrain({ apiKey: "test", routine: "vendor/routine", stakes: "stakes", reflect: "reflect" }).judge(ctx);
    expect(brainTrace(out)).toEqual({ model: "mock", modelTier: "ROUTINE", modelCallId: 1, requestedModel: "vendor/routine" });
  });

  it("distinguishes a quiet STAKE reflection from a full REFLECT one", async () => {
    const answer = { summary: "A quiet day.", insights: [], opinions: [], intentions: [], letter_to_owner: null };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const requested = JSON.parse(init.body).model as string;
      return new Response(JSON.stringify({ model: requested, choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 });
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", routine: "routine", stakes: "stakes", reflect: "reflect" });
    const context = (quiet: boolean) => ({ agent, day: 1, dayMemories: [], keyMemories: [], relationships: [], unreadLetters: [], plan: null, projects: [], beliefs: [], watch: [], quiet }) as unknown as ReflectContext;
    expect(brainTrace(await brain.reflect(context(true)))?.modelTier).toBe("STAKE");
    expect(brainTrace(await brain.reflect(context(false)))?.modelTier).toBe("REFLECT");
  });
});
