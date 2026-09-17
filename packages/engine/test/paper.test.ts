import { describe, expect, it } from "vitest";
import type { TownEvent } from "@unwatched/protocol";
import { Town, composePaper, paperStories, publicPaperEvents } from "../src/index.ts";
import type { Brain, PaperContext } from "../src/index.ts";

function event(id: number, kind: TownEvent["kind"], text: string, importance = 0.6, place = "market"): TownEvent {
  return { id, day: 2, t: 1440 + id, kind, text, importance, actors: [], place };
}
function context(events: PaperContext["events"]): PaperContext {
  return { edition: 2, date: "Day 2", weather: "fog", events, laws: [], population: 1, arrivals: 0, departures: 0, yesterday: null,
    market: [{ item: "bread", price: 1, stock: 10 }], harbor: [], came: [], went: [], tomorrow: "Wednesday", mayor: null, writings: [], jobsOpen: [] };
}

describe("the Gazette's public front page", () => {
  it("keeps a person's private self and free-form claims out of the story pool", () => {
    const rows = [
      event(1, "town.gathering", "The council sat in front of 1."),
      event(2, "agent.became", "Rosa now fears losing her secret."),
      event(3, "agent.letter", "Rosa wrote home about the inn."),
      event(4, "agent.do_attempt", "Rosa: inspect the inn."),
      event(5, "agent.do_outcome", "Rosa found a new owner for the inn."),
      event(6, "agent.rent", "Rosa's nights at the inn are up."),
      event(7, "conversation", "Rosa and Ivana spoke behind a closed door.", 0.8, "home"),
    ];
    const publicEvents = publicPaperEvents(rows, 2, (id) => id, (id) => id, (id) => id !== "home");
    expect(publicEvents.map((e) => e.id)).toEqual([1]);
    const paper = composePaper(context(publicEvents));
    expect(paper.lead.sources).toEqual([1]);
    expect(JSON.stringify(paper)).not.toMatch(/secret|new owner|wrote home|nights at the inn/i);
  });

  it("makes separate fire and council stories, and never accepts invented editorial prose or dates", async () => {
    const rows = [
      event(11, "town.fire", "Fire at the orchard. The bell rang.", 0.9, "orchard"),
      event(12, "town.gathering", "The fire at the orchard is out. Three came with buckets.", 1, "orchard"),
      event(13, "town.gathering", "The council sat before 1.", 0.9, "council"),
      event(14, "agent.hired", "Rosa was hired at the inn.", 0.5, "inn"),
    ];
    const publicEvents = publicPaperEvents(rows, 2, (id) => id, (id) => id, () => true);
    const stories = paperStories(publicEvents);
    expect(stories[0]?.events.map((e) => e.id)).toEqual([11, 12]);
    expect(stories.some((s) => s.events.some((e) => e.id === 13))).toBe(true);
    const paper = composePaper(context(publicEvents), { lead: 999, briefs: [12, 12, 999] });
    expect(paper.date).toBe("Day 2");
    expect(paper.lead.sources).toEqual([12, 11]);
    expect(paper.briefs.flatMap((b) => b.sources ?? [])).toContain(13);
    expect(paper.market).toContain("bread: 10 left at 1 coin");
    expect(paper.notices).not.toContain("Work open: mill maintenance");

    const liar = { name: "liar", async writePaper() { return { edition: 400, date: "2024-07-09", weather: "sun", lead: { headline: "The inn has a new owner", deck: "False", body: "Rosa runs the inn.", sources: [999] }, briefs: [], notices: ["Mill maintenance pays 3 coins"] }; } } as unknown as Brain;
    const town = new Town({ seed: 1, brain: liar });
    town.emit("town.fire", [], "market", "Fire at the market. The bell rang.", 1);
    town.emit("agent.became", [], "market", "Rosa now fears the boat.", 0.9);
    await town.printNow();
    const printed = town.papers.at(-1)!;
    expect(printed.date).toBe("Day 1");
    expect(printed.lead.body).toBe("Fire at the market. The bell rang.");
    expect(JSON.stringify(printed)).not.toMatch(/new owner|Rosa now fears|Mill maintenance/i);
  });
});
