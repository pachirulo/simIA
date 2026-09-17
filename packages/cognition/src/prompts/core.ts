import { WORLD_OPENING, WORLD_RULES as rules, WORLD_VOICE } from "./world-rules.ts";

/** Shared epistemic, agency and voice rules. No catalogue of executable actions. */
export const CORE = [WORLD_OPENING, rules.grounding, rules.sources, rules.agency,
  rules.physics, rules.law, rules.knowledge, rules.coins, rules.letters, WORLD_VOICE].join("\n");
