import type { DayPlan, Reflection } from "@unwatched/protocol";
import type { PlanContext, ReflectContext } from "@unwatched/engine";
import { groundedClaimIssue, conditionIssue } from "./evidence.ts";
import { reflectionEvidence } from "../context/reflection-evidence.ts";
import { memorySystemIssue } from "./decision.ts";
import { normalize, type SemanticIssue } from "./quality.ts";
import { reflectionUpdateIssue } from "./reflection-updates.ts";
import { attributionIssue } from "./attribution.ts";
import { institutionIssue, observedMayor } from "./institution.ts";
import { sourceAssertions } from "./sources.ts";
import { denialIssue, encounters, roleIdentityIssue } from "./continuity-claims.ts";

export function planIssue(plan: DayPlan, ctx: PlanContext): SemanticIssue | null {
  const mayor = observedMayor(sourceAssertions(ctx.keyMemories.map((text, i) => ({ ref: `keyMemories[${i}]`, text }))), [ctx.agent.persona.name]);
  for (const text of [plan.mood, ...plan.goals, ...plan.steps.map(s => s.do ?? "")]) {
    const invalid = institutionIssue(text, "plan", mayor); if (invalid) return invalid;
  }
  const places = new Set(ctx.places.flatMap(place => [place.id, place.name]).map(normalize));
  for (const [index, step] of plan.steps.entries()) {
    if (step.place && !places.has(normalize(step.place))) return { code: "plan_unknown_place", path: `steps[${index}].place`, message: "Use a place from the supplied island places, or null. A place field is not a route description." };
    if (!step.do?.trim()) return { code: "plan_missing_activity", path: `steps[${index}].do`, message: "Describe the intended activity in do; an hour and destination alone do not say what you plan to do." };
  }
  return null;
}

export function reflectionIssue(reflection: Reflection, ctx?: ReflectContext): SemanticIssue | null {
  const entries: [string, string][] = [["summary", reflection.summary],
    ...reflection.insights.map((text, i): [string, string] => [`insights[${i}]`, text]),
    ...(reflection.beliefs ?? []).map((belief, i): [string, string] => [`beliefs[${i}].belief`, belief.belief])];
  for (const [path, text] of entries) { const issue = memorySystemIssue(text, path); if (issue) return issue; }
  if (ctx) {
    const issues = [reflectionUpdateIssue(reflection, ctx)].filter((issue): issue is SemanticIssue => issue !== null);
    const frame = reflectionEvidence(ctx), evidence = frame.claims;
    const mayor = observedMayor(frame.assertions, evidence.selfNames);
    const meetings = encounters(frame.assertions);
    const visit = (value: unknown, path: string): void => {
      if (issues.length >= 6) return;
      if (typeof value === "string") {
        const issue = memorySystemIssue(value, path) ?? institutionIssue(value, path, mayor)
          ?? roleIdentityIssue(value, path, frame.assertions, meetings) ?? denialIssue(value, path, evidence, meetings)
          ?? attributionIssue(value, path, frame.assertions, evidence.selfNames) ?? conditionIssue(value, path, [...ctx.dayMemories, ...ctx.keyMemories]) ?? groundedClaimIssue(value, path, evidence);
        if (issue) issues.push(issue);
      }
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    };
    visit(reflection, "");
    const first = issues[0];
    return first ? { ...first, message: [first.message, ...issues.slice(1).map(issue => `Also fix ${issue.path} (${issue.code}): ${issue.message}`)].join("\n") } : null;
  }
  return null;
}

export function safeReflectionFallback(out: Reflection, ctx: ReflectContext): Reflection {
  return reflectionIssue(out, ctx) ? { summary: "I do not have enough evidence to claim new outcomes.", insights: [], opinions: [], intentions: [], letter_to_owner: null } : out;
}
