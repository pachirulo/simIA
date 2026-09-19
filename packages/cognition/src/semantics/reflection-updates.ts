import type { ReflectContext } from "@unwatched/engine";
import type { Reflection } from "@unwatched/protocol";
import { reflectionUpdates } from "../context/reflection-updates.ts";
import type { SemanticIssue } from "./quality.ts";

/** Validate structural claims separately from prose. Subjective goals remain
 * subjective; only a known construction counter proves its physical completion. */
export function reflectionUpdateIssue(out: Reflection, ctx: ReflectContext): SemanticIssue | null {
  const supplied = reflectionUpdates(ctx);
  for (const [i, project] of (out.projects ?? []).entries()) {
    if (project.done !== true) continue;
    const evidence = supplied.projects.find(item => item.title.toLowerCase() === project.title.trim().toLowerCase());
    if (evidence && evidence.completion !== "complete") return { code: "project_completion_unverified", path: `projects[${i}].done`,
      message: `The supplied construction record for ${JSON.stringify(evidence.title)} at ${evidence.construction.site} is ${evidence.construction.labor}/${evidence.construction.needed} labor (${evidence.completion}). Keep done false or omit it. A reached plan, promise or self-reported progress cannot finish construction. Preserve the project rather than renaming it to bypass this check.` };
  }
  const eventIds = new Set(supplied.events.map(event => event.id));
  for (const [i, desire] of (out.desires ?? []).entries()) {
    const current = supplied.desires.find(item => desire.id !== undefined ? item.id === desire.id : item.title.toLowerCase() === desire.title.toLowerCase());
    if (desire.id !== undefined && !current) return { code: "desire_unknown_id", path: `desires[${i}].id`,
      message: "Use an exact ID from the supplied persistent desires. For a genuinely new want, omit id. Do not replace an existing desire merely to avoid fixing its ID." };
    if (!current && desire.state !== "active") return { code: "desire_new_state", path: `desires[${i}].state`,
      message: "A new desire starts active. To reconsider or fulfill an existing desire, identify that supplied desire. Omit an unsupported update instead of inventing a prior history." };
    const missing = desire.evidence.filter(id => !eventIds.has(id));
    if (missing.length) return { code: "desire_unknown_evidence", path: `desires[${i}].evidence`,
      message: `These IDs are not supplied personal experience records: ${[...new Set(missing)].join(", ")}. Cite only relevant supplied personal events or omit this update. Do not invent an event ID or use another person's private experience. A conversation may motivate a subjective change but does not prove its claims happened.` };
  }
  return null;
}
