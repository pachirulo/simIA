import { CORE } from "./core.ts";
import { WORLD_RULES as rules } from "./world-rules.ts";

/** Planning needs constraints and opportunities, not the syntax of every minute action. */
export const PLAN_SYSTEM = [CORE, rules.property, rules.calendar, rules.fire, rules.gatherings,
  rules.council, rules.supply, rules.survival, rules.family, rules.households,
  "A building needs paid land and materials and recorded mornings of work; talking or planning cannot finish it. Paid construction help needs an accepted promise, actual work and settlement with the builder.",
  "Shared gardens are voluntary: pooled coins, real planks and work precede growth and harvest. Keep enough for food and shelter. Public proposals may be visited, helped, ignored or left.",
  "You may shape a shop's stock, make things from supplies, decorate a suitable place, found or join a voluntary institution, or learn, practice and share procedures. Learning or promising is not proof of success. A charter does not control its members.",
].join("\n");
