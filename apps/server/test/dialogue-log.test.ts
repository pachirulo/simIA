import { describe, expect, it } from "vitest";
import { Rng, Town } from "@unwatched/engine";
import { MockBrain, seedPersonas } from "@unwatched/cognition";
import type { TownEvent } from "@unwatched/protocol";
import { logDialogue, spokenDialogue } from "../src/dialogue-log.ts";

const event = (kind: TownEvent["kind"], text: string, payload?: TownEvent["payload"]): TownEvent => ({
  id: 1, t: 500, day: 1, kind, actors: ["a", "b"], text, importance: .2, ...(payload ? { payload } : {}),
});
const nameOf = (id: string) => ({ a: "Inés", b: "Pedro" })[id];

describe("committed dialogue log", () => {
  it("logs only spoken lines with order, complete text and UTF-8, excluding private outcome fields", () => {
    const lines: string[] = [];
    logDialogue(event("conversation", "narration", { lines: [{ speaker: "b", text: 'Said “yes”.\nYou too?' }, { speaker: "a", text: "Yes." }], a_remember: "PRIVATE" }), nameOf, line => lines.push(line));
    const record = JSON.parse(lines[0]!.slice("dialogue ".length));
    expect(record).toEqual({ eventId: 1, minute: 500, kind: "conversation", dialogue: [
      { speakerId: "b", speaker: "Pedro", text: 'Said “yes”.\nYou too?' }, { speakerId: "a", speaker: "Inés", text: "Yes." },
    ] });
    expect(lines[0]).not.toContain("PRIVATE");
    expect(lines[0]!.split("\n")).toHaveLength(1);
  });

  it("excludes approaches, writings, nicknames, rejections and memories", () => {
    for (const text of ["Inés went over to Pedro.", "Inés wrote “La carta”.", 'Inés calls El Molino "House".']) expect(spokenDialogue(event("agent.say", text), nameOf)).toEqual([]);
    expect(spokenDialogue(event("action.rejected", 'Inés: “Hello.”'), nameOf)).toEqual([]);
    expect(spokenDialogue(event("conversation", 'Inés: “Hello.”'), nameOf)).toEqual([]); // No invented transcript.
    expect(spokenDialogue(event("agent.say", 'Inés to Pedro: “Said “hello”, right?”'), nameOf)[0]!.text).toBe('Said “hello”, right?');
  });

  it("ignores malformed payloads, retains unknown IDs and isolates logger failures", () => {
    const conversation = event("conversation", "", { lines: [null, { speaker: "stranger", text: "No" }, { speaker: "a", text: 4 }, { speaker: "b", text: "Hello" }] });
    expect(spokenDialogue(conversation, () => undefined)).toEqual([{ speakerId: "b", speaker: "b", text: "Hello" }]);
    expect(() => logDialogue(conversation, nameOf, () => { throw new Error("closed"); })).not.toThrow();
  });

  it("receives real engine conversation and say events once, without logging rejected speech", async () => {
    const lines: string[] = [], brain = new MockBrain(7);
    brain.decide = async () => ({ action: { kind: "wait" }, remember: [] });
    brain.plan = async () => ({ mood: "quiet", goals: [], steps: [] });
    brain.converse = async ctx => ({ lines: [{ speaker: ctx.a.id, text: "Did you bring the bread?" }, { speaker: ctx.b.id, text: "Not yet." }],
      outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "", b_remember: "", rumor: null } });
    const town = new Town({ seed: 7, brain, onEvent: e => logDialogue(e, id => town.agents.get(id)?.persona.name, l => lines.push(l)) });
    const personas = seedPersonas(new Rng(7), 2);
    const a = town.addAgent({ persona: personas[0]! }), b = town.addAgent({ persona: personas[1]! });
    a.location = b.location = "mill"; a.seek = b.id;
    await town.tick();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!.slice(9)).dialogue.map((l: { text: string }) => l.text)).toEqual(["Did you bring the bread?", "Not yet."]);
    expect(town.apply(a, { kind: "say", to: b.id, text: "We can talk later." }, "test")).toBe(true);
    expect(lines).toHaveLength(2);
    expect(town.apply(a, { kind: "say", to: "missing", text: "This is not said." }, "test")).toBe(false);
    expect(lines).toHaveLength(2);
  });
});
