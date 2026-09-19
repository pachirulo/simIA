import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reflection } from "@unwatched/protocol";
import { reflectionIssue, safeReflectionFallback } from "../src/semantics/lifecycle.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { OpenRouterBrain } from "../src/openrouter.ts";
import { contexts } from "./fixtures.ts";
import { Town, type ReflectContext } from "@unwatched/engine";
import { MockBrain } from "../src/mock.ts";
import { persona } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());
const reflection = (extra: Partial<Reflection> = {}): Reflection => ({ summary: "I am thinking about tomorrow.", insights: [], opinions: [], intentions: [], letter_to_owner: null, ...extra });
function construction(labor = 0) {
  const c = contexts();
  c.a.projects = [{ title: "A home", why: "A roof", progress: "An aspiration", since: 1, done: false,
    construction: { site: "shore-1", labor, needed: 6 } }];
  c.reflect.projects = c.a.projects.map(p => ({ title: p.title, why: p.why, progress: p.progress, since: p.since }));
  return c;
}
const complete = reflection({ projects: [{ title: "A home", progress: "Ready", done: true }] });
const desire = (extra: Partial<NonNullable<Reflection["desires"]>[number]> = {}): Reflection => reflection({ desires: [
  { id: "desire-home", title: "A home of my own", why: "I want a roof", state: "active", evidence: [41], ...extra },
] });

