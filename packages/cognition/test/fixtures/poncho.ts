import { Perception, TownEvent } from "@unwatched/protocol";
import capture from "./poncho-regressions.json";
import { contexts } from "../fixtures.ts";

export { capture as poncho };
export function ponchoCase(id: string) {
  const row = capture.cases.find(row => row.id === id);
  if (!row) throw Error(`Missing Poncho generation ${id}`);
  return row;
}
export const ponchoPerception = (id: string) => Perception.parse(ponchoCase(id).perception);

/** Exact selected reflection evidence; surrounding unrecorded fields use the
 * ordinary test state. No claim of an exact saved AgentState restoration. */
export function ponchoReflection(agentId: keyof typeof capture.contexts) {
  const fixture = capture.contexts[agentId], c = contexts();
  c.a.id = agentId; c.a.persona.name = capture.cases.find(row => row.agentId === agentId)!.name;
  c.a.coins = fixture.coins; c.a.home = { ...c.a.home!, ...fixture.home }; c.a.desires = [];
  c.a.job = fixture.hasJob ? "inn.help" : null;
  Object.assign(c.reflect, { day: fixture.day, dayMemories: fixture.dayMemories, keyMemories: fixture.keyMemories,
    actionEvidence: fixture.actionEvidence, desireEvidence: fixture.desireEvidence.map(e => TownEvent.parse(e)),
    relationships: Object.keys(capture.contexts).filter(id => id !== agentId).map(id => ({ id, name: capture.cases.find(row => row.agentId === id)!.name, trust: 0 })),
  });
  return c.reflect;
}
