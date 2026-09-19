import { describe, expect, it } from "vitest";
import { groundedClaimIssue, observedRecords, type ClaimContext } from "../src/semantics/evidence.ts";

const evidence = (...lines: string[]): ClaimContext => ({ selfNames: ["Inés Vidal"], records: observedRecords(lines) });
const issue = (text: string, ctx: ClaimContext) => groundedClaimIssue(text, "summary", ctx);

describe("personal evidence: operation, object, amount and repetition", () => {
  it("grounds taking an object against a receipt with the correct recipient, source and item", () => {
    const ctx = evidence("[event 1, minute 500, agent.give] Pedro Ibáñez gave Inés Vidal timber.");
    expect(issue("I took the timber.", ctx)).toBeNull();
    expect(issue("I took the timber from Pedro.", ctx)).toBeNull();
    expect(issue("I took the timber from Ana.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("Pedro took the timber.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I took the nails.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I took the timber twice.", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push(...observedRecords(["[event 2, minute 600, agent.take] Inés Vidal took timber from Pedro Ibáñez."]));
    expect(issue("I took the timber twice.", ctx)).toBeNull();
    expect(issue("I took the timber from Pedro twice.", ctx)).toBeNull();
  });
  it("does not promote words, interpretations or a rejected transfer to a receipt", () => {
    const ctx = evidence(
      "[event 1, minute 500, action.rejected] Inés Vidal took timber from Pedro.",
      '[event 2, minute 500, agent.give] Pedro said "I gave Inés Vidal timber."',
      "[speech] Pedro gave Inés Vidal timber.",
      "[interpretation] I took the timber.",
    );
    expect(issue("I took the timber.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("Pedro said I took the timber.", ctx)).toBeNull();
    expect(issue("If I took the timber, I could build.", ctx)).toBeNull();
    expect(issue("I haven't taken anything. I did not take the timber.", ctx)).toBeNull();
  });
  it("keeps an earlier acquisition separate from later offers or promises", () => {
    expect(issue("Pedro took the timber, offered nails, promised to return tomorrow.", evidence())?.code).toBe("memory_unverified_outcome");
    expect(issue("I took the timber and promised to return tomorrow.", evidence())?.code).toBe("memory_unverified_outcome");
    expect(issue("I promised to return tomorrow and took the timber.", evidence())).toBeNull(); // Ambiguous report scope remains unverified.
  });
  it("does not interpret common took activities and idioms as inventory transfers", () => {
    for (const action of ["a shift", "a walk", "the job", "a seat", "a chance", "care of the garden", "part in the meeting", "the initiative", "on a project"]) {
      expect(issue(`I took ${action}.`, evidence())).toBeNull();
    }
  });
  it("keeps denied outcomes distinct from actual deeds, including contracted negations", () => {
    const ctx = evidence();
    expect(issue("I haven't given him anything solid.", ctx)).toBeNull();
    expect(issue("I didn't buy bread.", ctx)).toBeNull();
    expect(issue("I haven't paid Pedro, but I bought bread.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("preserves the actor of a witnessed delivery and distinguishes a later payment", () => {
    const ctx = evidence("[event 1, minute 500, agent.give] Pedro Ibáñez gave Inés Vidal bread.");
    expect(issue("Pedro gave me bread.", ctx)).toBeNull();
    expect(issue("I gave Pedro bread.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I paid Pedro 10 coins.", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push(...observedRecords(["[event 2, minute 600, agent.give] Inés Vidal gave Pedro Ibáñez 10 coins."]));
    expect(issue("I paid Pedro 10 coins.", ctx)).toBeNull();
  });
  it("uses an actual wage receipt for a worked shift and money received, not money paid", () => {
    const ctx = evidence("[event 1, minute 1080, agent.work] Inés Vidal was paid 2 for a shift as inn waiter.");
    expect(issue("I worked my shift as inn waiter and earned 2 coins.", ctx)).toBeNull();
    expect(issue("I got paid 2 coins.", ctx)).toBeNull();
    expect(issue("I paid Pedro 2 coins.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I earned 20 coins.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("allows several documented purchases and meals without confusing frequency with price", () => {
    const ctx = evidence(
      "[event 1, minute 500, agent.trade] Inés Vidal bought bread for 1.",
      "[event 2, minute 600, agent.trade] Inés Vidal bought bread for 1.",
      "[event 3, minute 510, agent.eat] Inés Vidal ate bread.",
      "[event 4, minute 610, agent.eat] Inés Vidal ate bread.",
    );
    expect(issue("I bought and ate bread several times today.", ctx)).toBeNull();
    expect(issue("Today I bought bread twice and ate some.", ctx)).toBeNull();
    expect(issue("Today I walked to the mill and back, bought bread twice and ate some.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I bought bread twice for 1 coin.", ctx)).toBeNull();
    expect(issue("I bought bread three times.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I bought bread for 5 coins.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("does not count the same event in two supplied evidence lists twice", () => {
    const line = "[event 1, minute 500, agent.trade] Inés Vidal bought bread for 1.";
    const ctx = evidence(line, line);
    expect(issue("I bought bread.", ctx)).toBeNull();
    expect(issue("I bought bread twice.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("requires every coordinated operation and object to have its own support", () => {
    const ctx = evidence(
      "[event 1, minute 500, agent.trade] Inés Vidal bought flour for 1.",
      "[event 2, minute 600, agent.eat] Inés Vidal ate bread.",
    );
    expect(issue("I bought and ate bread.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I ate bread and soup.", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push(...observedRecords(["[event 3, minute 700, agent.eat] Inés Vidal ate soup."]));
    expect(issue("I ate bread and soup.", ctx)).toBeNull();
    ctx.records.push(...observedRecords(["[event 4, minute 800, agent.trade] Pedro bought bread for 1."]));
    expect(issue("Pedro bought and ate bread.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("recognizes the actual arrival and hiring event wording", () => {
    const ctx = evidence(
      "[event 1, minute 360, agent.arrive] Inés Vidal arrived on the boat.",
      "[event 2, minute 400, agent.hired] Inés Vidal was taken on as inn waiter.",
    );
    expect(issue("I arrived this morning.", ctx)).toBeNull();
    expect(issue("I was hired as inn waiter.", ctx)).toBeNull();
    expect(issue("I repaired the roof.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("grounds a town arrival separately from a search and still identifies an unsupported lodging payment", () => {
    const ctx = evidence("[event 1, minute 360, agent.arrive] Inés Vidal arrived on the boat.");
    expect(issue("Today I arrived in town and searched for the bakery.", ctx)).toBeNull();
    expect(issue("I arrived in town and looked for the baker.", ctx)).toBeNull();
    expect(issue("Today I arrived in town and searched for the bakery. I paid for three nights at the inn.", ctx)?.message).toContain("I paid for three nights");
    expect(issue("I arrived in town, paid for three nights at the inn, and looked for work.", ctx)?.message).toContain("paid for three nights");
    expect(issue("Today I arrived in town.", evidence())?.code).toBe("memory_unverified_outcome");
  });
  it("does not use a town arrival or an intermediate move to prove reaching a different destination", () => {
    const ctx = evidence("[event 1, minute 360, agent.arrive] Inés Vidal arrived on the boat.");
    expect(issue("I arrived at the castle.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I moved to the castle.", ctx)?.code).toBe("memory_unverified_outcome");
    ctx.records.push(...observedRecords(["[event 2, minute 400, agent.move] Inés Vidal went to the square, on the way to the castle."]));
    expect(issue("I arrived at the castle.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I arrived at the square.", ctx)).toBeNull();
    ctx.records.push(...observedRecords(["[event 3, minute 420, agent.move] Inés Vidal went to the castle."]));
    expect(issue("I arrived at the castle.", ctx)).toBeNull();
  });
  it("keeps negation local to an explicit clause and does not use a second verb as a purchased object", () => {
    const ctx = evidence("[event 1, minute 360, agent.trade] Inés Vidal bought bread for 1.");
    expect(issue("I bought bread and I haven't paid Pedro.", ctx)).toBeNull();
    expect(issue("I haven't paid Pedro and I bought soup.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I bought soup and I haven't paid Pedro.", ctx)?.code).toBe("memory_unverified_outcome");
    expect(issue("I bought bread and looked for the baker.", ctx)).toBeNull();
    expect(issue("I bought bread and soup.", ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("preserves reported and conditional scope across a coordinated statement", () => {
    expect(issue("Pedro said I arrived in town and paid for three nights.", evidence())).toBeNull();
    expect(issue("If I bought bread and ate bread, I could work.", evidence())).toBeNull();
    expect(issue("I did not buy bread and eat it.", evidence())).toBeNull();
    expect(issue('Pedro said “I arrived. I paid three coins. I ate bread.”', evidence())).toBeNull();
    expect(issue('Pedro said “I arrived. I paid three coins.” I bought bread.', evidence())?.message).toContain("I bought bread");
  });
});
