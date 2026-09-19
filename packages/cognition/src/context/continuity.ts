import type { ActionProposal, Perception } from "@unwatched/protocol";
import type { AgentState } from "@unwatched/engine";

const minute = (p: Perception) => (p.time.day - 1) * 1440 + p.time.minute;
const clip = (text: string, limit: number) => text.length > limit ? text.slice(0, limit) + " [excerpt]" : text;
const state = (p: Perception) => ({ location: p.self.location, inventory: [...p.self.inventory].sort(),
  coins: p.self.coins, job: p.self.job, hunger: p.self.needs.hunger, rest: p.self.needs.rest });
type State = ReturnType<typeof state>;
interface Attempt { t: number; action: ActionProposal["action"]; intent?: string; before: State }

/** Short-lived working context, scoped to the actual citizen object (not reusable
 * IDs across towns). These are proposals, NEVER receipts or a queue of commands.
 * Restarting a brain loses this diagnostic history, not persistent intentions. */
export class DecisionContinuity {
  private attempts = new WeakMap<AgentState, Attempt[]>();

  record(a: AgentState, p: Perception, out: ActionProposal): void {
    const history = this.recent(a, p);
    this.attempts.set(a, [...history, { t: minute(p), action: structuredClone(out.action),
      ...(out.intent ? { intent: clip(out.intent, 180) } : {}), before: state(p) }].slice(-3));
  }

  private recent(a: AgentState, p: Perception): Attempt[] {
    const now = minute(p);
    return (this.attempts.get(a) ?? []).filter(x => x.t < now && now - x.t <= 1440);
  }

  describe(a: AgentState, p: Perception): string {
    const history = this.recent(a, p);
    if (!history.length) return "";
    const last = history.at(-1)!, current = state(p);
    const changed = Object.keys(current).filter(key => JSON.stringify(current[key as keyof State]) !== JSON.stringify(last.before[key as keyof State]));
    const delta = Object.fromEntries(changed.map(key => [key, { from: last.before[key as keyof State], to: current[key as keyof State] }]));
    const stationary = history.length >= 2 && history.every(x => x.before.location === current.location);
    const hungry = p.self.needs.hunger > .6 && history.length >= 2 && history.every(x => x.before.hunger > .6);
    return [
      `Previous proposals (not execution receipts)=${JSON.stringify(history.map(({ t, action, intent }, i) => ({ t,
        action: JSON.stringify(action).length <= 320 ? action : { kind: action.kind, excerpt: clip(JSON.stringify(action), 320) },
        ...(i === history.length - 1 ? { intent } : {}) })))}`,
      `Observed since last decision=${JSON.stringify(delta)}. Changes can include habit/other events; unchanged state does not prove rejection. Previous execution result remains unknown unless explicitly recorded in supplied personal evidence; a desire last_attempt records acceptance only, not goal completion.`,
      (stationary || hungry) && `Continuity check: ${[stationary && "still at the same location across these decisions", hungry && "hunger still unresolved"].filter(Boolean).join("; ")}. Repeating an intention is not physical progress. Choose a concrete next step, or explain a deliberate delay/change of mind in intent; conversation remains a choice. Consider another known source, asking, producing, waiting or postponing; weigh body urgency, known costs and opportunity. Staying here can be useful work or company, not failure.`,
    ].filter(Boolean).join("\n");
  }
}

/** Recover only a bounded recent personal thread missed by relevance retrieval.
 * No world access, partner's private memory, mutations, or inferred commitments. */
export function personalContinuity(p: Perception, a: AgentState): string {
  const now = minute(p);
  const recent = a.memory.filter(m => m.t <= now && now - m.t <= 1440);
  const speech = recent.filter(m => /^(?:I said|Conversation at|My interpretation of the conversation)/u.test(m.text)).slice(-2);
  const missing = speech.filter(m => !p.recent.some(text => text.includes(m.text)) && !p.heard.some(h => m.text.includes(h.text)));
  return [
    a.heading && `Travel destination already chosen=${a.heading}; current location=${p.place.id}. Arrival requires observed location, not announcing departure.`,
    a.intentions.length > 0 && `Personal intentions, revisable=${JSON.stringify(a.intentions.slice(0, 3).map(s => clip(s, 200)))}`,
    ...missing.map(m => `Recent personal ${m.kind === "reflect" ? "interpretation" : "speech"} (minute ${m.t}; claims/promises, not completed acts): ${clip(m.text, 650)}`),
    p.today && "today.steps.done records schedule attendance/consideration, NOT completed work; missed is a missed time, not a cancelled goal. Reassess against current state. If still wanted, take its next physical step instead of repeating the plan.",
  ].filter(Boolean).join("\n");
}
