import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActionProposal, DayPlan, Perception } from "@unwatched/protocol";
import type { PaperContext } from "@unwatched/engine";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { publicPaperContext } from "../src/context/paper.ts";
import { referenceEvidence } from "../src/context/evidence.ts";
import { paperPrompt } from "../src/prompts.ts";
import { planIssue } from "../src/semantics/lifecycle.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { contexts } from "./fixtures.ts";

// Exact perception/output pairs retrieved from OpenRouter's generation/content API.
const logs = JSON.parse(readFileSync(new URL("./fixtures/openrouter-regressions.json", import.meta.url), "utf8")) as {
  generationId: string; perception: Perception; response: unknown;
}[];
afterEach(() => vi.unstubAllGlobals());

describe("17 September API regression replay", () => {
  it("preserves an executable purchase instead of requesting a worse repair", async () => {
    const log = logs[0]!;
    expect(log.generationId).toBe("gen-1789692217-ZD1y6gKFhx6LxqsMuSrt");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(log.response) } }] })));
    vi.stubGlobal("fetch", fetch);
    const { a, town } = contexts();
    const original = structuredClone(log.response);
    const brain = new OpenRouterBrain({ apiKey: "test", routine: "deepseek/deepseek-v4-flash-0731", allowFallback: false });
    const out = await brain.decide(Perception.parse(log.perception), a, 1);
    expect(out.action).toEqual({ kind: "trade", with: "market", buy: "bread", coins: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log.response).toEqual(original);
    // Real engine execution, unchanged: original and normalized action buy the same bread.
    a.coins = 40; a.inventory = ["suitcase"]; a.location = "market";
    expect(town.apply(a, out.action, "regression test")).toBe(true);
    expect(a.inventory).toContain("bread"); expect(a.coins).toBe(39);
    const other = contexts(); other.a.coins = 40; other.a.inventory = ["suitcase"];
    expect(other.town.apply(other.a, ActionProposal.parse(log.response).action, "regression original")).toBe(true);
    expect(other.a.inventory).toEqual(a.inventory); expect(other.a.coins).toBe(a.coins);
  });

  it("normalizes only optional strings before validation, including nested skill steps", () => {
    const input = { action: { kind: "propose_skill", recipe: { name: "Comer", goal: "eat", steps: [{ kind: "trade", buy: "bread", sell: "  " }, { kind: "use", item: "bread" }] } }, intent: "", remember: [] };
    const out = ActionProposal.parse(normalizeOptionalStrings(input, ActionProposal));
    expect(out).not.toHaveProperty("intent");
    expect(out.action.kind === "propose_skill" && out.action.recipe.steps[0]).toEqual({ kind: "trade", buy: "bread" });
    const schema = z.object({ optional: z.string().min(1).optional(), required: z.string().min(1), number: z.number().optional(), flag: z.boolean(), nullable: z.string().nullable().optional() });
    expect(normalizeOptionalStrings({ optional: " \t", required: "", number: 0, flag: false, nullable: null }, schema)).toEqual({ required: "", number: 0, flag: false, nullable: null });
    expect(schema.safeParse(normalizeOptionalStrings({ required: "ok", number: "", flag: false }, schema)).success).toBe(false);
    const emptyItem = ActionProposal.parse(normalizeOptionalStrings({ action: { kind: "use", item: "" } }, ActionProposal));
    expect(emptyItem.action).toEqual({ kind: "use", item: "" });
    expect(decisionIssue(emptyItem, contexts().perception)).not.toBeNull();
  });

  it("retains shorthand trades and nonempty intentional sales", () => {
    for (const action of [{ kind: "trade", coins: 0 }, { kind: "trade", sell: "bread", buy: "apples", coins: 1 }]) {
      expect(ActionProposal.parse(normalizeOptionalStrings({ action }, ActionProposal)).action).toEqual(action);
    }
  });

  it("highlights carried food and known lodging without fabricating local beds", () => {
    const { a } = contexts(); a.home = { place: "inn", nightsPaid: 3 };
    const p = Perception.parse(logs[1]!.perception);
    const context = buildDecideContext(p, a);
    expect(context.user).toContain('Carried food from experience=["apples"]');
    expect(context.user).toContain("Own lodging=inn, nights paid=3; you are elsewhere");
    expect(context.user).toContain("Sleep needs a local bed; none is established here");
    expect(context.user).toContain("Known rest destination=inn (move first)");
    expect(JSON.parse(context.user.slice(context.user.lastIndexOf("\n\n") + 2))).toEqual(p);
    const atHome = buildDecideContext({ ...p, place: { ...p.place, id: "inn" } }, a);
    expect(atHome.user).toContain("you are there");
    expect(atHome.user).toContain("Your lodging provides a known bed here");
    expect(atHome.system).toEqual(context.system); // unchanged cached prefix/persona
  });

  it("keeps advice unverified, sleeping/remote people out of the audience, and exact place IDs visible", () => {
    const { a } = contexts(); const p = Perception.parse(logs[3]!.perception);
    const snapshot = structuredClone(p);
    expect(buildDecideContext(p, a).user).toContain("Awake here=[]");
    p.nearby = [{ agent: "neighbor", name: "Vecino", asleep: true }];
    p.self.inventory = ["strange fruit", "unknown food"];
    p.self.learned_food = [];
    p.self.food_advice = [{ from: "neighbor", name: "Vecino", item: "strange fruit", place: "orchard", confidence: .5, source_t: 1, shared_t: 2, trust: .5 }];
    const text = buildDecideContext(p, a).user;
    expect(text).toContain("Awake here=[]");
    expect(text).toContain('reported food carried=["strange fruit"] (advice, unverified)');
    expect(text).toContain("other inventory is unclassified");
    expect(text).toContain(JSON.stringify(p.place.exits[0]));
    expect(logs[3]!.perception).toEqual(snapshot);
  });

  it("requires plan activities while leaving the canonical schema compatible", () => {
    const { plan } = contexts();
    const empty = DayPlan.parse({ mood: "Quiet", goals: ["Walk"], steps: [{ hour: 9, place: "market" }] });
    expect(planIssue(empty, plan)?.code).toBe("plan_missing_activity");
    expect(planIssue({ ...empty, steps: [{ hour: 9, place: "market", do: "Walk around" }] }, plan)).toBeNull();
  });

  it("distinguishes bad IDs from actual physical failures and includes the lodging location at night", () => {
    const { reflect } = contexts(); reflect.agent.home = { place: "inn", nightsPaid: 3 };
    const badId = "[event 16, minute 540, action.rejected] Inés tried to move but no such place as council_hall.";
    const noBed = "[event 53, minute 1260, action.rejected] Pedro tried to sleep but no bed here.";
    reflect.actionEvidence = [badId, noBed];
    const text = buildReflectContext(reflect).user;
    expect(text).toContain(`${badId} [unresolved reference; no evidence of physical inaccessibility or refusal]`);
    expect(referenceEvidence(noBed)).toBe(noBed);
    expect(text).toContain("3 nights paid at inn");
    expect(text).toContain(noBed);
  });
});

