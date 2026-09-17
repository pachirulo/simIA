import { Town, BUILDS, type ConverseContext, type PlanContext, type ReflectContext } from "@unwatched/engine";
import type { Persona } from "@unwatched/protocol";
import { MockBrain } from "../src/mock.ts";

export const persona: Persona = {
  name: "Ángela Ríos", age: 33, origin: "Córdoba", summary: "Una carpintera que escucha antes de hablar.",
  want: "Construir una casa", fear: "Perder a sus amigos", secret: "Guarda una carta",
  strangers: "Curiosa", advice: "Lo considera", traits: { warmth: .6, pride: .4, caution: .3, honesty: .7, ambition: .8 },
  habit: "Se acomoda las mangas", skill: "Carpintería", flaw: "Le cuesta pedir ayuda",
  cameBecause: "Buscaba trabajo", voice: ["Lo hablamos mañana.", "Todavía no está hecho."],
};

/** Real engine state/perception, plus the same bounded contexts the engine hands to Brain. */
export function contexts() {
  const town = new Town({ seed: 13, brain: new MockBrain(13) });
  const a = town.addAgent({ persona, owner: "owner-a" });
  const b = town.addAgent({ persona: { ...persona, name: "Tomás Díaz" } });
  a.location = b.location = "market";
  a.relationships.set(b.id, { trust: .6, affection: .4, lastSeen: town.t, lastPlace: "market", opinion: "Cumple sus promesas" });
  b.relationships.set(a.id, { trust: .5, affection: .3, lastSeen: town.t, lastPlace: "market", opinion: "Habla claro" });
  a.memory.push({ t: town.t, text: "UNSELECTED_PRIVATE_MEMORY", importance: .1, kind: "obs" });
  a.desires = [{ id: "desire-home", title: "Construir una casa", why: "Quiero un techo", state: "active", since: 1, updated: 1, history: [], attempts: [] }];
  const perception = town.perceive(a);
  const relationships = [{ id: b.id, name: b.persona.name, trust: .6, opinion: "Cumple sus promesas" }];
  const plan: PlanContext = {
    agent: a, day: 2, hour: 7, weather: "clear", yesterday: "[interpretation] Creo que puedo construir.",
    intentions: ["Pedir ayuda"], keyMemories: ["[observation] Compré pan."], relationships,
    unreadLetters: ["¿Cómo estás?"], places: [...town.places.values()].map(p => ({ id: p.id, name: p.name, kind: p.kind })),
    jobsOpen: [...town.jobs.values()].map(j => `${j.title} at ${j.place}, ${j.wage} coins`),
    land: ["lane-1"], building: ["Casa de Tomás: 1 de 4 mañanas"], owned: ["Taller de Ángela"],
    builds: { house: BUILDS.house, shop: BUILDS.shop }, projects: [{ title: "Casa", progress: "No empezada", since: 1 }],
  };
  const converse: ConverseContext = {
    a, b, place: town.places.get("market")!, time: "07:00", weather: "clear", known: true,
    observedPlace: "No hay daños registrados.", aToday: "Comprar madera", bToday: "Encontrar trabajo",
    aMemories: ["[speech] Tomás dijo que reparó el molino."], bMemories: ["[observation] Ángela me saludó."],
    rumorsA: ["[rumor] Dicen que vendrá un barco."],
  };
  const reflect: ReflectContext = {
    agent: a, day: 2, dayMemories: ["[speech] Tomás prometió ayudar."], keyMemories: plan.keyMemories,
    relationships, unreadLetters: plan.unreadLetters, quiet: false,
    plan: { mood: "Esperanzada", goals: ["Comprar pan"], steps: [{ hour: 9, do: "Comprar pan", place: "market", done: true, missed: false }] },
    projects: [{ title: "Casa", why: "Un techo", progress: "No empezada", since: 1 }],
    beliefs: [{ about: "Tomás", belief: "Me ayudará", confidence: .6 }], watch: ["market"],
    actionEvidence: ["[event 41, minute 540, agent.trade] Ángela compró pan."],
    desireEvidence: [{ id: 41, t: 540, day: 2, kind: "agent.trade", actors: [a.id], place: "market", text: "Ángela compró pan.", importance: .6 }],
  };
  // Like the server, world facts are supplied at runtime, including custom names.
  const primer = `La isla de ${town.name}:\nPlaces: ${plan.places.map(p => `${p.id}: ${p.name}`).join("; ")}.\nWork: ${plan.jobsOpen.join("; ")}.\nFeasts: ${town.pack.feasts.map(f => `${f.name}: ${f.day}/${f.month}`).join("; ")}.`;
  return { town, a, b, perception, plan, converse, reflect, primer };
}
