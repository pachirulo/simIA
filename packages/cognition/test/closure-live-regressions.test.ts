import { expect, it } from "vitest";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";
import { repairAnchor, compareRepair } from "../src/semantics/repair.ts";
import { intentIssue } from "../src/semantics/intent.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { contexts } from "./fixtures.ts";
import { attributionIssue } from "../src/semantics/attribution.ts";
import { sourceAssertions } from "../src/semantics/sources.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";

it("does not call a corrected action discriminator and omitted empty association a new goal", () => {
  const original = { action: { kind: "buy", buy: "bread", coins: 1 }, desire_id: "", intent: "Buy a loaf of bread from the market for breakfast, paying 1 coin from my 40.", remember: [] };
  const anchor = repairAnchor(original, { code: "schema_mismatch", path: "action.kind", message: "Invalid discriminator" })!;
  expect(compareRepair(anchor, { ...original, action: { ...original.action, kind: "trade" }, desire_id: undefined }).status).toBe("preserved");
  expect(compareRepair(anchor, { action: { kind: "trade", buy: "soup", coins: 1 }, remember: [] }).status).toBe("drift");
});

it("allows removing an unknown schema field when correcting the named missing field", () => {
  const original = { action: { kind: "use", food: "bread" }, intent: "Eat the bread I carry.", remember: [] };
  const anchor = repairAnchor(original, { code: "schema_mismatch", path: "action.item", message: "Missing item" })!;
  expect(compareRepair(anchor, { ...original, action: { kind: "use", item: "bread" } }).status).toBe("preserved");
  expect(compareRepair(anchor, { ...original, action: { kind: "trade", buy: "bread" } }).status).toBe("drift");
});

it("does not turn Nothing bought into a purchase, or symbolic office/trust into inventory", () => {
  const ctx = { records: [], selfNames: ["Rosa Vidal"] };
  for (const text of ["Nothing bought.", "I was handed the mayor's seat.", "I got handed the town's trust as mayor."])
    expect(groundedClaimIssue(text, "summary", ctx), text).toBeNull();
  expect(groundedClaimIssue("I bought bread and nothing else.", "summary", ctx)?.code).toBe("memory_unverified_outcome");
  expect(groundedClaimIssue("Petar handed me bread.", "summary", ctx)?.code).toBe("memory_unverified_outcome");
});

it("recognizes using coins to buy as purchase intent, keeping actual consumption distinct", () => {
  expect(intentIssue({ action: { kind: "trade", buy: "bread" }, remember: [], intent: "I use my coins to buy bread." })).toBeNull();
  expect(intentIssue({ action: { kind: "use", item: "bread" }, remember: [], intent: "I use my coins to buy bread." })?.code).toBe("intent_action_mismatch");
});

it("requires the chosen soup in trade.buy instead of silently buying the engine default", () => {
  const p = contexts().perception;
  p.place.for_sale = [{ item: "bread", price: 1 }, { item: "soup", price: 2 }];
  p.self.coins = 10;
  const intent = "Buy a bowl of soup for 2 coins to ease my hunger this morning. I'm not buying bread yet.";
  const bare = { action: { kind: "trade" as const }, intent, remember: [] };
  expect(decisionIssue(bare, p)?.code).toBe("trade_item_intent_mismatch");
  expect(decisionIssue({ ...bare, action: { kind: "trade", buy: "bread" } }, p)?.code).toBe("trade_item_intent_mismatch");
  const fixed = { ...bare, action: { kind: "trade" as const, buy: "soup" } };
  expect(decisionIssue(fixed, p)).toBeNull();
  const anchor = repairAnchor(bare, decisionIssue(bare, p)!)!;
  expect(compareRepair(anchor, fixed).status).toBe("preserved");
  expect(compareRepair(anchor, { ...fixed, action: { ...fixed.action, with: "elsewhere" } }).status).toBe("drift");
  for (const text of ["Get some food.", "If soup is available tomorrow, I'll buy it.", "Petar said 'buy soup'.", "I will buy food, then eat soup tomorrow."])
    expect(decisionIssue({ ...bare, intent: text }, p), text).toBeNull();
});

