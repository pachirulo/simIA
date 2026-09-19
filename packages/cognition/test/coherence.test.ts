import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Dialogue, Reflection, Perception } from "@unwatched/protocol";
import { decisionIssue } from "../src/semantics/decision.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { repairAnchor, compareRepair, restoreRepairMetadata } from "../src/semantics/repair.ts";
import { groundedClaimIssue, observedRecords, conditionIssue } from "../src/semantics/evidence.ts";
import { DecisionContinuity } from "../src/context/continuity.ts";
import { buildPlanContext } from "../src/context/plan.ts";
import { buildConverseContext } from "../src/context/converse.ts";
import { buildDecideContext } from "../src/context/decide.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { contexts } from "./fixtures.ts";
import { incoherentMeal, inventedMeal, malformedFlour, substitutedBread, misattributedRumor, inventedDebt } from "./fixtures/coherence.ts";

const captures = JSON.parse(readFileSync(new URL("./fixtures/coherence-captures.json", import.meta.url), "utf8").replace(/^\uFEFF/u, "")) as {
  id: string; input: { messages: { role: string; content: string | { text: string }[] }[] }; output: unknown;
}[];
const capture = (id: string) => captures.find(c => c.id === id)!;
const capturedPerception = (id: string) => {
  const c = capture(id), user = c.input.messages.find(m => m.role === "user")!.content as string;
  return Perception.parse(JSON.parse(user.slice(user.lastIndexOf("\n\n") + 2)));
};
const action = (kind: ActionProposal["action"], intent?: string): ActionProposal => ActionProposal.parse({ action: kind, intent, remember: [] });
const named = () => { const c = contexts(); c.a.persona.name = "Inés Vidal"; c.b.persona.name = "Pedro Ibáñez"; return c; };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("reported coherence regressions (synthetic, not captured generations)", () => {
  it("R1: rejects an explicit decision to eat without buying returned as trade", () => {
    const p = contexts().perception; p.self.inventory = ["bread"];
    expect(decisionIssue(incoherentMeal, p)?.code).toBe("intent_action_mismatch");
  });
  it("R4: a compound past-tense memory cannot turn a proposal into a meal", () => {
    const p = contexts().perception; p.recent = [];
    expect(decisionIssue(inventedMeal, p)?.code).toBe("memory_unverified_outcome");
  });
});

describe("original generations supplied by the user, retrieved verbatim", () => {
  it("R1: the supplied perception explicitly carries bread; original trade contradicts intent", () => {
    const id = "gen-1789705637-qaa4XTCNeeXAjMF4mQSd", p = capturedPerception(id);
    expect(p.self.inventory).toContain("bread");
    expect(decisionIssue(ActionProposal.parse(capture(id).output), p)?.code).toBe("intent_action_mismatch");
  });
  it("R2: original and repaired requests differ only by the semantic error turn", () => {
    const original = capture("gen-1789705655-6q5lQaegSnuFhkaJXj0t"), repaired = capture("gen-1789705657-uRziC09WVp3XOzhc8d5O");
    expect(repaired.input.messages.slice(0, 2)).toEqual(original.input.messages.slice(0, 2));
    const p = capturedPerception(original.id), proposal = ActionProposal.parse(original.output), issue = decisionIssue(proposal, p)!;
    expect(issue.code).toBe("reference_not_name");
    const anchor = repairAnchor(proposal, issue)!;
    expect(compareRepair(anchor, repaired.output).status).toBe("drift");
  });
  it("R3: Inés is B; her claim becomes Pedro's quote in b_remember", () => {
    const c = named(), out = Dialogue.parse(capture("gen-1789705491-i0df6nFfc94tMPdPcyox").output);
    const ctx = { ...c.converse, a: c.b, b: c.a };
    expect(dialogueIssue(out, ctx)?.code).toBe("dialogue_misattribution");
    out.outcome.b_remember = "I introduced the five-coin rumor; Pedro offered to bake if we get flour.";
    expect(dialogueIssue(out, ctx)?.code).toBe("rumor_direction");
    out.outcome.rumor = null;
    expect(dialogueIssue(out, ctx)).toBeNull();
  });
  it("R4a: the original memory invents a new meal without evidence in recent", () => {
    const id = "gen-1789705658-f1Cr1aLPlteUnbghWXhh";
    const issue = decisionIssue(ActionProposal.parse(capture(id).output), capturedPerception(id));
    expect(issue?.code).toBe("trade_item_intent_mismatch");
    expect(issue?.message).toContain("Also fix remember");
    expect(issue?.message).toContain("Unsupported physical claim");
  });
  it("R4b: actual reflection's asserted obligation has no support in its supplied evidence", () => {
    const c = named(), out = Reflection.parse(capture("gen-1789705671-U7aI92Cjjc43li4TkcKA").output);
    // Isolate the debt sentence; the complete original remains in the fixture.
    c.reflect.dayMemories = ["[minute 600; reported speech, not verified experience] I'll pay ten when the bread is in my kitchen."];
    const debt = { ...out, summary: "I still owe Pedro his ten.", insights: [], intentions: [], opinions: [], self: {}, projects: [], beliefs: [] };
    expect(reflectionIssue(debt, c.reflect)?.code).toBe("unverified_obligation");
  });
});

