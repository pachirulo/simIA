import type { Perception } from "@unwatched/protocol";
import { CORE } from "./core.ts";
import { WORLD_RULES as rules } from "./world-rules.ts";

/** Stable guidance supports choosing a destination as well as acting here. */
export const DECIDE_SYSTEM = [CORE, rules.property, rules.beliefs, rules.supply, rules.survival,
  "Choose one supported action. Perception.options describes local opportunities; the engine validates the result.",
  "Elsewhere you may build, trade, shape a workplace, join a voluntary institution, learn a procedure, help a shared garden, make a promise or visit the council. Travel first when the action needs another place.",
].join("\n");

/** Mechanics depend on perceived opportunities, never on a second copy of agent state.
 * These go after the cache boundary so changing location cannot invalidate the shared prefix. */
export function decideRules(p: Perception): string {
  const has = (...kinds: Perception["options"][number][]) => kinds.some(kind => p.options.includes(kind));
  return [
    has("stock", "make", "call", "propose", "vote") && rules.shaping,
    has("decorate") && rules.decoration,
    (has("start_project", "contribute_project", "withdraw_project") || p.place.community || p.town?.projects?.length) && rules.garden,
    p.town?.projects?.length && rules.volunteering,
    (has("found_institution", "join_institution", "leave_institution") || p.place.institution) && rules.institutions,
    (has("propose_skill", "test_skill", "practice_skill", "share_skill", "repair") || p.self.skills?.length) && rules.skills,
    (has("teach") || p.self.food_advice?.length) && rules.teaching,
    p.self.learned_food?.length && rules.foodLearning,
    has("do") && rules.freeDeed,
    (has("build") || p.place.site || p.self.projects?.some(project => project.construction)) && rules.construction,
    has("build") && rules.building,
    (has("say") || p.nearby.length) && rules.speech,
    (has("search", "write") || p.self.knows?.length) && rules.secrets,
    p.time.occasion && rules.calendar,
    (p.time.weather === "storm" || p.place.broken) && rules.fire,
    p.time.gathering && rules.gatherings,
    (has("propose", "vote", "accuse", "fund") || p.place.council) && rules.council,
    p.self.family && rules.family,
    (has("hire", "lend", "lodge", "leave") || p.self.debts?.length) && rules.households,
    // Deal actions are valid in Action but missing from ActionKind/options. Keep their guidance.
    (p.nearby.length || p.self.deals?.length || p.place.site) && rules.deals,
  ].filter((rule): rule is string => typeof rule === "string").join("\n");
}
