import type { ConverseContext } from "@unwatched/engine";
import type { Dialogue } from "@unwatched/protocol";
import { fold } from "./evidence.ts";
import type { SemanticIssue } from "./quality.ts";

/** Public arrival boundary only: no private motives, memory, holdings or job. */
export function arrivalBounds(ctx: ConverseContext) {
  const clock = /day (\d+) (\d+):(\d+)/u.exec(ctx.time);
  const now = clock ? (Number(clock[1]) - 1) * 1440 + Number(clock[2]) * 60 + Number(clock[3]) : null;
  return Object.fromEntries((["a", "b"] as const).map(key => [key, {
    arrivedAt: ctx[key].arrivedAt, elapsedMinutes: now === null ? null : now - ctx[key].arrivedAt,
    nightsSinceArrival: now === null ? null : Math.floor(now / 1440) - Math.floor(ctx[key].arrivedAt / 1440),
  }]));
}

export function dialogueHistoryIssue(out: Dialogue, ctx: ConverseContext, sides: ("a" | "b" | null)[]): SemanticIssue | null {
  const bounds = arrivalBounds(ctx);
  for (const [index, line] of out.lines.entries()) {
    const key = sides[index]; if (!key) continue;
    const bound = bounds[key]!; if (bound.elapsedMinutes === null || bound.elapsedMinutes < 0) continue;
    const prior = fold(out.lines[index - 1]?.text ?? "");
    for (const sentence of line.text.split(/[.;!?]/u)) {
      const s = fold(sentence).trim();
      if (/\b(?:heard|said|rumor|maybe|imagine|pretend|might|would|will|back home|before coming)\b/u.test(s)) continue;
      const duration = /\b(a few|several|two|three|four|five|\d+) days\b/u.exec(s);
      const autobiographical = /\b(?:i(?:'ve| have| had)? been|i arrived|i came|i stayed)\b/u.test(s)
        || /^(?:a few|several|two|three|four|five|\d+) days now\b/u.test(s)
        || /^not for /u.test(s) && /\b(?:you been|you gone|you visit)\b/u.test(prior);
      const days = duration ? ({ "a few": 2, several: 2, two: 2, three: 3, four: 4, five: 5 }[duration[1]!] ?? Number(duration[1])) : null;
      const beforeArrival = days !== null && autobiographical && days * 1440 > bound.elapsedMinutes
        || bound.nightsSinceArrival === 0 && /\b(?:i slept (?:here|at the inn)|i spent (?:the|a) night (?:here|at the inn)|for a night in (?:the )?common room)\b/u.test(s);
      if (!beforeArrival) continue;
      // Deliberate deception stays playable, with provenance in the speaker's memory.
      // Mere "I said" attribution is not evidence that the model intended a lie.
      const memory = fold(out.outcome[`${key}_remember`]);
      if (/\bi (?:lied|pretended|bluffed)\b/u.test(memory) && /\b(?:arrival|arrived|days|night|staying|stay|been here)\b/u.test(memory)) continue;
      return { code: "dialogue_autobiography_conflict", path: `lines[${index}].text`,
        message: `${ctx[key].persona.name} arrived ${bound.elapsedMinutes} minutes ago. This line presents local experience before that arrival as personal history. Ground it in known history, phrase it as a rumor/question, or identify deliberate lying in that speaker's outcome memory without storing it as true experience.` };
    }
  }
  return null;
}