it("keeps the speaker when a decision later summarizes a conversation", () => {
  const sources = sourceAssertions([{ ref: "recent[0]", text: '[minute 660; reported speech, not verified experience] Conversation at the market: Rosa Vidal: “What is the word on the flour?” Petar Ilić: “The mill has no flour from local wheat this week.” Rosa Vidal: “I can help you find a hand.”' }], ["Rosa Vidal", "Petar Ilić"]);
  const bad = "I spoke with Rosa Vidal at the market; she mentioned the mill has no flour from local wheat this week.";
  expect(attributionIssue(bad, "remember", sources, ["Petar Ilić"])?.code).toBe("memory_misattribution");
  expect(attributionIssue("Petar mentioned the mill has no flour from local wheat this week.", "summary", sources, ["Rosa Vidal"])).toBeNull();
  expect(attributionIssue("Rosa mentioned a boat arriving tomorrow.", "summary", sources, [])).toBeNull();
  expect(attributionIssue("She mentioned the mill has no flour from local wheat this week.", "summary", sources, [])).toBeNull(); // unresolved pronoun
  const c = contexts(); c.perception.nearby[0]!.name = "Rosa Vidal";
  c.perception.recent = sources.filter(s => s.speaker === null).map(s => `[minute 660; reported speech, not verified experience] ${s.assertion}`);
  expect(decisionIssue({ action: { kind: "wait" }, remember: [bad] }, c.perception, "Petar Ilić")?.code).toBe("memory_misattribution");
});

it("does not remember an intended walk as completed, but accepts an actual arrival", () => {
  const text = "Walked to the bakery to look it over, wanting to see who runs it and where the flour comes from.";
  expect(groundedClaimIssue(text, "remember", { records: [], selfNames: ["Petar Ilić"] })?.code).toBe("memory_unverified_outcome");
  expect(groundedClaimIssue(text, "remember", { records: [{ source: "event", kind: "agent.move", text: "Petar Ilić arrived at the bakery." }], selfNames: ["Petar Ilić"] })).toBeNull();
  expect(groundedClaimIssue("I set out from the inn to go to the council hall.", "remember", { records: [], selfNames: ["Rosa Vidal"] })?.code).toBe("memory_unverified_outcome");
  expect(groundedClaimIssue("I will set out from the inn tomorrow.", "intent", { records: [], selfNames: ["Rosa Vidal"] })).toBeNull();
  expect(groundedClaimIssue("I walked from the inn to the market at 14:00, with intent to buy bread.", "remember", { records: [], selfNames: ["Petar Ilić"] })?.code).toBe("memory_unverified_outcome");
});

it("does not dispatch a planned journey as a free deed", () => {
  const p = contexts().perception;
  expect(decisionIssue({ action: { kind: "do", what: "I am the mayor now, so I should head to the council hall. Petar, good to see you." }, remember: [] }, p)?.code).toBe("do_replaces_action");
  expect(decisionIssue({ action: { kind: "do", what: "Sing about a mayor who should head to the council hall." }, remember: [] }, p)).toBeNull();
});

it("preserves who is looking for whom instead of relying on shared keywords", () => {
  const c = contexts(); c.a.persona.name = "Rosa Vidal"; c.b.persona.name = "Petar Ilić";
  const out = { lines: [{ speaker: c.b.id, text: "If you see my brother, tell him I'm looking for him." }, { speaker: c.a.id, text: "I'll keep an eye out." }],
    outcome: { a_remember: "Petar mentioned his brother is looking for him, but that's just his claim.", b_remember: "", rumor: null, a_trust_delta: 0, b_trust_delta: 0 } };
  expect(dialogueIssue(out, c.converse)?.code).toBe("dialogue_relation_reversed");
  out.outcome.a_remember = "Petar mentioned he is looking for his brother.";
  expect(dialogueIssue(out, c.converse)).toBeNull();
  out.outcome.a_remember = "Petar mentioned his brother is looking for him.";
  out.lines[0]!.text = "My brother is looking for me.";
  expect(dialogueIssue(out, c.converse)).toBeNull();
});
