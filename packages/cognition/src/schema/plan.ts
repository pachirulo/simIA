import { DayPlan } from "@unwatched/protocol";
import { z } from "zod";

/** New LLM plans must state an activity. Legacy persisted plans remain readable
 * by the unchanged canonical schema, where do is optional for compatibility. */
export const CognitiveDayPlan = DayPlan.extend({
  steps: z.array(DayPlan.shape.steps.element.required({ do: true })).min(1).max(6),
});
