import type { AgentState } from "@unwatched/engine";
import type { Perception } from "@unwatched/protocol";

/** Project existing engine purchase experiences, including their receipt IDs.
 * Not inferred from inventory, confidence, advice or previous proposals. The
 * returned perception is shared by prompt and validator; source state is untouched. */
export function decisionEvidence(p: Perception, a: AgentState): Perception {
  if (p.agent_id !== a.id) return p;
  const now = (p.time.day - 1) * 1440 + p.time.minute;
  const receipts = (a.foodLessons ?? []).flatMap(lesson => lesson.evidence
    .filter(e => e.success && Number.isSafeInteger(e.eventId) && e.eventId! > 0
      && Number.isFinite(e.t) && e.t <= now && now - e.t <= 1440 && Number.isFinite(e.cost) && e.cost >= 0)
    .map(e => ({ id: e.eventId!, t: e.t,
      text: `[event ${e.eventId}, minute ${e.t}, agent.trade] ${a.persona.name} bought ${lesson.item} for ${e.cost} at ${lesson.place}.` })))
    .sort((x,y) => y.t - x.t).slice(0, 6);
  const selected = new Set(p.recent.flatMap(text => /^\[event (\d+),/u.exec(text)?.[1] ?? []));
  const extra = receipts.filter(r => { const id=String(r.id); if(selected.has(id)) return false; selected.add(id); return true; });
  return extra.length ? { ...p, recent: [...p.recent, ...extra.map(r => r.text)] } : p;
}
