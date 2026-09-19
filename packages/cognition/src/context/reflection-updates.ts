import { desiresForMind, type ReflectContext } from "@unwatched/engine";

/** One selected view for the prompt and validator. No hidden memories or world
 * lookup; engine construction counters are distinct from self-reported done. */
export function reflectionUpdates(ctx: ReflectContext) {
  const projects = ctx.projects.flatMap(project => {
    const matches = ctx.agent.projects.filter(candidate => candidate.title.toLowerCase() === project.title.toLowerCase());
    const construction = matches.length === 1 ? matches[0]!.construction : undefined;
    if (!construction) return [];
    const valid = Number.isInteger(construction.labor) && construction.labor >= 0
      && Number.isInteger(construction.needed) && construction.needed > 0;
    return [{ title: project.title, construction: { site: construction.site, labor: construction.labor, needed: construction.needed },
      completion: valid ? construction.labor >= construction.needed ? "complete" as const : "incomplete" as const : "unknown" as const }];
  });
  return { projects, desires: desiresForMind(ctx.agent.desires),
    events: (ctx.desireEvidence ?? []).filter(event => event.actors.includes(ctx.agent.id)) };
}
