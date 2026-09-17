/** Every kind of call the brain makes, by the name the ops room sees it under. */
export type CallKind = "action_proposal" | "dialogue" | "reflection" | "day_plan" | "persona_depth" | "digest" | "child" | "paper" | "judgement" | "life";
export type Slot = "routine" | "stakes" | "reflect";
export type Models = Record<Slot, string>;
/** Which of the three minds each call goes to when nothing else is said. decide and plan step up to stakes at tier 2; a quiet reflection steps down to stakes. */
export const SLOT_OF: Record<CallKind, Slot> = { action_proposal: "routine", dialogue: "routine", judgement: "routine", day_plan: "routine", digest: "stakes", child: "stakes", reflection: "reflect", persona_depth: "reflect", paper: "reflect", life: "reflect" };
/** The one chooser: the town's models, the per-citizen override (the daily ceiling, a Patron's upgrade), and the slot the call wants. */
export function chooseModel(kind: CallKind, models: Models, override: Partial<Models> | null | undefined, slot: Slot = SLOT_OF[kind]): { model: string; slot: Slot } {
  return { model: override?.[slot] ?? models[slot], slot };
}

