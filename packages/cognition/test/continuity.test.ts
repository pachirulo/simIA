import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, DayPlan } from "@unwatched/protocol";
import { z } from "zod";
import { CognitiveDayPlan } from "../src/schema/plan.ts";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { DecisionContinuity, personalContinuity } from "../src/context/continuity.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { buildConverseContext } from "../src/context/converse.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { contexts } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());
describe("personal continuity without executing intentions", () => {
  it("requires activities on the LLM wire without breaking canonical legacy plans", () => {
    const legacy = { mood: "steady", goals: ["Eat"], steps: [{ hour: 8, place: "market" }] };
    expect(DayPlan.safeParse(legacy).success).toBe(true);
    expect(CognitiveDayPlan.safeParse(legacy).success).toBe(false);
    const plan = { ...legacy, steps: [{ ...legacy.steps[0], do: "Buy breakfast" }] };
    expect(DayPlan.parse(CognitiveDayPlan.parse(plan))).toEqual(plan);
    const wire = z.toJSONSchema(CognitiveDayPlan) as any;
    expect(wire.properties.steps.items.required).toContain("do");
    expect(wire.properties.steps.minItems).toBe(1); expect(wire.properties.steps.maxItems).toBe(6);
  });

  it("omits null optional strings without replacing an executable action or deleting meaningful nulls", () => {
    const raw = { action: { kind: "trade", buy: "bread", sell: null }, desire_id: null, intent: null, remember: [] };
    const result = ActionProposal.parse(normalizeOptionalStrings(raw, ActionProposal));
    expect(result).toEqual({ action: { kind: "trade", buy: "bread" }, remember: [] });
    const schema = z.object({ optional: z.string().nullable().optional(), required: z.string(), number: z.number().optional() });
    expect(normalizeOptionalStrings({ optional: null, required: null, number: null }, schema)).toEqual({ optional: null, required: null, number: null });
    expect(schema.safeParse(normalizeOptionalStrings({ required: null }, schema)).success).toBe(false);
  });
  it("keeps missed plans revisable and attendance distinct from accomplishment", () => {
    const { a, perception: p } = contexts();
    p.today = { mood: "steady", goals: ["Get materials"], steps: [
      { hour: 7, do: "Buy materials", place: "sawpit", done: false, missed: true },
      { hour: 8, do: "Eat", place: "market", done: true },
    ] };
    a.intentions = ["Get materials, unless something changes"];
    a.heading = "sawpit";
    const before = structuredClone(a), perceptionBefore = structuredClone(p);
    const built = buildDecideContext(p, a);
    expect(built.user).toContain("NOT completed work");
    expect(built.user).toContain("not a cancelled goal");
    expect(built.user).toContain("Travel destination already chosen=sawpit");
    expect(built.user).toContain(a.intentions[0]);
    expect(a).toEqual(before); expect(p).toEqual(perceptionBefore);
  });

  it("recovers recent speech omitted by retrieval without converting it into a task or sharing private memories", () => {
    const { a, perception: p } = contexts();
    a.memory.push({ t: 360, kind: "obs", text: 'I said: "I might go to the sawpit tomorrow."', importance: .2 });
    const text = personalContinuity(p, a);
    expect(text).toContain("claims/promises, not completed acts");
    expect(text).toContain("might");
    expect(text).not.toContain("UNSELECTED_PRIVATE_MEMORY");
    p.recent.push(a.memory.at(-1)!.text);
    expect(personalContinuity(p, a)).not.toContain("might");
  });

  it("shows held food despite a contradictory engine memory and keeps the stable prefix identical", () => {
    const { a, perception: p } = contexts();
    const before = buildDecideContext(p, a);
    p.self.inventory = ["bread"]; p.self.needs.hunger = 1;
    p.self.learned_food = [{ item: "bread", place: "market", observations: 1, confidence: .7 }];
    p.recent.push("[recorded observation] I am very hungry and have nothing to eat.");
    const after = buildDecideContext(p, a);
    expect(after.system).toEqual(before.system);
    expect(after.user).toContain('use ["bread"] can eat now');
    expect(after.user).toContain("neither eats");
    expect(JSON.parse(after.user.slice(after.user.lastIndexOf("\n\n") + 2))).toEqual(p);
  });

  it("distinguishes talk, rejected proposals and observed movement without guessing execution", () => {
    const { a, town } = contexts(); const c = new DecisionContinuity();
    let p = town.perceive(a);
    c.record(a, p, { action: { kind: "say", text: "Let's go" }, remember: [] });
    town.t++; p = town.perceive(a);
    c.record(a, p, { action: { kind: "move", to: "missing-place" }, remember: [] });
    expect(town.apply(a, { kind: "move", to: "missing-place" }, "test")).toBe(false);
    town.t++; p = town.perceive(a);
    expect(c.describe(a, p)).toContain("still at the same location");
    expect(c.describe(a, p)).toContain("does not prove rejection");
    expect(c.describe(a, p)).toContain("not execution receipts");
    c.record(a, p, { action: { kind: "move", to: "inn" }, remember: [] });
    expect(town.apply(a, { kind: "move", to: "inn" }, "test")).toBe(true);
    town.t++;
    expect(c.describe(a, town.perceive(a))).toContain('"location":{"from":"market","to":"inn"}');
    expect(c.describe(a, town.perceive(a))).not.toContain("still at the same location");
  });

  it("bounds history, expires stale attempts and isolates towns with identical IDs", () => {
    const { a, town } = contexts(); const c = new DecisionContinuity();
    for (let i = 0; i < 5; i++) { c.record(a, town.perceive(a), { action: { kind: "wait" }, remember: [] }); town.t++; }
    expect(c.describe(a, town.perceive(a)).match(/"kind":"wait"/g)).toHaveLength(3);
    expect(c.describe(contexts().a, town.perceive(a))).toBe("");
    const later = town.perceive(a); later.time.day += 2;
    expect(c.describe(a, later)).toBe("");
  });

  it("withholds private resources from the shared dialogue writer without mutating speakers", () => {
    const { converse: ctx } = contexts(); ctx.a.needs.hunger = 1; ctx.a.inventory = ["bread"];
    const before = structuredClone(ctx);
    const prompt = buildConverseContext(ctx).user;
    expect(prompt).not.toContain('"hunger":1'); expect(prompt).not.toContain('"inventory":["bread"]');
    expect(prompt).toContain("private motives are unavailable");
    expect(ctx).toEqual(before);
  });

  it("rejects redundant arrival and absent addressees but preserves choices and supported name aliases", () => {
    const { perception: p, b } = contexts();
    expect(decisionIssue({ action: { kind: "move", to: p.place.id }, remember: [] }, p)?.code).toBe("move_already_here");
    expect(decisionIssue({ action: { kind: "say", to: "absent-person", text: "Voy" }, remember: [] }, p)?.code).toBe("say_not_present");
    expect(decisionIssue({ action: { kind: "say", to: b.persona.name.split(" ")[0], text: "I changed my mind; I will stay and talk." }, remember: [] }, p)).toBeNull();
    // Selling food can be an intentional choice. No automatic order to eat.
    p.self.inventory = ["bread"];
    expect(decisionIssue({ action: { kind: "trade", sell: "bread" }, intent: "I want coins instead", remember: [] }, p)).toBeNull();
  });

  it("passes continuity through the real adapter and reconciles buy -> eat using engine state", async () => {
    const { a, town } = contexts(); a.inventory = []; a.needs.hunger = 1;
    const posted: { messages: { role: string; content: unknown }[] }[] = [];
    const replies = [
      { action: { kind: "trade", buy: "bread", sell: "" }, desire_id: null, remember: [] },
      { action: { kind: "use", item: "bread" }, intent: null, remember: [] },
      { action: { kind: "wait" }, remember: [] },
    ];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      posted.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] }));
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false, logGeneration: false });
    for (let i = 0; i < 3; i++) {
      const out = await brain.decide(town.perceive(a), a, 1);
      expect(ActionProposal.safeParse(out).success).toBe(true);
      expect(town.apply(a, out.action, "test")).toBe(true); town.t++;
    }
    expect(a.needs.hunger).toBe(.4); expect(a.inventory).toEqual([]);
    const second = JSON.stringify(posted[1]);
    expect(second).toContain("Previous proposals"); expect(second).toContain("Food is already carried");
    expect(JSON.stringify(posted[2])).toContain('hunger');
    expect(posted[0]!.messages[0]).toEqual(posted[1]!.messages[0]);
    expect(town.events.filter(e => e.kind === "agent.eat")).toHaveLength(1);
    expect(posted).toHaveLength(3); // no repair replaces an executable proposal
  });

  it("documents engine limits: attendance is not completion and mill stock is not a public shop", async () => {
    const { a, town } = contexts(); town.paused = true;
    a.location = "bakery"; a.needs.hunger = .1; a.needs.social = 0;
    a.plan = { day: town.day, mood: "steady", goals: ["Eat"], steps: [{ hour: town.hour, do: "Eat breakfast", place: a.location, done: false }] };
    await town.tick();
    expect(a.plan.steps[0]!.done).toBe(true);
    expect(town.events.some(e => e.kind === "agent.eat")).toBe(false);
    a.location = "mill";
    expect(town.places.get("mill")!.stock.flour).toBeGreaterThan(0);
    expect(town.perceive(a).place.for_sale.some(x => x.item === "flour")).toBe(false);
    expect(town.apply(a, { kind: "trade", buy: "flour" }, "test")).toBe(false);
  });

  it("documents that an engine heading overrides habit buying food even when hungry", async () => {
    const { a, town } = contexts(); town.paused = true;
    a.needs.hunger = .9; a.inventory = []; a.coins = 40; a.heading = "mill";
    a.plan = { day: town.day, mood: "steady", goals: [], steps: [] };
    expect(town.perceive(a).place.for_sale.some(x => x.item === "bread")).toBe(true);
    await town.tick();
    expect(a.location).toBe("hill"); expect(a.inventory).toEqual([]);
    expect(town.events.some(e => e.actors.includes(a.id) && e.kind === "agent.trade")).toBe(false);
  });
});
