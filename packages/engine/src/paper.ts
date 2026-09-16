import type { Paper, PaperOutline, TownEvent } from "@unwatched/protocol";
import type { PaperContext } from "./types.ts";

type PaperEvent = PaperContext["events"][number];
export type PaperStory = { id: number; events: PaperEvent[]; importance: number };

// Publication is opt-in. A new event kind cannot expose a thought or a letter by accident.
const PUBLIC_KINDS = new Set<TownEvent["kind"]>([
  "agent.arrive", "agent.leave", "agent.say", "agent.give", "agent.take", "agent.trade",
  "agent.work", "agent.hired", "agent.quit", "agent.fired", "agent.evicted",
  "agent.build", "agent.unpaid", "agent.died", "agent.hire", "agent.lend",
  "institution.founded", "institution.joined", "institution.left", "building.repaired",
  "skill.proposed", "skill.practiced", "skill.shared", "place.decorated",
  "project.proposed", "project.contributed", "project.withdrawn", "garden.harvest",
  "knowledge.shared", "economy.price", "law.proposed", "law.vote", "law.passed", "law.failed",
  "deal.offered", "deal.accepted", "deal.refused", "deal.kept", "deal.broken",
  "conversation", "town.mayor", "town.works", "town.verdict", "town.gathering", "town.fire",
  "boat.cargo", "cart.leg", "town.recipe", "town.named", "town.rule",
  "town.expose", "town.built", "town.born", "town.of_age", "boat.news",
]);
const PLACE_SENSITIVE = new Set<TownEvent["kind"]>(["conversation", "agent.say", "agent.give", "agent.take", "agent.trade", "deal.offered", "deal.accepted", "deal.refused", "deal.kept", "deal.broken"]);

/** Only completed, publicly observable events can become stories. */
export function publicPaperEvents(events: TownEvent[], day: number, nameOf: (id: string) => string, placeOf: (id: string) => string, isPublicPlace: (id: string) => boolean): PaperEvent[] {
  return events.filter((e) => e.day === day && e.importance >= 0.3 && PUBLIC_KINDS.has(e.kind) && (!PLACE_SENSITIVE.has(e.kind) || !!e.place && isPublicPlace(e.place)))
    .map((e) => ({ id: e.id, t: e.t, kind: e.kind, text: e.text, importance: e.importance, actors: e.actors.map(nameOf), place: e.place ? placeOf(e.place) : null }));
}

function storyKey(e: PaperEvent): string {
  if (e.kind === "town.gathering" && /fire/i.test(e.text)) return `fire:${e.place}`;
  if (e.kind === "town.gathering" && /council/i.test(e.text)) return "council";
  if (["town.mayor", "law.proposed", "law.vote", "law.passed", "law.failed"].includes(e.kind)) return "council";
  if (["agent.arrive", "agent.leave", "boat.cargo", "boat.news"].includes(e.kind)) return "harbor";
  if (e.kind === "town.fire") return `fire:${e.place}`;
  if (e.kind === "conversation") return `conversation:${[...e.actors].sort().join(":")}:${e.place}`;
  if (["agent.hired", "agent.quit", "agent.fired", "agent.work", "agent.unpaid"].includes(e.kind)) return `work:${e.kind}:${e.place}`;
  return `${e.kind}:${e.actors[0] ?? "town"}:${e.place ?? ""}`;
}

/** Group related moments so the front page has distinct stories, not duplicate briefs. */
export function paperStories(events: PaperEvent[]): PaperStory[] {
  const groups = new Map<string, PaperEvent[]>();
  for (const e of events) groups.set(storyKey(e), [...(groups.get(storyKey(e)) ?? []), e]);
  return [...groups.values()].map((group) => {
    const ranked = [...group].sort((a, b) => b.importance - a.importance || a.t - b.t);
    const routineCouncil = group.every((e) => e.kind === "town.gathering" && /council/i.test(e.text));
    return { id: ranked[0]!.id, events: ranked.slice(0, 4).sort((a, b) => a.t - b.t), importance: routineCouncil ? Math.min(0.35, ranked[0]!.importance) : ranked[0]!.importance };
  }).sort((a, b) => b.importance - a.importance || a.events[0]!.t - b.events[0]!.t).slice(0, 24);
}

function firstSentence(text: string): string { return (text.split(/(?<=[.!?])\s/)[0] ?? text).replace(/[.!?]$/, "").slice(0, 118); }
function hhmm(t: number): string { const m = t % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
function storyText(story: PaperStory, max: number): string { return story.events.map((e) => e.text).join("\n\n").slice(0, max); }
function sourceIds(story: PaperStory): number[] { return [story.id, ...story.events.map((e) => e.id).filter((id) => id !== story.id)]; }

/** The model may rank story IDs. It cannot add facts, rewrite event text, or set dates and notices. */
export function composePaper(ctx: PaperContext, outline?: PaperOutline | null): Paper {
  const stories = paperStories(ctx.events);
  const byId = new Map(stories.map((s) => [s.id, s]));
  const lead = outline && byId.get(outline.lead) || stories[0];
  const requested = (outline?.briefs ?? []).map((id) => byId.get(id)).filter((s): s is PaperStory => !!s && s.id !== lead?.id);
  const briefs = [...new Map([...requested, ...stories.filter((s) => s.id !== lead?.id)].map((s) => [s.id, s])).values()].slice(0, 4);
  const notices = [
    `Population ${ctx.population}. ${ctx.arrivals} arrived, ${ctx.departures} left.`,
    ...ctx.laws.slice(0, 2).map((law) => `At the council: ${law}`),
    ...ctx.jobsOpen.slice(0, 3).map((job) => `Work open: ${job}`),
  ].slice(0, 6).map((notice) => notice.slice(0, 240));
  const market = ctx.market.length ? ctx.market.map((m) => `${m.item}: ${m.stock} left${m.price === null ? "" : ` at ${m.price} coin${m.price === 1 ? "" : "s"}`}`).join("; ") : "No goods listed at the market.";
  const harbor = [ctx.came.length ? `Arrived: ${ctx.came.join(", ")}.` : "", ctx.went.length ? `Departed: ${ctx.went.join("; ")}.` : "", ...ctx.harbor.filter((line) => !/boat docked\.$/.test(line)).slice(0, 2)].filter(Boolean).join(" ") || "No arrivals, departures or cargo reported.";
  return {
    edition: ctx.edition, date: ctx.date, weather: ctx.weather,
    lead: lead ? { headline: firstSentence(lead.events[0]!.text), deck: `${ctx.date} · ${hhmm(lead.events[0]!.t)}${lead.events[0]!.place ? ` · ${lead.events[0]!.place}` : ""}`, body: storyText(lead, 2600), sources: sourceIds(lead) }
      : { headline: "A quiet day on the island", deck: ctx.date, body: "No public event qualified for the front page today.", sources: [] },
    briefs: briefs.map((story) => ({ headline: firstSentence(story.events[0]!.text), body: storyText(story, 1200), sources: sourceIds(story) })),
    notices, market: market.slice(0, 420), harbor: harbor.slice(0, 420), tomorrow: ctx.tomorrow.slice(0, 240),
  };
}
