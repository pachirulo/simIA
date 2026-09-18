import { desiresForMind, type PlanContext } from "@unwatched/engine";
import { PLAN_SYSTEM } from "../prompts/plan.ts";
import { personaBlock } from "../prompts/persona.ts";
import { cachePersona, type CognitiveContext } from "./shared.ts";

export function planPrompt(ctx: PlanContext): string {
  return `It is the morning of day ${ctx.day}, ${ctx.hour}:00, ${ctx.weather}. Make your own plan for today, in first person, as this person and nobody else. Not a to-do list for a game: what you actually want from the day, given what you have, who you know, and what you fear.
Your lasting desires (you can choose among them or attend to something else): ${JSON.stringify(desiresForMind(ctx.agent.desires))}.
Body now (0 satisfied, 1 urgent): ${JSON.stringify(ctx.agent.needs)}. Reserve feasible food/rest before optional goals; later urgent state can override any step.
What you carry: ${ctx.agent.coins} coins, ${ctx.agent.job ? `work as ${ctx.agent.job}` : "no work"}, ${ctx.agent.home ? `a bed at ${ctx.agent.home.place} paid for ${ctx.agent.home.nightsPaid} more nights` : "no bed of your own"}.
Last night you thought: ${ctx.yesterday ?? "nothing yet; you arrived recently"}.${ctx.projects?.length ? `\nWhat you are working toward: ${ctx.projects.map((p) => `${p.title} (since day ${p.since}; ${p.progress})`).join("; ")}. Advance these when your current needs and resources permit.` : ""}
What you meant to do next: ${ctx.intentions.join(" | ") || "nothing decided"}.
What you keep coming back to: ${ctx.keyMemories.join(" | ") || "nothing"}.
People you know: ${ctx.relationships.map((r) => `${r.name} (${r.id}) trust ${r.trust.toFixed(2)}${r.opinion ? `, "${r.opinion}"` : ""}`).join("; ") || "nobody yet"}.
Letters waiting for you: ${ctx.unreadLetters.join(" | ") || "none"}.
Places on the island: ${ctx.places.map((p) => `${p.id} (${p.name})`).join(", ")}.
Work going: ${ctx.jobsOpen.join("; ") || "none"}.
A shared garden can instead be proposed with start_project, named and motivated by you, then funded and worked by willing neighbors.
Land for sale, paid to the council: ${ctx.land.join("; ") || "none left"}. A house costs ${ctx.builds.house.coins} coins and ${ctx.builds.house.labor} mornings of work (${ctx.builds.house.describe}). A shop costs ${ctx.builds.shop.coins} coins and ${ctx.builds.shop.labor} mornings (${ctx.builds.shop.describe}). To build, stand on the plot and build; then turn up and work on it, or get others to help.
Being built on the island: ${ctx.building.join("; ") || "nothing"}.
What you own: ${ctx.owned.join("; ") || "nothing"}.
Give a mood in a few words, one to three goals, and one to six steps: {hour, do: intended activity, place: exact supplied ID or null}. Each step needs an activity, not just a destination. You may plan to do nothing, talk, change your life or leave. Answer with JSON only.`;
}

export function buildPlanContext(ctx: PlanContext): CognitiveContext {
  return { system: { shared: PLAN_SYSTEM, own: personaBlock(ctx.agent), cacheOwn: cachePersona(ctx.agent) }, user: planPrompt(ctx) };
}
