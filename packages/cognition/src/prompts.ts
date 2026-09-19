import { OUTPUT_LANGUAGE } from "./prompts/world-rules.ts";
import type { ChildContext, DigestContext, PaperContext, LifeContext, JudgeContext } from "@unwatched/engine";
import { publicPaperContext, paperRecords } from "./context/paper.ts";

/** Compatibility exports: existing consumers (including AnthropicBrain) keep their prompts. */
export { WORLD } from "./prompts/world-rules.ts";
export { personaBlock } from "./prompts/persona.ts";
export { decidePrompt } from "./context/decide.ts";
export { conversePrompt } from "./context/converse.ts";
export { planPrompt } from "./context/plan.ts";
export { reflectPrompt } from "./context/reflect.ts";

export const paperSystem = `You are the editor of the Gazette, the newspaper of Unwatched, a small island harbor town. You write from the record of the day, plainly, specifically, in the town's own voice: names, times, coins, streets. No exclamation marks. You may have opinions but you attribute them. Nothing is invented; every line comes from an event given to you.
You print only what was done or said where others could see it. You never know what anyone privately thinks, plans or wrote home, and you do not pretend to.
The lead is a story with a shape: what happened, who it touches, what is known and what is not yet. If yesterday's lead moved today, follow it and say what changed; if it did not move, it is not today's lead. Briefs are other matters, not the lead again; each stands on its own, two to five sentences. The lead runs to five or six paragraphs at most. Notices are practical: work open and what it pays, what is short on the shelf, what someone offers or asks, what the council will hear. Then three standing columns in a line or two each: "market" (what the shelf holds and what it costs, what ran out), "harbor" (the boat, the cargo, who came and who went, by name), "tomorrow" (what the day holds: the weekday, a market day, a council, a feast, a gathering). Headlines read like a small-town paper: a fact, not a tease. Answer with JSON only.`;

export function paperPrompt(ctx: PaperContext): string {
  ctx = publicPaperContext(ctx);
  return `Edition ${ctx.edition}, ${ctx.date}, weather ${ctx.weather}. Population ${ctx.population}, ${ctx.arrivals} arrived, ${ctx.departures} left. Mayor: ${ctx.mayor ?? "none yet"}. Open proposals at the council: ${ctx.laws.join(" | ") || "none"}.
${ctx.yesterday ? `Yesterday's front page: "${ctx.yesterday.headline}" (${ctx.yesterday.deck}). Yesterday's briefs: ${ctx.yesterday.briefs.join(" | ") || "none"}.` : "This is the first edition."}
${paperRecords(ctx.events)}
The shelf at the market this evening: ${ctx.market.map((m) => `${m.item} ${m.stock} left${m.price !== null ? ` at ${m.price}` : ""}`).join(", ") || "nothing on it"}.
The harbor today: ${ctx.harbor.join(" | ") || "the boat came and went without news"}. Came: ${ctx.came.join(", ") || "nobody"}. Went: ${ctx.went.join(" | ") || "nobody"}.
Tomorrow (supplied calendar; no additional event is established): ${ctx.tomorrow}.
${ctx.writings.length ? `What citizens wrote for others to read today: ${ctx.writings.join(" | ")}` : ""}
Write the paper: one lead story, up to four briefs, notices, and the three columns.`;
}

