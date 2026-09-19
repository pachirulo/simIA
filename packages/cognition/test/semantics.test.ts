import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, type Perception } from "@unwatched/protocol";
import { decisionIssue, concreteReferenceIssue, workIssue } from "../src/semantics/decision.ts";
import { outputQualityIssue } from "../src/semantics/quality.ts";
import { planIssue, reflectionIssue } from "../src/semantics/lifecycle.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { buildPlanContext } from "../src/context/plan.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { contexts } from "./fixtures.ts";

const proposal = (action: ActionProposal["action"], rest: Partial<ActionProposal> = {}): ActionProposal => ActionProposal.parse({ action, remember: [], ...rest });
function hungry(): Perception {
  const p = contexts().perception;
  p.self.coins = 40; p.self.job = null; p.self.shift = null; p.self.inventory = [];
  p.self.needs.hunger = .95; p.self.feels = { hunger: "starving; a day that ends like this counts against you", rest: "rested", social: "content" };
  p.place.for_sale = [{ item: "bread", price: 1 }, { item: "soup", price: 2 }];
  return p;
}
const recipe = (item = "bread"): ActionProposal["action"] => ({ kind: "propose_skill", recipe: { name: "Comer en el mercado", goal: "eat", steps: [{ kind: "trade", buy: "bread" }, { kind: "use", item }] } });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("cognitive semantic contract (no world mutations)", () => {
  it("reconsiders optional skill creation during starvation, without inventing a food allowlist", () => {
    const p = hungry(); const snapshot = structuredClone(p);
    expect(decisionIssue(proposal(recipe()), p)?.code).toBe("urgent_need_unaddressed");
    expect(decisionIssue(proposal({ kind: "trade", buy: "bread" }), p)).toBeNull();
    expect(decisionIssue(proposal({ kind: "use", item: "bread" }), p)?.code).toBe("use_not_carried");
    expect(p).toEqual(snapshot);
    p.self.inventory = ["bread"];
    expect(decisionIssue(proposal({ kind: "use", item: "bread" }), p)).toBeNull();
  });

  it("permits conscious risk, kindness, theft and disagreement with plans", () => {
    const p = hungry();
    expect(decisionIssue(proposal(recipe(), { intent: "Although I am hungry, I prefer to take the risk to teach my daughter." }), p)).toBeNull();
    expect(decisionIssue(proposal({ kind: "take", item: "bread" }), p)).toBeNull();
    p.nearby.push({ agent: "neighbor", name: "Vecino" });
    expect(decisionIssue(proposal({ kind: "give", to: "neighbor", coins: 35 }, { intent: "I want to help him even if I go hungry." }), p)).toBeNull();
  });

  it("asks for an intentional tradeoff when exhausted, but permits sleep", () => {
    const p = hungry(); p.self.feels = { hunger: "fed", rest: "exhausted", social: "content" };
    expect(decisionIssue(proposal(recipe()), p)?.code).toBe("urgent_need_unaddressed");
    expect(decisionIssue(proposal({ kind: "sleep" }), p)).toBeNull();
    expect(decisionIssue(proposal(recipe(), { intent: "I am exhausted, but I want to finish this recipe out of pride." }), p)).toBeNull();
  });

  it("work in options never proves employment or a working Sunday", () => {
    const p = contexts().perception; p.time.weekday = "Sunday"; p.self.job = null;
    expect(p.options).toContain("work");
    expect(decisionIssue(proposal({ kind: "work" }, { intent: "Earn money" }), p)?.code).toBe("work_precondition");
    p.time.weekday = "Monday";
    expect(workIssue(p)?.message).toContain("No assigned job");
    p.place.jobs_open = ["market-help"];
    expect(decisionIssue(proposal({ kind: "apply" }), p)).toBeNull();
  });

  it("checks known shift boundaries, allows site work on Sunday and refuses actual weakness", () => {
    const p = contexts().perception; p.time.weekday = "Monday";
    p.self.job = "Helper"; p.self.shift = { place: p.place.id, wage: 3, hours: [8, 16] };
    p.time.minute = 8 * 60; expect(workIssue(p)).toBeNull();
    p.time.minute = 16 * 60; expect(workIssue(p)?.message).toContain("Outside");
    p.time.minute = 10 * 60; p.self.shift.place = "another-place"; expect(workIssue(p)?.message).toContain("elsewhere");
    p.time.weekday = "Sunday"; p.self.job = null;
    p.place.site = { what: "house", name: "House", by: "Vecino", done: 0, of: 3 };
    expect(workIssue(p)).toBeNull();
    p.self.weak = true; expect(workIssue(p)?.message).toContain("weak");
  });

  it.each(["make soup with whatever", "use whatever food is available", "I will buy bread", "buy bread to eat"])("rejects instruction in a skill item: %s", item => {
    const p = contexts().perception;
    const out = proposal(recipe(item)); // all these were valid canonical strings
    expect(decisionIssue(out, p)?.code).toBe("reference_not_name");
  });

  it("allows unknown concrete nouns, Unicode, multiword items and previously made products", () => {
    for (const name of ["white bean soup", "cornbread", "pak choi", "steamed buns"]) expect(concreteReferenceIssue(name, "item")).toBeNull();
    const p = contexts().perception;
    expect(decisionIssue(proposal({ kind: "propose_skill", recipe: { name: "Preparar sopa", goal: "produce", steps: [
      { kind: "make", item: "bean soup", from: ["beans", "water"] }, { kind: "use", item: "bean soup" },
    ] } }), p)).toBeNull();
    p.place.for_sale.push({ item: "go home", price: 2 }); // odd but real world-supplied name
    expect(decisionIssue(proposal({ kind: "trade", buy: "go home" }), p)).toBeNull();
  });

  it("does not require a future skill work step to be executable now", () => {
    const p = contexts().perception; p.time.weekday = "Sunday"; p.self.job = null;
    expect(decisionIssue(proposal({ kind: "propose_skill", recipe: { name: "Buscar trabajo", goal: "earn", steps: [{ kind: "move", to: "mill" }, { kind: "apply" }, { kind: "work" }] } }), p)).toBeNull();
  });

  it("distinguishes action dispatch from an intentional place name", () => {
    const p = contexts().perception;
    expect(decisionIssue(proposal({ kind: "call", name: "propose_skill" }, { intent: "Registrar un procedimiento" }), p)?.code).toBe("action_dispatch_as_name");
    expect(decisionIssue(proposal({ kind: "call", name: "sleep" }, { intent: "Name this inn Sleep, for tired travelers." }), p)).toBeNull();
  });

  it("rejects punctuation items, inverted trade fields and metadata masquerading as memory", () => {
    const p = hungry();
    expect(decisionIssue(proposal({ kind: "trade", with: "bread", sell: "." }), p)?.code).toBe("reference_not_name");
    expect(decisionIssue(proposal({ kind: "trade", sell: "bread" }), p)?.code).toBe("sell_not_carried");
    expect(decisionIssue(proposal({ kind: "trade", buy: "bread" }, { remember: ["availability_of_bread"] }), p)?.code).toBe("memory_label");
    p.self.inventory = ["bread"];
    expect(decisionIssue(proposal({ kind: "trade", sell: "bread" }), p)).toBeNull();
  });

  it.each(["Go to the market, buy bread and eat it", "I buy bread", "Go to the market and buy food", "Eat the bread", "Greet the neighbor; then go to the market", "I repair the roof"])("do cannot replace concrete operations: %s", what => {
    expect(decisionIssue(proposal({ kind: "do", what }), contexts().perception)?.code).toBe("do_replaces_action");
  });

  it.each(["Sing about buying bread", "Watch the sunset", "Queue to buy bread", "Remember my mother"])("preserves genuinely free deeds: %s", what => {
    expect(decisionIssue(proposal({ kind: "do", what }), contexts().perception)).toBeNull();
  });

  it.each(["The options include 'work' — a wage might come from it.", "The options allow paid work.", "The engine should give me coins for work."])("rejects mechanics speculation in remember: %s", text => {
    expect(decisionIssue(proposal({ kind: "wait" }, { remember: [text] }), contexts().perception)?.code).toBe("memory_system_inference");
  });

  it("does not convert proposed, failed or reported purchases into personal experience", () => {
    const p = contexts().perception;
    for (const claim of ["I bought bread.", "I purchased bread."]) {
      const out = proposal({ kind: "trade", buy: "bread" }, { remember: [claim] });
      p.recent = [`[minute 10; personal interpretation, not verified experience] ${claim}`];
      expect(decisionIssue(out, p)?.code).toBe("memory_unverified_outcome");
      p.recent = [`[minute 10; recorded observation; quoted claims remain claims] ${claim}`];
      expect(decisionIssue(out, p)).toBeNull();
    }
    p.recent = ['[minute 10; recorded observation; quoted claims remain claims] Ana said "I bought bread."'];
    expect(decisionIssue(proposal({ kind: "wait" }, { remember: ["I bought bread."] }), p)?.code).toBe("memory_unverified_outcome");
    for (const memory of ["I tried to buy bread but failed.", "I felt embarrassed to ask for help.", "I believe Ana lied to me.", "Ana said I bought bread."]) expect(decisionIssue(proposal({ kind: "wait" }, { remember: [memory] }), p)).toBeNull();
  });

  it("finds repetitive strings even inside nested fields; preserves normal emphasis", () => {
    for (const text of ["that ".repeat(15), "I will go ".repeat(8), "a".repeat(30)]) {
      expect(outputQualityIssue({ intent: text })?.code).toBe("repetition");
      expect(outputQualityIssue({ recipe: { steps: [{ item: text }] } })?.path).toBe("recipe.steps[0].item");
    }
    expect(outputQualityIssue({ text: "No, no, no. I cannot agree." })).toBeNull();
  });

  it("keeps explicit cache order and complete state, and gives plans physical context", () => {
    const c = contexts(), p = hungry(), before = structuredClone(p);
    const built = buildDecideContext(p, c.a);
    expect(built.system.shared).toContain("NOT currently valid");
    expect(built.system.shared).toContain("Proposing is not doing");
    expect(built.user).toContain("Urgent now: hunger");
    expect(JSON.parse(built.user.slice(built.user.lastIndexOf("\n\n") + 2))).toEqual(p);
    expect(p).toEqual(before);
    expect(buildDecideContext(c.perception, c.b).system.shared).toBe(built.system.shared);
    expect(buildPlanContext(c.plan).user).toContain(JSON.stringify(c.plan.agent.needs));
    expect(planIssue({ mood: "Fine", goals: ["Eat"], steps: [{ hour: 9, place: "go buy bread" }] }, c.plan)?.code).toBe("plan_unknown_place");
    expect(reflectionIssue({ summary: "The options include work.", insights: [], opinions: [], intentions: [], letter_to_owner: null })?.code).toBe("memory_system_inference");
  });
});

