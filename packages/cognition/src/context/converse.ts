import type { ConverseContext } from "@unwatched/engine";
import type { Dialogue } from "@unwatched/protocol";
import { CORE } from "../prompts/core.ts";
import { sourceAssertions } from "../semantics/sources.ts";
import type { CognitiveContext } from "./shared.ts";
import { arrivalBounds } from "../semantics/dialogue-history.ts";

/** One public-only writer. No private biography, resources, plans or memories. */
export function sharedSpeech(ctx: ConverseContext): { speaker: string; text: string }[] {
  const common = [...new Set(ctx.aMemories)].filter(text => ctx.bMemories.includes(text));
  return sourceAssertions(common.map((text, i) => ({ ref: `shared[${i}]`, text })), [ctx.a.persona.name, ctx.b.persona.name])
    .filter(a => a.speaker !== null && a.certainty === "reported" && ["speech", "observation", "event"].includes(a.source.kind))
    .map(a => ({ speaker: a.speaker!, text: a.assertion }));
}

export const conversePrompt = {
  system: (ctx: ConverseContext) => `Write a short exchange between two people ${ctx.known ? "who have met before" : "meeting for the first time"} at ${ctx.place.name}, ${ctx.time}, ${ctx.weather}. Current local observation: ${ctx.observedPlace ?? "not supplied"}. Only A and B speak. Their names and shared speech are supplied; private biographies, secrets, money, inventory, employment and plans are deliberately withheld. Do not invent them or transfer one person's identity to the other. Ask questions or discuss the observed surroundings when little is known. Two to six lines. A person may lie or speculate, but memories must preserve who said what and its uncertainty. A spoken favour, price, promise or claim of delivery remains speech until acted on. Saying they brought something does not prove receipt, barter or consumption. Preserve delivery/payment conditions. outcome.rumor is only a claim A tells B; if B originated it, use null. Repetition is not corroboration. Do not invent private outcomes. Answer with JSON only.`,
  user: (ctx: ConverseContext) => JSON.stringify({
    a: { id: ctx.a.id, name: ctx.a.persona.name, temperament: ctx.a.persona.traits },
    b: { id: ctx.b.id, name: ctx.b.persona.name, temperament: ctx.b.persona.traits },
    sharedSpeech: sharedSpeech(ctx),
    arrivalBounds: arrivalBounds(ctx),
    historyRule: "Arrival bounds are public chronology, not a biography. Do not invent nights spent here, earlier visits or shared local experiences predating arrival. Prior dialogue can contain false claims and is not proof of those experiences. Ask about ledgers, plots, repairs and earlier storms instead of inventing personal familiarity. Lies, rumors and speculation remain possible: when deliberately lying against arrival chronology, explicitly record I lied/pretended about it in the speaker's outcome memory, never as true history. Outcome memories may summarize the lines in this response as speech; those lines cannot prove physical actions.",
    note: "Temperament guides style, not factual knowledge. Individual memories and private motives are unavailable. Shared speech is past conversation, not new dialogue to copy: continue it, ask a new question, or explicitly refer back to it. No shared record does not mean nothing happened. Trust deltas describe this exchange only.",
  }),
};

export function buildConverseContext(ctx: ConverseContext): CognitiveContext {
  return { system: { shared: CORE, own: conversePrompt.system(ctx) }, user: conversePrompt.user(ctx) };
}

/** Same privacy boundary on provider failure; no private MockBrain topics. */
export function publicDialogueFallback(ctx: ConverseContext): Dialogue {
  return { lines: [{ speaker: ctx.a.id, text: "Good to see you." }, { speaker: ctx.b.id, text: "Hello." }],
    outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "", b_remember: "", rumor: null } };
}