describe("structured reflection updates respect supplied evidence", () => {
  it("rejects a done flag contradicting unfinished construction, regardless of a reached plan or self report", () => {
    const c = construction(); c.a.projects[0]!.progress = "Complete"; c.a.projects[0]!.done = true;
    expect(reflectionIssue(complete, c.reflect)).toMatchObject({ code: "project_completion_unverified", path: "projects[0].done" });
    expect(reflectionIssue(reflection({ projects: [{ title: "a HOME", done: true }] }), c.reflect)?.code).toBe("project_completion_unverified");
    expect(reflectionIssue(reflection({ projects: [{ title: "A home", done: false }] }), c.reflect)).toBeNull();
  });
  it("allows completion backed by labor, and leaves subjective projects and omissions alone", () => {
    expect(reflectionIssue(complete, construction(6).reflect)).toBeNull();
    const c = construction();
    expect(reflectionIssue(reflection({ projects: [{ title: "Feel at home", done: true }] }), c.reflect)).toBeNull();
    expect(reflectionIssue(reflection(), c.reflect)).toBeNull();
  });
  it("supplies the same construction counters to the prompt without reading private memories", () => {
    const c = construction(2), before = structuredClone(c.a.projects);
    const text = buildReflectContext(c.reflect).user;
    expect(text).toContain('"labor":2'); expect(text).toContain('"needed":6');
    expect(text).not.toContain("UNSELECTED_PRIVATE_MEMORY"); expect(c.a.projects).toEqual(before);
  });
  it("rejects unknown desire IDs rather than accepting an update the engine will silently discard", () => {
    const c = contexts();
    expect(reflectionIssue(desire({ id: "invented" }), c.reflect)).toMatchObject({ code: "desire_unknown_id", path: "desires[0].id" });
    expect(reflectionIssue(desire(), c.reflect)).toBeNull();
    expect(reflectionIssue(desire({ id: undefined }), c.reflect)).toBeNull();
  });
  it("requires every cited event to be a supplied personal experience", () => {
    const c = contexts();
    expect(reflectionIssue(desire({ evidence: [41, 999] }), c.reflect)).toMatchObject({ code: "desire_unknown_evidence", path: "desires[0].evidence" });
    c.reflect.desireEvidence!.push({ ...c.reflect.desireEvidence![0]!, id: 42, actors: [c.b.id], text: "FOREIGN_PERSONAL_EVENT" });
    expect(reflectionIssue(desire({ evidence: [42] }), c.reflect)?.code).toBe("desire_unknown_evidence");
    expect(buildReflectContext(c.reflect).user).not.toContain("FOREIGN_PERSONAL_EVENT");
    expect(reflectionIssue(desire({ evidence: [41, 41] }), c.reflect)).toBeNull();
  });
  it("permits subjective reconsideration from speech without claiming its contents happened", () => {
    const c = contexts(); c.reflect.desireEvidence = [{ id: 42, t: 500, day: 1, kind: "conversation", actors: [c.a.id, c.b.id], text: 'Tomás said: “A home might suit you.”', importance: .2 }];
    expect(reflectionIssue(desire({ state: "fulfilled", evidence: [42], why: "The conversation helped me feel at home." }), c.reflect)).toBeNull();
    expect(reflectionIssue(desire({ state: "set_aside", evidence: [42] }), c.reflect)).toBeNull();
    expect(reflectionIssue(desire({ id: undefined, title: "A new interest", state: "fulfilled", evidence: [42] }), c.reflect)?.code).toBe("desire_new_state");
  });
  it("protects the fallback from the same unsupported structural updates", () => {
    const c = construction();
    expect(safeReflectionFallback(complete, c.reflect).projects).toBeUndefined();
    expect(safeReflectionFallback(desire({ evidence: [999] }), c.reflect).desires).toBeUndefined();
  });
  it("repairs an invalid event reference in two responses without fabricating or dropping the chosen desire", async () => {
    const c = contexts(), requests: { messages: { content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? desire({ evidence: [999] }) : desire()) } }] }));
    }));
    const brain = new OpenRouterBrain({ apiKey: "test", allowFallback: false });
    expect(await brain.reflect(c.reflect)).toEqual(desire()); expect(brain.usage().calls).toBe(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain("desires[0].evidence");
  });
  it("checks real construction after snapshot restore and only accepts completion after real labor", async () => {
    const model = new OpenRouterBrain({ apiKey: "test", allowFallback: false }), driver = new MockBrain(7);
    driver.decide = async () => ({ action: { kind: "wait" }, remember: [] });
    driver.plan = async () => ({ mood: "quiet", goals: [], steps: [] });
    let selected: ReflectContext | undefined;
    driver.reflect = async ctx => { selected = ctx; return model.reflect(ctx); };
    const town = new Town({ seed: 7, brain: driver }), owner = town.addAgent({ persona });
    town.t = 540; owner.location = "shore-1";
    expect(town.apply(owner, { kind: "build", what: "house", at: "shore-1", project: "A home" }, "test")).toBe(true);
    expect(town.apply(owner, { kind: "work" }, "test")).toBe(true);
    const restored = new Town({ seed: 7, brain: driver }); restored.restore(JSON.parse(JSON.stringify(town.snapshot())));
    const person = restored.agents.get(owner.id)!;
    expect(person.projects[0]!.construction).toMatchObject({ labor: 1, needed: 6 });
    const requests: { messages: { content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(requests.length === 1 ? complete : reflection({ projects: [{ title: "A home", done: false }] })) } }] }));
    }));
    restored.t = 1439; await restored.tick();
    expect(selected).toBeDefined(); expect(model.usage().calls).toBe(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain("1/6 labor");
    expect(person.projects[0]!.done).toBe(false);
    expect(restored.events.some(event => event.kind === "town.notice" && event.text.includes("goal finished"))).toBe(false);
    for (let day = 2; day <= 6; day++) {
      restored.day = day; restored.t = (day - 1) * 1440 + 540; person.location = "shore-1";
      expect(restored.apply(person, { kind: "work" }, "test")).toBe(true);
    }
    expect(person.projects[0]).toMatchObject({ done: true, construction: { labor: 6, needed: 6 } });
    expect(restored.events.some(event => event.kind === "town.built")).toBe(true);
    expect(reflectionIssue(complete, { ...selected!, agent: person })).toBeNull();
  });
});
