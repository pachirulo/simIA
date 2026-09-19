import { TownEvent, Perception } from "@unwatched/protocol";
import capture from "./kaka-regressions.json";
import { contexts } from "../fixtures.ts";

export const kaka = capture;
export const kakaRow = (callId: string, attempt = 1) => {
  const row = capture.cases.find(r => r.callId === callId && r.attempt === attempt);
  if (!row) throw Error(`Missing capture ${callId}/${attempt}`);
  return row;
};
export function kakaReflection(callId: string) {
  const row = kakaRow(callId), data = row.context;
  if (!("dayMemories" in data)) throw Error("Not a reflection");
  const c = contexts(); c.a.id = row.agentId; c.a.persona.name = row.name; c.a.desires = []; c.a.memory = [];
  c.a.coins = data.coins!; Object.assign(c.a.home!, data.home);
  Object.assign(c.reflect, { day: data.day, dayMemories: data.dayMemories, keyMemories: data.keyMemories, actionEvidence: data.actionEvidence,
    desireEvidence: data.desireEvidence!.map(e => TownEvent.parse(e)), projects: [],
    relationships: [{id:"ag_1",name:"Rosa Vidal",trust:0,opinion:""},{id:"ag_2",name:"Petar Ilić",trust:0,opinion:""},{id:"ag_3",name:"Ivana Horvat",trust:0,opinion:""}].filter(r => r.id !== row.agentId),
  });
  return c.reflect;
}
export function kakaPerception(callId: string) {
  return Perception.parse(kakaRow(callId).context.perception);
}
