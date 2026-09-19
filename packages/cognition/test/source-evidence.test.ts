import { describe, expect, it } from "vitest";
import { sourceAssertions } from "../src/semantics/sources.ts";
import { observedRecords } from "../src/semantics/evidence.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { contexts } from "./fixtures.ts";

describe("per-call source assertions", () => {
  it("preserves all existing memory source kinds without promoting reports to experience", () => {
    const labels = ["recorded observation; quoted claims remain claims", "reported speech, not verified experience",
      "personal interpretation, not verified experience", "letter, not verified experience", "intention, not completed work", "new unknown label"];
    const records = sourceAssertions(labels.map((label, i) => ({ ref: `memory[${i}]`, text: `[minute 500; ${label}] I bought bread.` })));
    expect(records.map(r => r.source.kind)).toEqual(["observation", "speech", "interpretation", "letter", "intention", "unknown"]);
    expect(records.map(r => r.certainty)).toEqual(["observed", "reported", "interpreted", "reported", "intended", "unknown"]);
    expect(records.every(r => r.recordedAt === 500 && r.speaker === null && r.assertion === "I bought bread.")).toBe(true);
  });

  it("keeps the speaker and full condition of each named utterance, including repetitions", () => {
    const text = '[minute 600; reported speech, not verified experience] Conversation at El Molino: Inés Vidal: “I will pay Pedro ten coins when he delivers bread.” Pedro Ibáñez: “Inés will pay ten coins when I deliver bread.”';
    const records = sourceAssertions([{ ref: "dayMemories[0]", text }], ["Inés Vidal", "Pedro Ibáñez"]);
    expect(records).toHaveLength(3);
    expect(records[0]!.speaker).toBeNull();
    expect(records.slice(1).map(r => [r.speaker, r.condition])).toEqual([
      ["Inés Vidal", { text: "when he delivers bread", status: "unverified" }],
      ["Pedro Ibáñez", { text: "when I deliver bread", status: "unverified" }],
    ]);
    expect(records.slice(1).every(r => r.certainty === "reported" && r.recordedAt === 600)).toBe(true);
    expect(records[2]!.source.ref).toBe("dayMemories[0]#utterance1");
  });

  it("does not infer an author or time from a name mentioned inside an unlabeled recollection", () => {
    const text = "I think Pedro told Inés about flour yesterday.";
    expect(sourceAssertions([{ ref: "keyMemories[0]", text }], ["Pedro", "Inés"])[0]).toMatchObject({
      assertion: text, speaker: null, recordedAt: null, certainty: "unknown", condition: null,
    });
  });

  it("does not turn a quotation inside an interpretation into an independent transcript", () => {
    const records = sourceAssertions([{ ref: "keyMemories[0]", text: '[minute 600; personal interpretation, not verified experience] Pedro: “I delivered bread.”' }], ["Pedro"]);
    expect(records).toHaveLength(2);
    expect(records.every(r => r.source.kind === "interpretation" && r.certainty === "interpreted")).toBe(true);
    expect(records[1]!.speaker).toBe("Pedro"); // Named within the interpretation, not independently verified.
  });

  it("preserves unknown speakers, nested quotes, accents and literal punctuation in names", () => {
    const text = '[minute 4; reported speech, not verified experience] Ana (daughter): “I will pay when the bread arrives.” Unknown: “I already paid.” Ana (daughter): “Said “I paid” yesterday.”';
    const records = sourceAssertions([{ ref: "memory[0]", text }], ["Ana (daughter)"]);
    expect(records).toHaveLength(2);
    expect(records[0]!.assertion).toContain('Unknown: “I already paid.”');
    expect(records[0]!.assertion).toContain('Said “I paid” yesterday.');
    expect(records[1]).toMatchObject({ speaker: "Ana (daughter)", condition: { text: "when the bread arrives", status: "unverified" } });
  });

  it("separates speech events and rejected attempts from physical receipts", () => {
    const lines = [
      "[event 1, minute 10, agent.say] Inés bought bread.",
      "[event 2, minute 20, action.rejected] Inés bought bread.",
      '[minute 30; recorded observation; quoted claims remain claims] Pedro: “Inés bought bread.”',
      "[event 3, minute 40, agent.trade] Inés bought bread for 1.",
    ];
    expect(sourceAssertions(lines.map((text, i) => ({ ref: String(i), text }))).map(r => r.certainty)).toEqual(["reported", "attempted", "reported", "observed"]);
    expect(observedRecords(lines)).toEqual([{ source: "event", id: 3, kind: "agent.trade", time: 40, text: "Inés bought bread for 1." }]);
  });

  it("shares the supplied source frame between reflection prompt and validation without reading private history", () => {
    const { reflect, a, b } = contexts();
    const raw = `[minute 600; reported speech, not verified experience] Conversation: ${b.persona.name}: “I bought bread.”`;
    reflect.dayMemories = [raw]; reflect.keyMemories = []; reflect.actionEvidence = [];
    reflect.desireEvidence = [{ id: 7, t: 700, day: 1, kind: "agent.trade", actors: [b.id], text: `${b.persona.name} bought bread.`, importance: 1 }];
    const frame = reflectionEvidence(reflect);
    expect(frame.claims.records).toEqual([]);
    const prompt = buildReflectContext(reflect).user;
    expect(prompt).toContain(raw);
    expect(prompt).toContain(`"speaker":"${b.persona.name}"`);
    expect(prompt).toContain('"certainty":"reported"');
    expect(prompt).not.toContain("UNSELECTED_PRIVATE_MEMORY");
    expect(reflectionIssue({ summary: "I bought bread.", insights: [], intentions: [], opinions: [], letter_to_owner: null }, reflect)?.code).toBe("memory_unverified_outcome");
    reflect.desireEvidence.push({ id: 8, t: 800, day: 1, kind: "agent.trade", actors: [a.id], text: `${a.persona.name} bought bread for 1.`, importance: 1 });
    expect(reflectionEvidence(reflect).claims.records).toHaveLength(1);
    expect(frame.claims.records).toEqual([]); // A prior call does not change retroactively.
  });
});
