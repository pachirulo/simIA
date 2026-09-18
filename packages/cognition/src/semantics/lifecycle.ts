import type { DayPlan, Reflection } from "@unwatched/protocol";
import type { PlanContext } from "@unwatched/engine";
import { memorySystemIssue } from "./decision.ts";
import { normalize, type SemanticIssue } from "./quality.ts";

export function planIssue(plan: DayPlan, ctx: PlanContext): SemanticIssue | null {
  const places = new Set(ctx.places.flatMap(place => [place.id, place.name]).map(normalize));
  for (const [index, step] of plan.steps.entries()) {
    if (step.place && !places.has(normalize(step.place))) return { code: "plan_unknown_place", path: `steps[${index}].place`, message: "Use a place from the supplied island places, or null. A place field is not a route description." };
    if (!step.do?.trim()) return { code: "plan_missing_activity", path: `steps[${index}].do`, message: "Describe the intended activity in do; an hour and destination alone do not say what you plan to do." };
  }
  return null;
}

export function reflectionIssue(reflection: Reflection): SemanticIssue | null {
  const entries: [string, string][] = [["summary", reflection.summary],
    ...reflection.insights.map((text, i): [string, string] => [`insights[${i}]`, text]),
    ...(reflection.beliefs ?? []).map((belief, i): [string, string] => [`beliefs[${i}].belief`, belief.belief])];
  for (const [path, text] of entries) { const issue = memorySystemIssue(text, path); if (issue) return issue; }
  return null;
}
