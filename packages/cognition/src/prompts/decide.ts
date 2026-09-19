import type { Perception } from "@unwatched/protocol";
import { DECIDE_CORE, DECIDE_RULES as rules, DECIDE_TASK } from "./decide-compact.ts";
import { urgentNeeds, workIssue } from "../semantics/decision.ts";

/** Stable guidance supports choosing a destination as well as acting here. */
export const DECIDE_SYSTEM = [DECIDE_CORE, rules.property, rules.beliefs, rules.supply, rules.survival,
  "options lists supported action types, NOT currently valid actions or a complete allowlist. Check prerequisites in current state; the engine validates execution.",
  "Elsewhere you may build, trade, shape a workplace, join a voluntary institution, learn a procedure, help a shared garden, make a promise or visit the council. Travel first when the action needs another place.",
  DECIDE_TASK,
].join("\n");

/** Mechanics depend on perceived opportunities, never on a second copy of agent state.
 * These go after the cache boundary so changing location cannot invalidate the shared prefix. */
export function decideRules(p: Perception): string {
  const has = (...kinds: Perception["options"][number][]) => kinds.some(kind => p.options.includes(kind));
  const work = workIssue(p);
  const urgent = urgentNeeds(p);
  return [
    urgent.length > 0 && `- Urgent now: ${urgent.join(", ")}. Check an immediate remedy before optional activity; a skill or plan does not execute its steps.`,
    has("trade") && '- trade: buy adds the named item; sell removes a carried item for coins, NOT another item. Neither eats; use consumes carried food separately. Omit with for this shop. with can only be the current place ID or a present person; never a job ID, an invented keeper/stall or a remote shop. Intent must describe this immediate effect, not a later imagined meal.',
    has("work", "apply") && (p.place.site || p.place.community
      ? "- Site/garden work has its own prerequisites; it is not a wage shift or guaranteed income."
      : `- Wage work needs an assigned job, its place and shift hours, never Sunday. apply requests employment; vacancies are not jobs you hold.${work ? ` Now: ${work.message}` : ""}`),
    has("stock") && '- Own a place and stock it: sell an available item at your price.',
    has("make") && '- At your workplace, make a new item from materials on hand; the island learns the recipe and the boat pays its material value.',
    has("call") && '- Call your current place by a name; when three people use it, the island does. call ONLY names a place, never invokes an action; operations belong in action.kind.',
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
