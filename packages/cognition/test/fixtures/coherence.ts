import { ActionProposal, Dialogue, Reflection } from "@unwatched/protocol";

/** Synthetic regressions transcribed from the user's report, NOT original API captures. */
export const incoherentMeal = ActionProposal.parse({
  intent: "I have bread. I will eat it now instead of buying more.",
  action: { kind: "trade", with: "inn" }, remember: [],
});
export const malformedFlour = ActionProposal.parse({
  intent: "I will buy flour at the mill.",
  action: { kind: "trade", with: "mill", buy: "flour", sell: "." }, remember: [],
});
export const substitutedBread = ActionProposal.parse({
  intent: "I will buy bread at the market.",
  action: { kind: "trade", with: "market", buy: "bread" }, remember: [],
});
export const misattributedRumor = Dialogue.parse({
  lines: [
    { speaker: "ag_1", text: "I heard a rumor: flour costs five coins at the mill." },
    { speaker: "ag_2", text: "I can ask there tomorrow." },
  ],
  outcome: { a_remember: "Pedro told me flour costs five coins at the mill.",
    b_remember: "Inés mentioned a rumor about the flour price.",
    a_trust_delta: 0, b_trust_delta: 0, rumor: null },
});
export const inventedDebt = Reflection.parse({
  summary: "I still owe Pedro ten coins for bread.",
  insights: [], opinions: [], intentions: [], letter_to_owner: null,
});
export const inventedMeal = ActionProposal.parse({
  action: { kind: "trade", buy: "bread" },
  remember: ["I bought bread and my hunger eased."],
});
