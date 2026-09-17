import { describe, expect, it } from "vitest";
import { Town, habit, type Brain, type Place } from "../src/index.ts";

const none: Brain = {
  name: "none",
  async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("unused"); },
  async reflect() { throw new Error("unused"); },
  async plan() { throw new Error("unused"); },
  async digest() { throw new Error("unused"); },
  async child() { throw new Error("unused"); },
  async writePaper() { throw new Error("unused"); },
  async life() { throw new Error("unused"); },
  async judge() { throw new Error("unused"); },
};

function setup() {
  const town = new Town({ seed: 7, brain: none });
  const agent = town.addAgent({ persona: {
    name: "Walker", age: 30, origin: "the island", summary: "A worker.", want: "Eat.", fear: "Hunger.", secret: "None.", strangers: "Quiet.", advice: "Listens.",
    traits: { warmth: 0.2, pride: 0.5, caution: 0.5, honesty: 0.5, ambition: 0.5 },
  } });
  agent.location = "market";
  agent.asleep = false;
  agent.needs.social = 0;
  agent.needs.rest = 0;
  agent.heading = null;
  agent.job = "bakery.cook";
  town.jobs.get(agent.job)!.holders.push(agent.id);
  town.t = 20 * 60;
  agent.plan = { day: town.day, mood: "", goals: ["Go to the fish house"], steps: [{ hour: 20, do: "Inspect the fish house", place: "fishhouse", done: false }] };
  return { town, agent };
}

describe("routine travel", () => {
  it("does not send a hungry person toward a plan whenever habit waits", async () => {
    const { town, agent } = setup();
    agent.coins = 0;
    agent.needs.hunger = 0.8;
    // The only shelf is here, but the agent cannot afford it. Previously the plan sent them
    // market -> harbor and hunger sent them harbor -> market every minute.
    for (const place of town.places.values()) place.sells = [];
    town.places.get("market")!.sells = [{ item: "bread", base: 1 }];
    town.places.get("market")!.stock.bread = 1;
    for (let i = 0; i < 10; i++) await town.tick();
    expect(agent.location).toBe("market");
    expect(town.events.filter((e) => e.kind === "agent.move" && e.actors.includes(agent.id))).toHaveLength(0);
  });

  it("still follows a plan when no urgent need competes", async () => {
    const { town, agent } = setup();
    agent.needs.hunger = 0.1;
    await town.tick();
    expect(agent.location).toBe("harbor");
    await town.tick();
    expect(agent.location).toBe("fishhouse");
    expect(agent.plan?.steps[0]?.done).toBe(true);
  });

  it("does not seek an empty shelf or a shift in a broken building", () => {
    const { town, agent } = setup();
    agent.plan = null;
    agent.needs.hunger = 0.9;
    for (const place of town.places.values()) for (const shelf of place.sells) place.stock[shelf.item] = 0;
    const view = () => ({ day: town.day, hour: town.hour, weekday: town.weekday, now: town.t, weather: "clear", places: town.places, jobs: town.jobs, crowd: () => 0, price: (place: Place, item: string) => town.price(place, item), path: (from: string, to: string) => town.path(from, to), hops: (from: string, to: string) => town.hops(from, to) });
    expect(habit(agent, view())).toEqual({ kind: "wait" });

    town.t = 9 * 60;
    agent.needs.hunger = 0.1;
    town.places.get("bakery")!.brokenUntil = town.day + 2;
    expect(habit(agent, view())).toEqual({ kind: "wait" });

    agent.job = null;
    for (const job of town.jobs.values()) job.holders = job.id === "bakery.cook" ? [] : Array(job.slots).fill("already-employed");
    expect(habit(agent, view())).toEqual({ kind: "wait" });
  });
});