describe("coherence preserves legitimate choices and known limits", () => {
  it("announcing a later trip is a speech act, not immediate movement", () => {
    const p = contexts().perception;
    expect(decisionIssue(action({ kind: "say", text: "I will go to the market and then return." },
      "I acknowledge Pedro's presence and set my immediate course: I will go to the market to learn the town's news and people, then return to the inn."), p)).toBeNull();
    expect(decisionIssue(action({ kind: "trade", buy: "bread" }, "I'll eat the bread I already carry right now."), p)?.code).toBe("intent_action_mismatch");
  });
  it("retains an omitted desire association only for an unchanged action", () => {
    const original = { action: { kind: "trade", buy: "bread" }, desire_id: "food", remember: ["I bought bread."] };
    const anchor = repairAnchor(original, { code: "memory_unverified_outcome", path: "remember.0", message: "No receipt" })!;
    const repaired = { action: { kind: "trade", buy: "bread" }, remember: [] };
    expect(restoreRepairMetadata(anchor, repaired)).toEqual({ ...repaired, desire_id: "food" });
    expect(repaired).not.toHaveProperty("desire_id");
    expect(compareRepair(anchor, repaired).status).toBe("preserved");
    expect(restoreRepairMetadata(anchor, { ...repaired, desire_id: "other" })).toHaveProperty("desire_id", "other");
    expect(restoreRepairMetadata(anchor, { ...repaired, action: { kind: "move", to: "inn" } })).not.toHaveProperty("desire_id");
  });
  it("allows an added desire association for the same action but protects an existing goal and destination", () => {
    // Live seed 468: gen-1789716659-wQ7l8Td1L2JGOESPXYV6 -> gen-1789716663-O627XuVeHlIqWrfNWDIQ.
    const original = { action: { kind: "trade", with: "market" }, remember: ["Bought bread at the market to eat."] };
    const issue = { code: "memory_unverified_outcome", path: "remember[0]", message: "No receipt" };
    const anchor = repairAnchor(original, issue)!;
    const repaired = { action: original.action, desire_id: "d1", remember: [] };
    expect(compareRepair(anchor, repaired)).toMatchObject({ status: "preserved", changed: ["desire_id"], issue: null });
    expect(compareRepair(repairAnchor({ ...original, desire_id: "d2" }, issue)!, repaired).status).toBe("drift");
    expect(compareRepair(anchor, { ...repaired, action: { kind: "trade", with: "inn" } }).status).toBe("drift");
  });
  it.each([
    ["Eat something cheap", { kind: "trade", buy: "bread" }],
    ["Buy bread to eat later", { kind: "trade", buy: "bread" }],
    ["I'll eat after buying bread", { kind: "trade", buy: "bread" }],
    ["I'm starving, so I'll buy bread from the shelf with my coins, then eat it right away.", { kind: "trade", buy: "bread" }],
    ["I have bread, but I buy another for tomorrow", { kind: "trade", buy: "bread" }],
    ["I sell bread to earn coins", { kind: "trade", sell: "bread" }],
    ["Although I am hungry, I prefer to talk to my friend", { kind: "say", text: "Hello" }],
    ["There might be someone at the mill; I will go to check", { kind: "move", to: "mill" }],
    ["I will not buy more; I will eat the bread", { kind: "use", item: "bread" }],
  ] as const)("does not force one policy: %s", (intent, act) => {
    const p = contexts().perception; p.self.inventory = ["bread"];
    expect(decisionIssue(action(act, intent), p)).toBeNull();
  });
  it("checks the observed local offer without assuming a person's private inventory", () => {
    const p = contexts().perception; p.place.stock = { flour: 100 };
    expect(decisionIssue(action({ kind: "trade", buy: "flour" }), p)?.code).toBe("trade_not_offered");
    expect(decisionIssue(action({ kind: "trade", buy: "flour", with: p.nearby[0]!.agent }), p)).toBeNull();
    p.self.coins = 0;
    expect(decisionIssue(action({ kind: "trade", buy: "bread" }), p)?.code).toBe("trade_unaffordable");
  });
  it("a faithful field repair preserves product and destination; an explicit new plan is different", () => {
    const anchor = repairAnchor(malformedFlour, { code: "reference_not_name", path: "action.sell", message: "Invalid item" })!;
    const repaired = structuredClone(malformedFlour); delete (repaired.action as { sell?: string }).sell;
    expect(compareRepair(anchor, repaired).status).toBe("preserved");
    expect(compareRepair(anchor, substitutedBread).issue?.code).toBe("repair_intention_drift");
    expect(compareRepair(anchor, { ...substitutedBread, intent: "The mill is not available as a local counter; I change my plan and buy bread for tomorrow." }).status).toBe("reconsidered");
  });
  it("keeps payments conditional and permits established debt without requiring a new payment", () => {
    const c = named();
    expect(reflectionIssue(inventedDebt, c.reflect)?.code).toBe("unverified_obligation");
    const future = { ...inventedDebt, summary: "I will pay Pedro ten coins when he delivers bread." };
    expect(reflectionIssue(future, c.reflect)).toBeNull();
    c.a.debts = [{ to: c.b.id, coins: 10, due: 3000 }]; c.reflect.relationships[0]!.name = c.b.persona.name;
    expect(reflectionIssue(inventedDebt, c.reflect)).toBeNull();
    expect(reflectionIssue({ ...inventedDebt, summary: "I owe Pedro twenty coins." }, c.reflect)?.code).toBe("unverified_obligation");
  });
  it("does not drop a condition from the matching payment promise", () => {
    const evidence = ["I'll pay Pedro ten coins when he delivers bread."];
    expect(conditionIssue("I agreed to pay Pedro ten coins.", "memory", evidence)?.code).toBe("agreement_condition_lost");
    expect(conditionIssue("I agreed to pay Pedro ten coins when he delivers bread.", "memory", evidence)).toBeNull();
    expect(conditionIssue("I agreed to pay Ana five coins.", "memory", [])).toBeNull();
  });
  it("keeps restart and third-party state changes separate from action receipts", () => {
    const c = contexts(), continuity = new DecisionContinuity();
    continuity.record(c.a, c.town.perceive(c.a), action({ kind: "wait" }));
    c.town.t++; c.a.inventory.push("bread");
    expect(continuity.describe(c.a, c.town.perceive(c.a))).toContain("execution result remains unknown");
    expect(new DecisionContinuity().describe(c.a, c.town.perceive(c.a))).toBe("");
  });
  it("checks nested reflection fields and does not invent memory evidence", () => {
    const c = contexts(), base = { summary: "A quiet day.", insights: [], intentions: [], opinions: [], letter_to_owner: null };
    expect(reflectionIssue({ ...base, projects: [{ title: "Roof", progress: "I repaired the roof." }] }, c.reflect)?.path).toBe("projects.0.progress");
    expect(reflectionIssue({ ...base, intentions: ["I want to get hired tomorrow."] }, c.reflect)).toBeNull();
    expect(reflectionIssue({ ...base, summary: "I need paid work." }, c.reflect)).toBeNull();
  });
  it("does not use someone else's action, a quote, or a rejection as personal proof", () => {
    const ctx = { selfNames: ["Inés Vidal"], records: observedRecords([
      '[event 1, minute 100, agent.trade] Pedro bought bread.',
      '[event 2, minute 101, action.rejected] Inés Vidal tried to trade but not enough coins.',
      '[minute 102; recorded observation; quoted claims remain claims] Pedro said "I bought bread."',
    ]) };
    expect(groundedClaimIssue("I bought bread.", "remember", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push({ source: "event", kind: "agent.trade", text: "Inés Vidal bought bread for 1." });
    expect(groundedClaimIssue("I bought bread.", "remember", ctx)).toBeNull();
    expect(groundedClaimIssue("I sold bread.", "remember", ctx)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate some of it.", "remember", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push({ source: "event", kind: "agent.eat", text: "Inés Vidal ate bread." });
    expect(groundedClaimIssue("I ate some of it.", "remember", ctx)).toBeNull();
    expect(groundedClaimIssue("I bought flour.", "remember", ctx)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I paid Pedro 10 coins.", "remember", { ...ctx, records: [{ source: "event", kind: "agent.give", text: "Inés Vidal paid Pedro 10 coins." }] })).toBeNull();
  });
  it("preserves speaker and rumor direction in synthetic English regression", () => {
    const c = named();
    expect(dialogueIssue(misattributedRumor, c.converse)?.code).toBe("dialogue_misattribution");
    const out = structuredClone(misattributedRumor);
    out.outcome.a_remember = "I mentioned a rumor: flour costs five coins.";
    expect(dialogueIssue(out, c.converse)).toBeNull();
    out.outcome.rumor = "Inés says flour costs five coins, unconfirmed.";
    expect(dialogueIssue(out, c.converse)).toBeNull();
  });
  it("exposes inventory in planning and private-state boundaries without mutating perception", () => {
    const c = contexts(); c.a.inventory = ["bread", "bread"];
    expect(buildPlanContext(c.plan).user).toContain('["bread","bread"]');
    expect(buildConverseContext(c.converse).user).toContain("private motives are unavailable");
    c.perception.self.inventory = [...c.a.inventory]; const before = structuredClone(c.perception);
    const user = buildDecideContext(c.perception, c.a).user;
    expect(user).toContain('carried quantities={"bread":2}');
    expect(JSON.parse(user.slice(user.lastIndexOf("\n\n") + 2))).toEqual(before);
    expect(c.perception).toEqual(before);
  });
});

describe("actual provider path and unchanged world integration", () => {
  it("a valid proposal can become impossible between perception and execution", () => {
    const c = contexts(), before = c.town.perceive(c.a);
    const proposal = action({ kind: "say", to: c.b.id, text: "Hello" }, "I will speak with you.");
    expect(decisionIssue(proposal, before)).toBeNull();
    c.b.location = "inn";
    expect(c.town.apply(c.a, proposal.action, "perception race")).toBe(false);
    expect(c.town.events.at(-1)!.kind).toBe("action.rejected");
    expect(decisionIssue(proposal, c.town.perceive(c.a))).not.toBeNull();
  });
  it("an actual delivery supplies evidence; a promise alone does not", () => {
    const c = contexts(); c.a.inventory = ["bread"];
    const claim = `I gave ${c.b.persona.name} bread.`;
    const evidence = { selfNames: [c.a.persona.name], records: observedRecords([]) };
    expect(groundedClaimIssue(claim, "remember", evidence)?.code).toBe("memory_unverified_outcome");
    expect(c.town.apply(c.a, { kind: "give", to: c.b.id, item: "bread" }, "actual delivery")).toBe(true);
    expect(c.a.inventory).not.toContain("bread"); expect(c.b.inventory).toContain("bread");
    const event = c.town.events.filter(e => e.kind === "agent.give").at(-1)!;
    evidence.records = observedRecords([`[event ${event.id}, minute ${event.t}, ${event.kind}] ${event.text}`]);
    expect(groundedClaimIssue(claim, "remember", evidence)).toBeNull();
    // A delivery does not itself create a loan or prove that a separate payment happened.
    expect(c.a.debts).toEqual([]);
    expect(groundedClaimIssue(`I paid ${c.b.persona.name} 10 coins.`, "remember", evidence)?.code).toBe("memory_unverified_outcome");
  });
  function provider(replies: unknown[]) {
    const requests: { messages: { role: string; content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(replies[Math.min(requests.length - 1, replies.length - 1)]) } }], usage: { prompt_tokens: 100, completion_tokens: 50, cost: .001 } }));
    }));
    return requests;
  }
  it("repairs R1 to use and verifies consumption only after the unchanged engine applies it", async () => {
    const c = contexts(); c.a.inventory = ["bread"]; c.a.needs.hunger = .9;
    const good = action({ kind: "use", item: "bread" }, "I will eat the bread now.");
    const requests = provider([incoherentMeal, good]), brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    const out = await brain.decide(c.town.perceive(c.a), c.a, 1);
    expect(c.a.inventory).toEqual(["bread"]); expect(out.remember).toEqual([]);
    expect(requests[1]!.messages.at(-1)!.content).toContain("Previous candidate data");
    expect(c.town.apply(c.a, out.action, "coherence integration")).toBe(true);
    expect(c.a.inventory).toEqual([]); expect(c.a.needs.hunger).toBeLessThan(.9);
    expect(c.town.events.at(-1)!.kind).toBe("agent.eat"); expect(brain.usage().calls).toBe(2);
  });
  it("preserves the desire association through the actual OpenRouter memory repair", async () => {
    const c = contexts(); c.perception.recent = [];
    const first = { action: { kind: "trade", buy: "bread" }, desire_id: "food", remember: ["I bought bread."] };
    const requests = provider([first, { action: first.action, remember: [] }]);
    const out = await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(c.perception, c.a, 1);
    expect(out).toEqual({ action: first.action, desire_id: "food", remember: [] });
    expect(requests).toHaveLength(2);
  });
  it("rejects silent repair drift in strict mode after the same two attempts", async () => {
    const c = contexts(); const requests = provider([malformedFlour, substitutedBread]);
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    await expect(brain.decide(c.perception, c.a, 1)).rejects.toThrow("no synthetic response");
    expect(requests).toHaveLength(2);
  });
  it("accepts adding an association during a memory repair without a third call or fallback", async () => {
    const c = contexts(); c.perception.recent = [];
    const first = { action: { kind: "trade", buy: "bread", sell: "" }, remember: ["I bought bread."] };
    const repaired = { action: { kind: "trade", buy: "bread" }, desire_id: "food", remember: [] };
    const requests = provider([first, repaired]);
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.decide(c.perception, c.a, 1)).toEqual(repaired);
    expect(brain.usage().calls).toBe(2); expect(requests).toHaveLength(2);
  });
  it("schema repair preserves the operation even when the original coins type is invalid", async () => {
    const c = contexts(), bad = { action: { kind: "trade", buy: "bread", coins: "one" }, remember: [] };
    const good = action({ kind: "trade", buy: "bread", coins: 1 });
    const requests = provider([bad, good]);
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(c.perception, c.a, 1)).toEqual(good);
    expect(requests).toHaveLength(2);
    provider([bad, action({ kind: "move", to: "inn" })]);
    await expect(new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(c.perception, c.a, 1)).rejects.toThrow("no synthetic response");
  });
  it("repairs conversation attribution and does not let a bad fallback reintroduce it", async () => {
    const c = named(), good = structuredClone(misattributedRumor); good.outcome.a_remember = "I introduced the unverified rumor about flour.";
    provider([misattributedRumor, good]);
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).converse(c.converse)).toEqual(good);
    provider([misattributedRumor]); vi.spyOn(MockBrain.prototype, "converse").mockResolvedValue(misattributedRumor);
    const out = await new OpenRouterBrain({ apiKey: "test" }).converse(c.converse);
    expect(isFromFallback(out)).toBe(true); expect(out.outcome.a_remember).toBe(""); expect(out.outcome.rumor).toBeNull();
  });
  it("repairs conditional debt and guards the reflection fallback too", async () => {
    const c = named(), good = { ...inventedDebt, summary: "I will pay Pedro if he delivers bread." };
    provider([inventedDebt, good]);
    expect(await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).reflect(c.reflect)).toEqual(good);
    provider([inventedDebt]); vi.spyOn(MockBrain.prototype, "reflect").mockResolvedValue(inventedDebt);
    const out = await new OpenRouterBrain({ apiKey: "test" }).reflect(c.reflect);
    expect(isFromFallback(out)).toBe(true); expect(reflectionIssue(out, c.reflect)).toBeNull();
  });
  it("repairs the payment clause after a documented arrival within the existing response budget", async () => {
    const c = contexts(), arrival = c.town.events.find(e => e.kind === "agent.arrive" && e.actors.includes(c.a.id))!;
    c.reflect.actionEvidence = [`[event ${arrival.id}, minute ${arrival.t}, ${arrival.kind}] ${arrival.text}`];
    const bad = { summary: "I arrived in town, paid for three nights at the inn, and looked for work.", insights: [], intentions: [], opinions: [], letter_to_owner: null };
    const good = { ...bad, summary: "I arrived in town and looked for work." };
    const requests = provider([bad, good]), brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(c.reflect)).toEqual(good);
    expect(requests[1]!.messages.at(-1)!.content).toContain('Unsupported physical claim: "paid for three nights at the inn');
    expect(brain.usage().calls).toBe(2); expect(requests).toHaveLength(2);
  });
});
