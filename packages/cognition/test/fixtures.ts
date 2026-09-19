import { Town, BUILDS, type ConverseContext, type PlanContext, type ReflectContext } from "@unwatched/engine";
import type { Persona } from "@unwatched/protocol";
import { MockBrain } from "../src/mock.ts";

export const persona: Persona = {
  name: "Ángela Ríos", age: 33, origin: "Córdoba", summary: "A carpenter who listens before speaking.",
  want: "Build a house", fear: "Losing her friends", secret: "Keeps a letter",
  strangers: "Curious", advice: "Considers it", traits: { warmth: .6, pride: .4, caution: .3, honesty: .7, ambition: .8 },
  habit: "Adjusts her sleeves", skill: "Carpentry", flaw: "Struggles to ask for help",
  cameBecause: "Looking for work", voice: ["We can discuss it tomorrow.", "It is not done yet."],
};

/** Real engine state/perception, plus the same bounded contexts the engine hands to Brain. */
export function contexts() {
  const town = new Town({ seed: 13, brain: new MockBrain(13) });
  const a = town.addAgent({ persona, owner: "owner-a" });
  const b = town.addAgent({ persona: { ...persona, name: "Tomás Díaz" } });
  a.location = b.location = "market";
  a.relationships.set(b.id, { trust: .6, affection: .4, lastSeen: town.t, lastPlace: "market", opinion: "Keeps promises" });
  b.relationships.set(a.id, { trust: .5, affection: .3, lastSeen: town.t, lastPlace: "market", opinion: "Speaks plainly" });
  a.memory.push({ t: town.t, text: "UNSELECTED_PRIVATE_MEMORY", importance: .1, kind: "obs" });
  a.desires = [{ id: "desire-home", title: "Build a house", why: "I want a roof", state: "active", since: 1, updated: 1, history: [], attempts: [] }];
  const perception = town.perceive(a);
  const relationships = [{ id: b.id, name: b.persona.name, trust: .6, opinion: "Keeps promises" }];
  const plan: PlanContext = {
    agent: a, day: 2, hour: 7, weather: "clear", yesterday: "[interpretation] I think I could build.",
    intentions: ["Ask for help"], keyMemories: ["[observation] I bought bread."], relationships,
    unreadLetters: ["How are you?"], places: [...town.places.values()].map(p => ({ id: p.id, name: p.name, kind: p.kind })),
    jobsOpen: [...town.jobs.values()].map(j => `${j.title} at ${j.place}, ${j.wage} coins`),
    land: ["lane-1"], building: ["Tomás house: 1 of 4 mornings"], owned: ["Ángela workshop"],
    builds: { house: BUILDS.house, shop: BUILDS.shop }, projects: [{ title: "House", progress: "Not started", since: 1 }],
  };
  const converse: ConverseContext = {
    a, b, place: town.places.get("market")!, time: "07:00", weather: "clear", known: true,
    observedPlace: "No recorded damage.", aToday: "Buy timber", bToday: "Find work",
    aMemories: ["[speech] Tomás said he repaired the mill."], bMemories: ["[observation] Ángela greeted me."],
    rumorsA: ["[rumor] They say a boat is coming."],
  };
  const reflect: ReflectContext = {
    agent: a, day: 2, dayMemories: ["[speech] Tomás promised to help."], keyMemories: plan.keyMemories,
    relationships, unreadLetters: plan.unreadLetters, quiet: false,
    plan: { mood: "Hopeful", goals: ["Buy bread"], steps: [{ hour: 9, do: "Buy bread", place: "market", done: true, missed: false }] },
    projects: [{ title: "House", why: "A roof", progress: "Not started", since: 1 }],
    beliefs: [{ about: "Tomás", belief: "Will help me", confidence: .6 }], watch: ["market"],
    actionEvidence: ["[event 41, minute 540, agent.trade] Ángela bought bread."],
    desireEvidence: [{ id: 41, t: 540, day: 2, kind: "agent.trade", actors: [a.id], place: "market", text: "Ángela bought bread.", importance: .6 }],
  };
  // Like the server, world facts are supplied at runtime, including custom names.
  const primer = `The island of ${town.name}:\nPlaces: ${plan.places.map(p => `${p.id}: ${p.name}`).join("; ")}.\nWork: ${plan.jobsOpen.join("; ")}.\nFeasts: ${town.pack.feasts.map(f => `${f.name}: ${f.day}/${f.month}`).join("; ")}.`;
  return { town, a, b, perception, plan, converse, reflect, primer };
}
