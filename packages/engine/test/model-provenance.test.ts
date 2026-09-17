import { describe, expect, it } from "vitest";
import { Town, tagBrainResult, type Brain } from "../src/index.ts";

const persona = { name: "Mira", age: 30, origin: "mainland", summary: "A visitor.", want: "Work.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Listens.", traits: { warmth: .5, pride: .5, caution: .5, honesty: .5, ambition: .5 } };

const brain: Brain = {
  name: "test-brain",
  async decide() { return tagBrainResult({ action: { kind: "say" as const, text: "Good morning." }, remember: [] }, { model: "vendor/routine", modelTier: "ROUTINE", modelCallId: 2 }); },
  async plan() { return tagBrainResult({ mood: "ready", goals: ["Find work"], steps: [] }, { model: "vendor/stakes", modelTier: "STAKE", modelCallId: 1 }); },
  async converse() { throw new Error("not used"); }, async reflect() { throw new Error("not used"); },
  async digest() { throw new Error("not used"); }, async child() { throw new Error("not used"); },
  async writePaper() { throw new Error("not used"); }, async life() { throw new Error("not used"); }, async judge() { throw new Error("not used"); },
};

describe("event model provenance", () => {
  it("records the exact model on AI-derived events and leaves mechanical events unlabelled", async () => {
    const town = new Town({ seed: 7, brain });
    const a = town.addAgent({ persona, owner: "owner" });
    a.hint = "Say something now";

    await town.tick(); // the morning plan uses this minute's thought
    await town.tick(); // the pending hint produces the model-selected action

    expect(town.events.find((e) => e.kind === "agent.arrive")?.model).toBeUndefined();
    expect(town.events.find((e) => e.kind === "agent.plan")?.model).toBe("vendor/stakes");
    expect(town.events.find((e) => e.kind === "agent.plan")?.modelTier).toBe("STAKE");
    expect(town.events.find((e) => e.kind === "agent.plan")?.modelCallId).toBe(1);
    expect(town.events.find((e) => e.kind === "agent.say")?.model).toBe("vendor/routine");
    expect(town.events.find((e) => e.kind === "agent.say")?.modelTier).toBe("ROUTINE");
    expect(town.events.find((e) => e.kind === "agent.say")?.modelCallId).toBe(2);
  });
});