describe("OpenRouter semantic repair boundary", () => {
  function mock(replies: ActionProposal[]) {
    const bodies: { messages: { role: string; content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(replies[Math.min(bodies.length - 1, replies.length - 1)]) } }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: .001 } }));
    }));
    return bodies;
  }

  it.each([
    ["hunger", () => proposal(recipe())],
    ["work", () => proposal({ kind: "work" })],
    ["item", () => proposal(recipe("make soup with whatever"))],
    ["trade fields", () => proposal({ kind: "trade", with: "bread", sell: "." })],
    ["do", () => proposal({ kind: "do", what: "Go to the market, buy bread and eat it" })],
    ["remember", () => proposal({ kind: "wait" }, { remember: ["The options include work."] })],
    ["repetition", () => proposal({ kind: "wait" }, { intent: "that ".repeat(20) })],
  ] as const)("repairs a schema-valid %s error once, without executing or replaying invalid text", async (_name, bad) => {
    const good = proposal({ kind: "trade", buy: "bread" }, { intent: "I cannot execute the previous proposal; I change my plan to buy bread now." });
    const bodies = mock([bad(), good]), p = hungry(), a = contexts().a;
    const brain = new OpenRouterBrain({ apiKey: "test", routine: "test", allowFallback: false });
    expect(await brain.decide(p, a, 1)).toEqual(good);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.messages[0]).toEqual(bodies[1]!.messages[0]);
    expect(bodies[1]!.messages.at(-1)!.content).toContain("NOT executed");
    expect(bodies[1]!.messages.some(message => message.role === "assistant")).toBe(false);
    expect(brain.usage().calls).toBe(2);
  });

  it("never delivers a repeated invalid response when fallback is disabled", async () => {
    const bodies = mock([proposal({ kind: "wait" }, { intent: "that ".repeat(20) })]);
    const c = contexts(), hook = vi.fn();
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false }); brain.onFallback = hook;
    await expect(brain.decide(c.perception, c.a, 1)).rejects.toThrow("no synthetic response");
    expect(bodies).toHaveLength(2);
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ reason: "semantic: repetition" }));
  });

  it("an invalid synthetic fallback cannot reintroduce bad memories", async () => {
    mock([proposal({ kind: "wait" }, { intent: "that ".repeat(20) })]);
    vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue(proposal({ kind: "wait" }, { remember: ["The options include work."] }));
    const c = contexts(), brain = new OpenRouterBrain({ apiKey: "test", allowFallback: true });
    const out = await brain.decide(c.perception, c.a, 1);
    expect(out).toEqual(proposal({ kind: "wait" })); expect(isFromFallback(out)).toBe(true);
  });
});