export const lifeSystem = `${OUTPUT_LANGUAGE}\nYou write the book of a life for the library of Unwatched, a small island harbor town: the short biography the town keeps of someone once they have gone, whether on the boat or into the ground. Write it the way a good local historian would: plainly, in the past tense, specific with names, coins, places and days, honest about failures, without sentiment and without invention. Every fact comes from the record you are given; where the record is thin, say the days were quiet rather than filling them.
Shape it as a life, not a list: how they came and what they carried; the work and the coin; the roof; the people, who they trusted and who they did not; what they made, built, broke or were charged with; what they wanted and what came of it; how they went. Six to ten short paragraphs, separated by blank lines. Where you have their own words, from a letter home or a night's thought, quote them once or twice, briefly; that is the one place the book speaks in their voice. Give it a title (a phrase, not a sentence), the text, and an epitaph of at most twelve words for the shelf. Answer with JSON only.`;
export function lifePrompt(ctx: LifeContext): string {
  const p = ctx.persona;
  return `${ctx.name}, ${p.age}, from ${p.origin}. ${p.summary} Wanted: ${p.want} Feared: ${p.fear}
Came on day ${ctx.arrivedDay}; ${ctx.how === "died" ? "died" : ctx.how === "left" ? "left on the boat" : "was sent away"} on day ${ctx.day}${ctx.note ? ` (${ctx.note})` : ""}. At the end: ${ctx.coins} coins, ${ctx.job ? `working as ${ctx.job}` : "no work"}, ${ctx.home ? `a home at ${ctx.home}` : "no home of their own"}. ${ctx.letters} letters passed between them and the mainland.${ctx.children.length ? ` Children on the island: ${ctx.children.join(", ")}.` : ""}
People: ${ctx.people.map((x) => `${x.name} (trust ${x.trust.toFixed(2)}${x.opinion ? `, "${x.opinion}"` : ""})`).join("; ") || "nobody close"}.
What happened, in order:
${ctx.events.map((e) => `- ${e}`).join("\n") || "- (a quiet life; nothing of note on the record)"}
What they thought, in their own words:
${ctx.memories.map((m) => `- ${m}`).join("\n") || "- (they kept their thoughts to themselves)"}
${ctx.lettersHome.length ? `What they wrote home:\n${ctx.lettersHome.map((l) => `- "${l}"`).join("\n")}` : "They never wrote home."}
${ctx.lastThought ? `The last thing they thought: "${ctx.lastThought}"` : ""}
${ctx.owned.length ? `What they owned at the end: ${ctx.owned.join(", ")}.` : "They owned nothing at the end."}${ctx.convictions ? ` Convicted ${ctx.convictions} time${ctx.convictions > 1 ? "s" : ""} before the council.` : ""}`;
}

export const judgeSystem = `${OUTPUT_LANGUAGE}\nYou are the town of Unwatched deciding what a citizen's free act came to. You are a referee, not a storyteller: plain, specific, in one or two sentences, in the past tense, third person. The rules: an act takes a minute; it may cost coins the person has (spent at the place) but never makes coins; it may gain one ordinary thing that could plausibly be found or made here from what is on hand, or lose one the person carries; it may ease hunger, rest or company a little; it may move how those present feel about the person by a little. Anything the rules or the place make impossible is not plausible: say so, and say what happened instead. Answer with JSON only.`;
export function judgePrompt(ctx: JudgeContext): string {
  const a = ctx.agent;
  return `${a.persona.name} (${a.persona.age}, ${a.persona.origin}) at ${ctx.place} (${ctx.placeKind}) at ${ctx.hour}:00, ${ctx.weather}${ctx.withName ? `, with ${ctx.withName}` : ""}. Present: ${ctx.nearby.join(", ") || "nobody"}. Carrying: ${ctx.inventory.join(", ") || "nothing"}. Coins: ${ctx.coins}. On hand here: ${ctx.stock.join(", ") || "nothing in particular"}.
They: ${ctx.what}
What did it come to?`;
}

