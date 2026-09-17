import type { ConverseContext } from "@unwatched/engine";
import { CORE } from "../prompts/core.ts";
import { personaBlock } from "../prompts/persona.ts";
import { type CognitiveContext } from "./shared.ts";

export const conversePrompt = {
  system: (ctx: ConverseContext) => `You will write a short real exchange between two people ${ctx.known ? "who know each other and have dealt with each other before" : "who have just met"} at ${ctx.place.name}, ${ctx.time}, ${ctx.weather}. Current local observation: ${ctx.observedPlace ?? "not supplied; do not infer damage or construction"}. Do not invent inspections, jobs, ownership or payments to fit a backstory. A favour or promise spoken here remains speech until separately acted on. Conversation memories must say who claimed what, not turn claims into witnessed facts. Write both sides truthfully to who each of them is and to what each wants from today; people who know each other pick up where they left off, and do not introduce themselves. Two to six lines. Let something actually happen when it can: a favour asked, a price named, a thing admitted, a refusal. Decide what each of them will remember and how much more or less they trust each other afterwards. If one of them passes on something they heard, put it in rumor. Answer with JSON only.`,
  user: (ctx: ConverseContext) => `PERSON A (id ${ctx.a.id}):\n${personaBlock(ctx.a)}\nA's current job: ${ctx.a.job ?? "none"}. A arrived on day ${Math.floor(ctx.a.arrivedAt / 1440) + 1}.\nWhat A wants from today: ${ctx.aToday ?? "nothing decided"}\nWhat A remembers about B: ${ctx.aMemories.join(" | ") || "nothing"}\nWhat A has heard lately: ${ctx.rumorsA.join(" | ") || "nothing"}\nA's trust in B: ${(ctx.a.relationships.get(ctx.b.id)?.trust ?? 0.3).toFixed(2)}${ctx.a.relationships.get(ctx.b.id)?.opinion ? `, and A thinks: "${ctx.a.relationships.get(ctx.b.id)!.opinion}"` : ""}\n\nPERSON B (id ${ctx.b.id}):\n${personaBlock(ctx.b)}\nB's current job: ${ctx.b.job ?? "none"}. B arrived on day ${Math.floor(ctx.b.arrivedAt / 1440) + 1}.\nWhat B wants from today: ${ctx.bToday ?? "nothing decided"}\nWhat B remembers about A: ${ctx.bMemories.join(" | ") || "nothing"}\nB's trust in A: ${(ctx.b.relationships.get(ctx.a.id)?.trust ?? 0.3).toFixed(2)}${ctx.b.relationships.get(ctx.a.id)?.opinion ? `, and B thinks: "${ctx.b.relationships.get(ctx.a.id)!.opinion}"` : ""}`,
};

/** A single call still writes both sides; the engine supplies each side's relevant memories. */
export function buildConverseContext(ctx: ConverseContext): CognitiveContext {
  return { system: { shared: CORE, own: conversePrompt.system(ctx) }, user: conversePrompt.user(ctx) };
}
