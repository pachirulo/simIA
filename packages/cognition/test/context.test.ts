import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Action, ActionKind, ActionProposal, Perception } from "@unwatched/protocol";
import { buildDecideContext } from "../src/context/decide.ts";
import { buildConverseContext } from "../src/context/converse.ts";
import { buildPlanContext } from "../src/context/plan.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { cachePersona, withPrimer } from "../src/context/shared.ts";
import { WORLD, personaBlock, decidePrompt, conversePrompt, planPrompt, reflectPrompt } from "../src/prompts.ts";
import { DECIDE_RULES as WORLD_RULES } from "../src/prompts/decide-compact.ts";
import { actionProposalSchema } from "../src/schema/action.ts";
import { contexts } from "./fixtures.ts";

describe("operation contexts", () => {
  it("does not activate unrelated mechanics from global options or empty family state", () => {
    const { a, perception } = contexts();
    const p = { ...perception, nearby: [], place: { ...perception.place, kind: "harbor" },
      self: { ...perception.self, family: { partner: null, children: [] }, knows: [], debts: [] },
      options: ["move", "wait", "call", "propose", "vote", "write", "leave"] satisfies Perception["options"] };
    const text = buildDecideContext(p, a).user;
    for (const rule of [WORLD_RULES.family, WORLD_RULES.council, WORLD_RULES.shaping, WORLD_RULES.households, WORLD_RULES.secrets]) expect(text).not.toContain(rule);
    expect(text).toContain("Call your current place"); expect(text).toContain("Leave by boat");
    const civic = buildDecideContext({ ...p, place: { ...p.place, kind: "civic" } }, a);
    expect(civic.user).toContain(WORLD_RULES.council);
    expect(buildDecideContext({ ...p, self: { ...p.self, family: { partner: "Tomás", children: [] } } }, a).user).toContain(WORLD_RULES.family);
    expect(buildDecideContext({ ...p, options: [...p.options, "search"] }, a).user).toContain(WORLD_RULES.secrets);
  });
  it("keeps the shared English WORLD composition stable for the direct Anthropic adapter", () => {
    expect(createHash("sha256").update(WORLD).digest("hex")).toBe("73a03edec3282fafe8503ca53b366c1a892e8326f574fe5f283fe5cc1afbdf08");
  });

  it("keeps every dynamic perception field and the entire persona, without modifying the inputs", () => {
    const { a, b, perception: p } = contexts();
    p.hint = "Look at the dock"; p.crossroads = "An urgent letter";
    p.owner_letters = [{ id: 7, text: "Did you arrive safely?" }];
    p.self.food_advice = [{ from: b.id, name: "Tomás", place: "market", item: "bread", confidence: .6, source_t: 20, shared_t: 30, trust: .8, tested: false }];
    p.self.learned_food = [{ place: "market", item: "bread", confidence: .7, observations: 2 }];
    p.self.deals = [{ id: 9, with: "Tomás", what: "Help with the house", coins: 3, mine: true, state: "open", due_in_days: 2, construction: { site: "lane-1", mornings: 2, done: 1 } }];
    const before = structuredClone(p), agentBefore = structuredClone(a);
    const context = buildDecideContext(p, a);
    expect(JSON.parse(context.user.slice(context.user.lastIndexOf("\n\n") + 2))).toEqual(p);
    expect(Perception.parse(p)).toEqual(p);
    expect(context.system.own).toBe(personaBlock(a));
    for (const text of ["Look at the dock", "An urgent letter", "food_advice", "learned_food", "due_in_days"]) expect(context.user).toContain(text);
    expect(p).toEqual(before); expect(a).toEqual(agentBefore);
  });

  it("selects local mechanics after a stable prefix without removing supported action schemas", () => {
    const { a, perception: p } = contexts();
    const quiet = { ...p, options: ["wait", "move"] satisfies Perception["options"], nearby: [] };
    const ordinary = buildDecideContext(quiet, a);
    const learning = buildDecideContext({ ...quiet, options: [...quiet.options, "propose_skill", "decorate", "start_project"] }, a);
    expect(ordinary.system).toEqual(learning.system);
    expect(ordinary.user).not.toContain(WORLD_RULES.skills);
    expect(learning.user).toContain(WORLD_RULES.skills);
    expect(learning.user).toContain(WORLD_RULES.decoration);
    expect(learning.user).toContain(WORLD_RULES.garden);
    expect(actionProposalSchema(quiet)).toBe(ActionProposal);
    const supported = new Set(Action.options.map(option => option.shape.kind.value));
    expect(ActionKind.options.every(kind => supported.has(kind))).toBe(true);
    for (const kind of ["offer", "accept", "refuse", "settle"]) {
      expect(ActionKind.safeParse(kind).success).toBe(false);
      expect(actionProposalSchema(quiet).safeParse({ action: { kind, to: "neighbor", what: "Help tomorrow" } }).success).toBe(true);
    }
    expect(actionProposalSchema(quiet).safeParse({ action: { kind: "teleport" } }).success).toBe(false);
  });

  it("preserves public speakers and excludes individually supplied private context", () => {
    const { converse: ctx } = contexts();
    const built = buildConverseContext(ctx);
    expect(built.system.own).toBe(conversePrompt.system(ctx));
    expect(built.user).toBe(conversePrompt.user(ctx));
    for (const text of [ctx.aToday!, ctx.bToday!, ...ctx.aMemories, ...ctx.bMemories, ...ctx.rumorsA, personaBlock(ctx.a), personaBlock(ctx.b)]) expect(built.user).not.toContain(text);
    for (const name of [ctx.a.persona.name, ctx.b.persona.name]) expect(built.user).toContain(name);
    expect(built.system.own).toContain(ctx.observedPlace);
    expect(built.user).not.toContain("UNSELECTED_PRIVATE_MEMORY");
    expect(built.system.cacheOwn).toBeUndefined();
    expect(built.system.shared).not.toContain("propose_skill");
  });

  it("preserves plan resources, prices, jobs, places, projects, desires and selected memories", () => {
    const { plan } = contexts();
    const built = buildPlanContext(plan);
    expect(built.user).toBe(planPrompt(plan));
    for (const text of [...plan.jobsOpen, ...plan.land, ...plan.owned, ...plan.building, ...plan.unreadLetters, ...plan.keyMemories, plan.yesterday!, "desire-home", String(plan.builds.house.coins), String(plan.builds.shop.labor)]) expect(built.user).toContain(text);
    for (const place of plan.places) expect(built.user).toContain(`${place.id} (${place.name})`);
    expect(built.user).not.toContain("UNSELECTED_PRIVATE_MEMORY");
    expect(built.system.shared).not.toContain("propose_skill:{recipe");
  });

  it("keeps reflection evidence, source labels and current intentions separate from world facts", () => {
    const { reflect } = contexts();
    const built = buildReflectContext(reflect);
    expect(built.user).toBe(reflectPrompt(reflect));
    for (const text of [...reflect.actionEvidence!, ...reflect.dayMemories, ...reflect.keyMemories, ...reflect.unreadLetters, "desire-home", '"id":41', "execution not verified", reflect.beliefs[0]!.belief, reflect.projects[0]!.progress]) expect(built.user).toContain(text);
    expect(built.user).not.toContain("UNSELECTED_PRIVATE_MEMORY");
    expect(built.system.shared).not.toContain("decorate:{");
    expect(buildReflectContext({ ...reflect, actionEvidence: [], desireEvidence: [] }).user).toContain("No action evidence supplied; do not infer completion.");
  });

  it("keeps opaque primers intact and the existing persona cache policy", () => {
    const { a, primer } = contexts();
    for (const kind of ["action_proposal", "dialogue", "day_plan", "reflection", "digest", "child", "paper", "judgement", "life", "persona_depth"] as const) {
      expect(withPrimer(kind, { shared: "rules" }, primer).shared).toBe(`rules\n\n${primer}`);
      expect(withPrimer(kind, { shared: "rules" }, "").shared).toBe("rules");
    }
    for (const cadence of [null, 5, 8, 20, 1]) expect(cachePersona({ ...a, thinkEvery: cadence })).toBe(cadence !== null && cadence <= 5);
  });

  it("reduces total context for every operation, including selected mechanics in the measurement", () => {
    const { a, perception, plan, converse, reflect } = contexts();
    const cases = [
      [buildDecideContext(perception, a), decidePrompt(perception)],
      [buildPlanContext(plan), planPrompt(plan)],
      [buildConverseContext(converse), conversePrompt.user(converse)],
      [buildReflectContext(reflect), reflectPrompt(reflect)],
    ] as const;
    for (const [context, originalUser] of cases) {
      expect(context.system.shared.length + context.user.length).toBeLessThan(WORLD.length + originalUser.length);
      expect(context.system.shared).not.toBe(WORLD);
    }
  });
});
