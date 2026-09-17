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
    has("stock") && '- Own a place and stock it: sell an available item at your price.',
    has("make") && '- At your workplace, make a new item from materials on hand; the island learns the recipe and the boat pays its material value.',
    has("call") && '- Call your current place by a name; when three people use it, the island does.',
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
    (has("search") || p.self.knows?.length) && rules.secrets,
    p.time.occasion && rules.calendar,
    (p.time.weather === "storm" || p.place.broken) && rules.fire,
    p.time.gathering && rules.gatherings,
    (p.place.kind === "civic" || p.place.council || has("accuse", "fund")) && rules.council,
    (p.self.family?.partner || p.self.family?.children.length) && rules.family,
    has("hire") && '- Hire workers at a place you own; an empty till cannot pay wages.',
    (has("lend") || p.self.debts?.length) && '- Lent coins are remembered by both parties and become due on the agreed day.',
    has("lodge") && '- You may lodge someone in a house you own.',
    has("leave") && '- Leave by boat from the harbor permanently, or for a destination in boats_to, carrying your belongings and memories.',
    // Deal actions are valid in Action but missing from ActionKind/options. Keep their guidance.
    (p.nearby.length || p.self.deals?.length || p.place.site) && rules.deals,
  ].filter((rule): rule is string => typeof rule === "string").join("\n");
}
