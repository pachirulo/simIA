import { describe, expect, it } from "vitest";
import { commitmentTraces } from "../src/semantics/commitments.ts";
import { sourceAssertions } from "../src/semantics/sources.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { contexts } from "./fixtures.ts";

const people = ["Inés Vidal", "Pedro Ibáñez", "Ana Ruiz"];
const offer = "I will pay Pedro ten coins when Pedro delivers bread.";
const transcript = (promise = offer, reply = "Agreed.") => `[event 1, minute 500, conversation] Inés Vidal: “${promise}” Pedro Ibáñez: “${reply}”`;
const delivery = "[event 2, minute 500, agent.give] Pedro Ibáñez gave Inés Vidal bread.";
const payment = "[event 3, minute 500, agent.give] Inés Vidal gave Pedro Ibáñez 10 coins.";
const sources = (...texts: string[]) => sourceAssertions(texts.map((text, i) => ({ ref: `input[${i}]`, text })), people);
const trace = (...texts: string[]) => commitmentTraces(sources(...texts), people)[0]!;

describe("conditional commitments use separate sourced stages", () => {
  it.each([
    [[], "unknown", "unknown"], [[delivery], "observed", "unknown"], [[delivery, payment], "observed", "observed"],
  ] as const)("separates acceptance, delivery and monetary transfer: %j", (receipts, delivered, paid) => {
    const out = trace(transcript(), ...receipts);
    expect(out.proposal).toMatchObject({ payer: people[0], payee: people[1], coins: 10, item: "bread" });
    expect(out.agreement.status).toBe("observed");
    expect(out.delivery.status).toBe(delivered); expect(out.payment.status).toBe(paid);
    expect(out.outstanding).toBe("unknown");
    for (const stage of [out.agreement, out.delivery, out.payment]) if (stage.status === "observed") expect(stage.evidence.length).toBeGreaterThan(0);
  });

  it.each(["I will pay Pedro ten coins when Pedro delivers me the loaf.", "I'll pay Pedro 10 coins if Pedro delivers a loaf."])("keeps the named item distinct: %s", promise => {
    const out = trace(transcript(promise, "I agree."), delivery, payment);
    expect(out.proposal.coins).toBe(10);
    expect(out.agreement.status).toBe("observed");
    expect(out.delivery.status).toBe("unknown"); // A different item name is not silently aliased.
    const item = out.proposal.item!;
    expect(trace(transcript(promise, "Deal."), delivery.replace("bread", item), payment).delivery.status).toBe("observed");
  });

  it.each([
    "I will bring bread when I have flour.", "No.", "Maybe.", "Inés agreed.",
  ])("does not invent acceptance from %s", reply => {
    const out = trace(transcript(offer, reply), delivery, payment);
    expect(out.agreement.status).toBe("unknown");
    expect(out.delivery.status).toBe("unknown");
  });

  it("does not turn an interpretation, letter or unattributed rumor into a verified offer", () => {
    const quote = `Inés Vidal: “${offer}” Pedro Ibáñez: “Agreed.”`;
    for (const label of ["personal interpretation, not verified experience", "letter, not verified experience", "unknown label"]) {
      expect(commitmentTraces(sources(`[minute 500; ${label}] ${quote}`, delivery), people)).toEqual([]);
    }
    expect(commitmentTraces(sources(`[minute 500; reported speech, not verified experience] Pedro said Inés will pay ten coins when he delivers bread.`), people)).toEqual([]);
  });

  it("keeps pronouns and extra resource/quality conditions unresolved", () => {
    for (const condition of ["he delivers bread", "Pedro delivers bread and obtains flour", "Pedro delivers bread before noon", "Pedro delivers two bread"]) {
      const out = trace(transcript(`I will pay Pedro ten coins when ${condition}.`), delivery, payment);
      expect(out.proposal.item).toBeNull();
      expect(out.proposal.condition).toContain(condition);
      expect(out.delivery.status).toBe("unknown");
    }
  });

  it("requires direction, object, amount and chronology, not merely similar words", () => {
    for (const wrong of [delivery.replace("bread", "flour"), delivery.replace("gave Inés Vidal", "gave Ana Ruiz"), delivery.replace("minute 500", "minute 499"), delivery.replace("event 2", "event 0"), delivery.replace("agent.give", "action.rejected")]) {
      expect(trace(transcript(), wrong, payment).delivery.status).toBe("unknown");
    }
    for (const wrong of [payment.replace("10 coins", "5 coins"), payment.replace("gave Pedro Ibáñez", "gave Ana Ruiz"), payment.replace("event 3", "event 0"), payment.replace("agent.give", "agent.say")]) {
      expect(trace(transcript(), delivery, wrong).payment.status).toBe("unknown");
    }
  });

  it("does not guess same-minute order without event IDs or count duplicate event lists twice", () => {
    const memory = transcript().replace("[event 1, minute 500, conversation]", "[minute 500; reported speech, not verified experience]");
    expect(trace(memory, delivery).delivery.status).toBe("unknown");
    const out = trace(memory, transcript(), delivery, delivery, payment, payment);
    expect(out.delivery.evidence).toHaveLength(1); expect(out.payment.evidence).toHaveLength(1);
    expect(out.delivery.status).toBe("observed");
  });

  it("does not allocate a receipt across competing agreements or ambiguous first names", () => {
    const earlier = transcript().replace("event 1, minute 500", "event 0, minute 400").replace("ten coins", "five coins");
    expect(trace(transcript(), earlier, delivery, payment).delivery.status).toBe("ambiguous");
    expect(trace(transcript(), delivery, delivery.replace("event 2", "event 4")).delivery.status).toBe("ambiguous");
    expect(commitmentTraces(sources(transcript()), [...people, "Pedro Ruiz"])).toEqual([]);
  });

  it("supplies traces in reflection while preserving canonical debts and unknown outstanding balances", () => {
    const { reflect, a, b } = contexts();
    a.persona.name = people[0]!; b.persona.name = people[1]!; reflect.relationships[0]!.name = b.persona.name;
    reflect.actionEvidence = [delivery, payment]; reflect.desireEvidence = [];
    reflect.keyMemories = []; reflect.dayMemories = [transcript()];
    const before = structuredClone(a.debts);
    expect(reflectionEvidence(reflect).commitments[0]!.payment.status).toBe("observed");
    expect(buildReflectContext(reflect).user).toContain('"outstanding":"unknown"');
    expect(reflectionIssue({ summary: "I still owe Pedro ten coins.", insights: [], opinions: [], intentions: [], letter_to_owner: null }, reflect)?.code).toBe("unverified_obligation");
    expect(a.debts).toEqual(before);
  });
});
