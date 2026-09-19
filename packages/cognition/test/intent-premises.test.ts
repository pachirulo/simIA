import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Perception } from "@unwatched/protocol";
import { contexts } from "./fixtures.ts";
import capture from "./fixtures/seed853-regressions.json";
import { decisionIssue } from "../src/semantics/decision.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { MockBrain } from "../src/mock.ts";
import { compareRepair, repairAnchor } from "../src/semantics/repair.ts";
import { Town } from "@unwatched/engine";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const proposal = (intent: string): ActionProposal => ({ action: { kind: "wait" }, intent, remember: [] });
const perception = (): Perception => { const p = contexts().perception; p.recent = []; return p; };

describe("decision intent: physical premises are separate from future choices", () => {
  it("distinguishes an actual engine delivery from speech, including after snapshot restoration", () => {
    const c = contexts(); c.a.persona.name = "Petar Ilić"; c.b.persona.name = "Rosa Vidal";
    c.b.inventory = ["soup"];
    const out = proposal("Rosa gave me soup. I will wait.");
    expect(c.town.apply(c.b, { kind: "say", text: "I gave you soup." }, "claim")).toBe(true);
    expect(decisionIssue(out, c.town.perceive(c.a), c.a.persona.name)?.code).toBe("intent_unverified_premise");
    expect(c.town.apply(c.b, { kind: "give", to: c.a.id, item: "soup" }, "delivery")).toBe(true);
    expect(c.a.inventory).toContain("soup"); expect(c.b.inventory).not.toContain("soup");
    const restored = new Town({ seed: 13, brain: new MockBrain(13) }); restored.restore(c.town.snapshot());
    const a = restored.agents.get(c.a.id)!, p = restored.perceive(a);
    expect(p.recent.some(line => line.includes("Rosa Vidal gave me soup"))).toBe(true);
    expect(decisionIssue(out, p, a.persona.name)).toBeNull();
  });
  it("reproduces the seed 853 premise after isolating its independent action mismatch", () => {
    const p = Perception.parse(capture.decision.perception), out = ActionProposal.parse(capture.decision.output);
    expect(decisionIssue(out, p)?.code).toBe("intent_action_mismatch");
    // Counterfactual action only: keep the recorded intent and all supplied evidence.
    const compatible: ActionProposal = { ...out, action: { kind: "trade", with: "inn", buy: "soup" } };
    expect(decisionIssue(compatible, p)).toMatchObject({ code: "intent_unverified_premise", path: "intent" });
  });

  it("checks physical assertions before/after causal links without mistaking a future plan for a result", () => {
    const p = perception();
    for (const intent of ["I bought bread. I can wait.", "Since I bought bread, I can wait.", "I can wait because I bought bread.", "I bought bread, so I will have something to eat."]) {
      expect(decisionIssue(proposal(intent), p)?.code).toBe("intent_unverified_premise");
      const observed = { ...p, recent: ["[minute 500; recorded observation; quoted claims remain claims] I bought bread."] };
      expect(decisionIssue(proposal(intent), observed)).toBeNull();
    }
  });

  it("allows future, conditional, attributed, uncertain and denied outcomes", () => {
    for (const intent of ["I will have eaten by tomorrow.", "I'll get paid tomorrow.", "I will owe Rosa ten coins.", "I hope to be hired.", "I want to get paid.", "If Rosa gave me soup, I could wait.", "Rosa said she gave me soup. I am still unsure.", "I believe Rosa gave me soup.", "I didn't buy bread.", "Rosa offered soup; the exchange is pending."]) {
      expect(decisionIssue(proposal(intent), perception()), intent).toBeNull();
    }
  });

  it("does not promote speech, interpretation, current inventory or an unselected memory into a receipt", () => {
    const p = perception(); p.self.inventory = ["bread"];
    p.recent = ["[speech] I bought bread.", "[interpretation] I bought bread.", '[observation] Rosa said "I bought bread."'];
    expect(decisionIssue(proposal("I bought bread."), p)?.code).toBe("intent_unverified_premise");
  });

  it("resolves first person from the supplied identity and keeps the recipient and causal clauses separate", () => {
    const p = perception();
    p.recent = ["[event 4, minute 500, agent.give] Rosa Vidal gave Petar Ilić soup."];
    for (const intent of ["Rosa gave me soup.", "I didn't buy bread because Rosa gave me soup."]) {
      expect(decisionIssue(proposal(intent), p, "Petar Ilić")).toBeNull();
      expect(decisionIssue(proposal(intent), p, "Ana")?.code).toBe("intent_unverified_premise");
    }
    p.recent = ["[minute 500; recorded observation; quoted claims remain claims] Rosa Vidal gave me soup."];
    expect(decisionIssue(proposal("Rosa gave me soup."), p)).toBeNull();
    p.recent = ["[event 5, minute 500, agent.trade] Petar Ilić bought bread for 1."];
    expect(decisionIssue(proposal("I bought bread."), p, "Petar Ilić")).toBeNull();
    expect(decisionIssue(proposal("I bought bread."), p, "Ana")?.code).toBe("intent_unverified_premise");
  });

  it("requires explicit reconsideration if a premise repair changes the action", () => {
    const p = perception(), previous = proposal("I bought bread.");
    const anchor = repairAnchor(previous, decisionIssue(previous, p)!)!;
    const next: ActionProposal = { action: { kind: "trade", buy: "bread" }, intent: "I'll buy bread.", remember: [] };
    expect(compareRepair(anchor, next).status).toBe("drift");
    expect(compareRepair(anchor, { ...next, intent: "That purchase is unverified. Instead, I'll buy bread now." }).status).toBe("reconsidered");
    expect(compareRepair(anchor, { ...previous, intent: "The earlier purchase is unverified; I will wait." }).status).toBe("preserved");
  });

  it("repairs only the premise while preserving the recorded feasible purchase and two-call budget", async () => {
    const c = contexts(), p = Perception.parse(capture.decision.perception);
    const original = ActionProposal.parse(capture.decision.output);
    const invalid: ActionProposal = { ...original, action: { kind: "trade", with: "inn", buy: "soup" } };
    const fixed = { ...invalid, intent: "The soup exchange is unverified. I'll buy soup at the inn; eating is a later step." };
    const requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? invalid : fixed) } }] }));
    }));
    const result = await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(p, c.b, 1);
    expect(requests).toHaveLength(2); expect(result).toEqual(fixed);
    expect(requests[1]!.messages.at(-1)!.content).toContain("intent");
    expect(requests[1]!.messages.at(-1)!.content).toContain("unknown");
  });

  it("reports both errors in the original seed 853 answer so one repair can correct them together", async () => {
    const c = contexts(), p = Perception.parse(capture.decision.perception);
    const original = ActionProposal.parse(capture.decision.output);
    const fixed: ActionProposal = { ...original, action: { kind: "trade", with: "inn", buy: "soup" },
      intent: "The exchange with Rosa is unverified. I'll buy soup now and eat it later." };
    const requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? original : fixed) } }] }));
    }));
    const result = await new OpenRouterBrain({ apiKey: "test", allowFallback: false }).decide(p, c.b, 1);
    expect(result).toEqual(fixed); expect(requests).toHaveLength(2);
    const note = requests[1]!.messages.at(-1)!.content;
    expect(note).toContain("contradicts action"); expect(note).toContain("premise of intent");
  });

  it("does not bypass premise validation through the fallback", async () => {
    const c = contexts(), p = perception(), invalid = proposal("I bought bread.");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(invalid) } }] }))));
    vi.spyOn(MockBrain.prototype, "decide").mockResolvedValue(invalid);
    const result = await new OpenRouterBrain({ apiKey: "test" }).decide(p, c.a, 1);
    expect(result).toEqual({ action: { kind: "wait" }, remember: [] });
    expect(isFromFallback(result)).toBe(true); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