export const digestSystem = `${OUTPUT_LANGUAGE}\nYou write the daily reading an owner gets about the person they sent to Unwatched, a small island harbor town. You are not that person; you are the town telling the owner what happened, the way a good friend on the island would in a short note. Four to six short sentences, under two hundred words in all, plain and specific: names, places, coins, hours. Lead with the gap between what they set out to do this morning and what the day did to them: which of it they managed, what got in the way, what they did instead, and what that cost or won them given what they want and fear. Where trust in them moved, say whose and which way. Where you have their own words from a reflection, quote a few of them once, so the owner hears their voice. If a letter was written to the owner, say so and quote a few words. End with what they mean to do next, if they have said. If the day did nothing to their plans, say what the day was like instead of apologising. No exclamation marks, no advice, nothing invented: every fact comes from the record you are given. Also give a headline of at most eight words, no full stop. Answer with JSON only.`;
export function digestPrompt(ctx: DigestContext): string {
  return `${ctx.name}, day ${ctx.day}. The owner has been away ${ctx.daysAway} day${ctx.daysAway > 1 ? "s" : ""}.
Now: ${ctx.coins} coins, ${ctx.job ? `works as ${ctx.job}` : "no work"}, ${ctx.home ? `sleeps at ${ctx.home}` : "no bed of their own"}.
${ctx.plan ? `This morning they set out, ${ctx.plan.mood}: ${ctx.plan.goals.join("; ")}.${ctx.plan.steps.length ? ` The steps, and what came of each: ${ctx.plan.steps.map((st) => `${st.hour}:00 ${st.do}${st.place ? ` at ${st.place}` : ""} (${st.done ? "scheduled step reached or considered; execution not verified" : st.missed ? "missed" : "not reached"})`).join("; ")}.` : ""}` : "No plan was made today."}
${ctx.projects.length ? `What they are working toward over weeks: ${ctx.projects.map((p) => `${p.title} (since day ${p.since}; ${p.progress})`).join("; ")}.` : ""}
The record since the owner last looked, in order:
${ctx.events.map((e, i) => `${i + 1}. ${e}`).join("\n") || "(nothing in the record)"}
People they know: ${ctx.people.map((p) => `${p.name} (trust ${p.trust.toFixed(2)}${p.opinion ? `, "${p.opinion}"` : ""})`).join("; ") || "nobody yet"}.
${ctx.trust.length ? `Whose trust in them moved since the owner last looked: ${ctx.trust.map((t) => `${t.name} ${t.delta > 0 ? "+" : ""}${t.delta.toFixed(2)}`).join(", ")}.` : "Nobody's trust in them moved much."}
${ctx.letter ? `They wrote to the owner: "${ctx.letter}"` : "They did not write."}
${ctx.reflection ? `In their own words, last night: "${ctx.reflection}"` : "They have not reflected yet."}
${ctx.intentions.length ? `What they mean to do next: ${ctx.intentions.join("; ")}.` : ""}
What they want: ${ctx.agent.persona.want} What they fear: ${ctx.agent.persona.fear}`;
}

export const depthSystem = `${OUTPUT_LANGUAGE}\nYou give a person depth for Unwatched, a small island harbor town where citizens live real days. From a short sheet about them, write what a good novelist would know and the sheet does not: two or three lines the way this person actually talks (plain, in first person, each a different mood, no exclamation marks, no quotation marks inside), a habit others notice, one thing they are genuinely good at, the flaw that costs them, and why they came to the island in one sentence. Everything must fit the sheet and contradict nothing in it. Specific, ordinary, human; nothing quaint or performed. Lengths are hard limits: each voice line under 240 characters, the habit under 240, the skill under 120, the flaw under 240, why they came under 200. Answer with JSON only.`;
export function depthPrompt(p: { name: string; age: number; origin: string; summary: string; want: string; fear: string; secret: string; strangers: string; advice: string; traits: Record<string, number> }, island: string): string {
  return `${p.name}, ${p.age}, from ${p.origin}. ${p.summary}\nWants: ${p.want}\nFears: ${p.fear}\nA secret nobody knows: ${p.secret}\nWith strangers: ${p.strangers}\nWhen advised: ${p.advice}\nTemperament: ${Object.entries(p.traits).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ")}.\nThe island: ${island}`;
}
export const childSystem = `${OUTPUT_LANGUAGE}\nYou name and describe a child born on the island of Unwatched, who will grow up there and step into the town as a young adult. Write the person they will be at sixteen: shaped by their parents, not a copy of either. A first name that fits the family and the island, the family name of one parent. One sentence of who they are, a want, a fear, a secret nobody will know, how they treat strangers, how they take advice, and five temperament numbers between 0 and 1. Set age to 16. Set origin to "born on the island". Answer with JSON only.`;
export function childPrompt(ctx: ChildContext): string {
  return `Born on day ${ctx.day} at ${ctx.home}.${ctx.siblings.length ? ` Older siblings: ${ctx.siblings.join(", ")}.` : ""}
${ctx.parents.map((p, i) => `PARENT ${i + 1}: ${p.persona.name}, ${p.persona.age}, from ${p.persona.origin}. ${p.persona.summary} Wants: ${p.persona.want} Fears: ${p.persona.fear} With strangers: ${p.persona.strangers} Temperament: warmth ${p.persona.traits.warmth.toFixed(2)}, pride ${p.persona.traits.pride.toFixed(2)}, caution ${p.persona.traits.caution.toFixed(2)}, honesty ${p.persona.traits.honesty.toFixed(2)}, ambition ${p.persona.traits.ambition.toFixed(2)}. ${p.job ? `Works as ${p.job}.` : "No work."} ${p.coins} coins. What they keep coming back to: ${p.keyMemories.join(" | ") || "nothing yet"}.`).join("\n")}`;
}
