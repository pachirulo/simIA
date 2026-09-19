import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialogue, TownEvent } from "@unwatched/protocol";
import capture from "./fixtures/seed853-regressions.json";
import { contexts } from "./fixtures.ts";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";

afterEach(() => vi.unstubAllGlobals());
function recordedContexts() {
  const c = contexts(); c.a.persona.name = "Rosa Vidal"; c.b.persona.name = "Petar Ilić";
  c.reflect.relationships[0]!.name = c.b.persona.name;
  Object.assign(c.reflect, { ...capture.evidence, desireEvidence: capture.evidence.desireEvidence.map(e => TownEvent.parse(e)) });
  Object.assign(c.converse, { aMemories: capture.dialogue.aMemories, bMemories: capture.dialogue.bMemories });
  return c;
}

describe("seed 853: captured output and original selected evidence", () => {
  it("does not apply the frequency of a conversation to a documented hiring", () => {
    const ctx = reflectionEvidence(recordedContexts().reflect).claims;
    const sentence = capture.reflection.output.summary.split(". ")[1]!;
    expect(sentence).toContain("I got taken on"); expect(sentence).toContain("twice");
    expect(groundedClaimIssue(sentence, "summary", ctx)).toBeNull();
    expect(groundedClaimIssue("I got taken on twice as help at the inn and I talked once.", "summary", ctx)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I got taken on as help at the inn and I bought soup twice.", "summary", ctx)?.message).toContain("bought soup");
  });

  it("rejects the original memory of taking a loaf without certifying or censoring the spoken claims", () => {
    const c = recordedContexts(), out = Dialogue.parse(capture.dialogue.output);
    expect(dialogueIssue(out, c.converse)).toMatchObject({ code: "memory_unverified_outcome", path: "outcome.b_remember" });
    const fixed = structuredClone(out);
    fixed.outcome.a_remember = "Petar said he brought a loaf and that the mill is still broken. I offered soup in exchange; delivery remains unverified.";
    fixed.outcome.b_remember = "Rosa offered soup for the loaf; the exchange is still pending.";
    expect(dialogueIssue(fixed, c.converse)).toBeNull();
    expect(fixed.lines).toEqual(out.lines);
  });

  it("repairs the captured dialogue in the existing two-response budget", async () => {
    const c = recordedContexts(), original = Dialogue.parse(capture.dialogue.output), fixed = structuredClone(original);
    fixed.outcome.a_remember = "Petar said he brought a loaf. I offered soup in exchange; delivery remains unverified.";
    fixed.outcome.b_remember = "Rosa offered soup for the loaf; the exchange is still pending.";
    const requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? original : fixed) } }] }));
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    const result = await brain.converse(c.converse);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain("outcome.b_remember");
    expect(result.outcome).toEqual(fixed.outcome);
    expect(result.lines.map(l => l.text)).toEqual(original.lines.map(l => l.text));
  });

  it("uses a marked safe fallback if the model repeats the unsupported transfer", async () => {
    const c = recordedContexts();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(capture.dialogue.output) } }] })));
    vi.stubGlobal("fetch", fetch);
    const result = await new OpenRouterBrain({ apiKey: "test" }).converse(c.converse);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(isFromFallback(result)).toBe(true);
    expect(dialogueIssue(result, c.converse)).toBeNull();
    expect(result.outcome.b_remember).not.toContain("took the loaf");
  });
});
