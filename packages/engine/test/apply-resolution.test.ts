import { describe, expect, it } from "vitest";
import { Town, type Brain } from "../src/index.ts";

const unavailable = async (): Promise<never> => { throw Error("No model call expected"); };
const brain: Brain = { name: "test", decide: unavailable, converse: unavailable, reflect: unavailable, plan: unavailable,
  digest: unavailable, child: unavailable, writePaper: unavailable, life: unavailable, judge: unavailable };
const persona = { name: "Petar Ilić", age: 30, origin: "mainland", summary: "A baker seeking work.", want: "Work", fear: "Hunger",
  secret: "None", strangers: "Polite", advice: "Listens", traits: { warmth: .5, pride: .5, caution: .5, honesty: .5, ambition: .5 } };
function setup(location = "harbor") {
  const town = new Town({ seed: 42, brain }), agent = town.addAgent({ persona });
  agent.location = location; town.t = 420;
  return { town, agent };
}

describe("apply preserves an explicitly requested job", () => {
  it("Kakatres 3d246c4a: cook at the bakery must never become harbor.dock", () => {
    const { town, agent } = setup();
    expect(town.perceive(agent).place.jobs_open).toContain("harbor.dock");
    expect(town.apply(agent, { kind: "apply", job: "cook at the bakery" }, "Request the bakery cook position")).toBe(false);
    expect(agent.job).toBeNull();
    expect(town.jobs.get("harbor.dock")!.holders).not.toContain(agent.id);
    expect(town.events.filter(e => e.kind === "agent.hired")).toEqual([]);
    expect(town.events.at(-1)).toMatchObject({ kind: "action.rejected" });
  });

  it.each(["bakery.cook", "cook at the bakery", " COOK AT THE BAKERY ", "cook"])("resolves an unambiguous available bakery reference: %s", job => {
    const { town, agent } = setup("bakery");
    expect(town.apply(agent, { kind: "apply", job }, "Request the cook position")).toBe(true);
    expect(agent.job).toBe("bakery.cook");
  });

  it("preserves generic apply without a job", () => {
    const { town, agent } = setup();
    expect(town.apply(agent, { kind: "apply" }, "Ask for available local work")).toBe(true);
    expect(agent.job).toBe("harbor.dock");
  });

  it.each(["unlisted job", "bakery.cook", "   "])("rejects unresolved or remote explicit references instead of taking dock work: %s", job => {
    const { town, agent } = setup();
    expect(town.apply(agent, { kind: "apply", job }, "Ask for a specific job")).toBe(false);
    expect(agent.job).toBeNull();
  });

  it("rejects an ambiguous partial reference while retaining exact-name precedence", () => {
    const { town, agent } = setup("bakery"), cook = town.jobs.get("bakery.cook")!;
    town.jobs.set("bakery.assistant", { ...cook, id: "bakery.assistant", title: "assistant cook", holders: [] });
    expect(town.apply(agent, { kind: "apply", job: "cook" }, "Ask for cook work")).toBe(false);
    expect(town.apply(agent, { kind: "apply", job: "cook at the bakery" }, "Ask for the exact position")).toBe(true);
    expect(agent.job).toBe("bakery.cook");
  });

  it("rejects a full exact job even when another related job is open", () => {
    const { town, agent } = setup("bakery"), cook = town.jobs.get("bakery.cook")!;
    cook.holders = ["other-a", "other-b"];
    town.jobs.set("bakery.assistant", { ...cook, id: "bakery.assistant", title: "assistant cook at the bakery", holders: [] });
    expect(town.apply(agent, { kind: "apply", job: "cook at the bakery" }, "Ask for the exact cook position")).toBe(false);
    expect(agent.job).toBeNull();
  });

  it("rejects duplicate exact titles", () => {
    const { town, agent } = setup("bakery"), cook = town.jobs.get("bakery.cook")!;
    town.jobs.set("bakery.second", { ...cook, id: "bakery.second", holders: [] });
    expect(town.apply(agent, { kind: "apply", job: cook.title }, "Ask for the named position")).toBe(false);
    expect(agent.job).toBeNull();
  });
});
