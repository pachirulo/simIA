import type { Perception } from "@unwatched/protocol";
import type { AgentState } from "@unwatched/engine";
import { DECIDE_SYSTEM, decideRules } from "../prompts/decide.ts";
import { personaBlock } from "../prompts/persona.ts";
import { cachePersona, type CognitiveContext } from "./shared.ts";

export function decidePrompt(p: Perception): string {
  const building = p.place.site ? ` At this building site, work contributes one morning per person per day.${p.place.site.worked_today ? " You have already contributed today; another work action adds nothing until tomorrow." : ""} Talking about helping does not create a deal. You may volunteer with work, offer paid help to the builder with offer and construction:{site:"${p.place.id}",mornings:1}, or choose something else. The builder may accept or refuse; these are choices, not assigned goals.` : "";
  return `It is ${p.time.weekday ? `${p.time.weekday}, ` : ""}${p.time.sim}, ${p.time.weather}${p.time.temperature_c !== undefined ? `, ${Math.round(p.time.temperature_c)} degrees` : ""}.${p.time.occasion ? ` Today is ${p.time.occasion}.` : ""}${p.time.gathering ? ` On the town's calendar: ${p.time.gathering}.` : ""} Your self.desires are persistent wants you chose, not orders. They may conflict; you may act on one, change your daily plan, or attend to something else. When an action serves one, include its exact desire_id in your proposal. Acceptance of an action does not mean a desire is fulfilled. Here is what you perceive, as JSON. Choose exactly one action for this minute, in character.${building}${p.nearby.length ? " Prefer talking to people who are here over waiting; \"say\" only reaches the people under \"nearby\"." : " Nobody is here right now: to talk to someone, go where they are, or do something useful alone; do not \"say\" to an empty room."}${p.time.weekday === "Sunday" ? " It is Sunday: no shifts anywhere today." : ""}${p.town?.people?.length ? " Under \"town.people\" is where the people you know are right now and whether they are asleep: to talk to someone, go to their place; nobody asleep can be spoken to." : ""} \"self.feels\" is how your body is, in words: past very hungry the day starts to count against you, and a plan is worth less than a meal.${p.self.shift ? ` Your post is at ${p.self.shift.place}, ${p.self.shift.hours[0]}:00 to ${p.self.shift.hours[1]}:00, ${p.self.shift.wage} coins a shift.` : ""} If a letter from whoever sent you is unread, decide how you feel about it.${p.today ? " Your own plan for today is under \"today\": follow it, or change your mind, as this person would." : ""}${p.hint ? ` ${p.hint}` : ""}${p.crossroads ? ` Something just happened that whoever sent you would want to hear: "${p.crossroads}". If you have something to tell them or ask them, write to them now with "message_owner", a few plain sentences in your own voice; it reaches them within the hour. Otherwise act on what happened.` : ""} Answer with JSON only.\n\n${JSON.stringify(p)}`;
}

export function buildDecideContext(p: Perception, a: AgentState): CognitiveContext {
  const mechanics = decideRules(p);
  return { system: { shared: DECIDE_SYSTEM, own: personaBlock(a), cacheOwn: cachePersona(a) },
    user: (mechanics ? "Mechanics relevant here:\n" + mechanics + "\n\n" : "") + compactDecidePrompt(p, a.home) };
}

/** Keep Perception intact; focus existing evidence and the citizen's own lodging.
 * The legacy decidePrompt remains available for compatibility and measurements. */
export function compactDecidePrompt(p: Perception, home?: AgentState["home"]): string {
  const food = new Set((p.self.learned_food ?? []).map(f => f.item));
  const carriedFood = p.self.inventory.filter(item => food.has(item));
  const advisedFood = p.self.inventory.filter(item => !food.has(item) && p.self.food_advice?.some(f => f.item === item));
  const awake = p.nearby.filter(person => !person.asleep);
  const places = [...new Set([p.place.id, ...p.place.exits, ...(home ? [home.place] : []),
    ...(p.self.shift ? [p.self.shift.place] : []), ...(p.town?.people ?? []).map(person => person.place)])];
  const instructions = [
    "Current perception (JSON):",
    `Known destination IDs=${JSON.stringify(places)}; copy exact IDs, not invented translations. This is a partial map.`,
    `Awake here=${JSON.stringify(awake.map(person => ({ id: person.agent, name: person.name })))}; only these people hear say. town.people is location knowledge, not presence.`,
    `Carried food from experience=${JSON.stringify(carriedFood)}${advisedFood.length ? `; reported food carried=${JSON.stringify(advisedFood)} (advice, unverified)` : ""}; other inventory is unclassified, not necessarily inedible. Shelf goods are not carried.`,
    home ? `Own lodging=${home.place}, nights paid=${home.nightsPaid}; ${home.place === p.place.id ? "you are there" : "you are elsewhere"}. ${p.place.broken ? "This building is broken." : home.place === p.place.id ? "Your lodging provides a known bed here." : `Sleep needs a local bed; none is established here. Known rest destination=${home.place} (move first).`}` : "Own lodging not recorded; local bed availability unknown. Sleep requires a bed.",
    p.place.site && `At this site, work counts once/person/day.${p.place.site.worked_today ? " You already worked today; more adds nothing until tomorrow." : ""} Talking creates no deal. You may volunteer with work, offer the builder paid help (construction.site=place.id, mornings:1), or choose otherwise. The builder may accept/refuse; no goal is assigned.`,
    p.hint && "Consider hint.",
    p.crossroads && 'crossroads is something your owner would want to hear. If you have news or a question, message_owner now in a few plain sentences in your voice; it arrives within the hour. Otherwise act on what happened.',
  ].filter((line): line is string => typeof line === "string");
  return instructions.join("\n") + "\n\n" + JSON.stringify(p);
}