describe("public newspaper boundary", () => {
  const paper = (): PaperContext => ({ edition: 1, date: "day 1", weather: "clear", population: 2, arrivals: 2, departures: 0,
    mayor: null, laws: [], yesterday: null, market: [], harbor: [], came: [], went: [], tomorrow: "Monday", writings: [],
    events: [
      { text: "Inés would now say of themself: PRIVATE THOUGHT; with strangers is now cautious", importance: .8, actors: ["ag_1"] },
      { text: "Inés wrote to owner: “PRIVATE LETTER”", importance: .8, actors: ["ag_1"] },
      { text: "Inés reflected: PRIVATE REFLECTION", importance: .2, actors: ["ag_1"] },
      { text: "Inés and Pedro talked at the market: “Dicen que el molino busca gente.”", importance: .4, actors: ["ag_1", "ag_2"] },
      { text: 'Inés said: "Pedro now wants a home."', importance: .4, actors: ["ag_1"] },
      { text: 'Inés to Pedro: “Tengo un horno.”', importance: .4, actors: ["Inés", "Pedro"] },
      { text: "Pedro bought bread for 1.", importance: .3, actors: ["ag_2"] },
    ] });

  it("removes private records, preserves public quotations, and labels reported claims/calendar", () => {
    const ctx = paper(); const before = structuredClone(ctx); const text = paperPrompt(ctx);
    expect(text).not.toContain("PRIVATE");
    expect(text).toContain('Reported speech; attribute every claim');
    expect(text.indexOf('Pedro bought bread for 1.')).toBeLessThan(text.indexOf('Reported speech;'));
    expect(text.indexOf('Inés and Pedro talked')).toBeGreaterThan(text.indexOf('Reported speech;'));
    expect(text.indexOf('Inés to Pedro:')).toBeGreaterThan(text.indexOf('Reported speech;'));
    expect(text).toContain('Inés said: "Pedro now wants a home."');
    expect(text).toContain("Pedro bought bread for 1.");
    expect(text).toContain("Tomorrow (supplied calendar; no additional event is established): Monday");
    expect(ctx).toEqual(before);
    expect(publicPaperContext(publicPaperContext(ctx))).toEqual(publicPaperContext(ctx));
  });

  it("does not expose private records through the synthetic fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 402 })));
    const brain = new OpenRouterBrain({ apiKey: "test" });
    expect(JSON.stringify(await brain.writePaper(paper()))).not.toContain("PRIVATE");
  });
});
