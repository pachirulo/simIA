import { TownEvent, Perception } from "@unwatched/protocol";
import capture from "./kakados-regressions.json";
import { contexts } from "../fixtures.ts";

export const kakados = capture;
export const kakadosRow = (callId: string, attempt = 1) => {
  const row = capture.cases.find(r => r.callId === callId && r.attempt === attempt);
  if (!row) throw Error(`Missing capture ${callId}/${attempt}`);
  return row;
};
export function kakadosReflection(callId: string) {
  const row = kakadosRow(callId), data = row.context;
  if (!("dayMemories" in data)) throw Error("Not a reflection");
  const c = contexts(); c.a.id = row.agentId; c.a.persona.name = row.name; c.a.desires = []; c.a.memory = [];
  for (const source of data.roleSources ?? []) {
    const match = /^\[minute (\d+); (reported speech|recorded observation)[^\]]*\] (.*)$/u.exec(source);
    if (!match) throw Error(`Unrecognized captured role source: ${source}`);
    c.a.memory.push({ t: Number(match[1]), kind: match[2] === "reported speech" ? "rumor" : "obs", text: match[3]!, importance: .5 });
  }
  c.a.coins = data.coins!; Object.assign(c.a.home!, data.home);
  Object.assign(c.reflect, { day: data.day, dayMemories: data.dayMemories, keyMemories: data.keyMemories, actionEvidence: data.actionEvidence,
    desireEvidence: data.desireEvidence!.map(e => TownEvent.parse(e)), projects: [],
    relationships: [{id:"ag_1",name:"Rosa Vidal",trust:0,opinion:""},{id:"ag_2",name:"Petar Ilić",trust:0,opinion:""},{id:"ag_3",name:"Ivana Horvat",trust:0,opinion:""}].filter(r => r.id !== row.agentId),
  });
  return c.reflect;
}
export function kakadosPerception(callId: string) {
  return Perception.parse(kakadosRow(callId).context.perception);
}
