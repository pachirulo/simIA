import type { Town } from "@unwatched/engine";

/** The server's existing primer, shared with headless to avoid different worlds
 * in the two prompts. Rebuild when called; do not cache mutable world state. */
export function worldPrimerOf(t: Pick<Town, "places" | "pack" | "name">): string {
  const places = [...t.places.values()].filter(p => p.kind !== "plot").map(p => `${p.id}: ${p.name}${p.sells.length ? `, sells ${p.sells.map(s => s.item).join(", ")}` : ""}${p.beds ? `, beds ${p.beds.price ? `${p.beds.price} coins a night` : "free"}` : ""}`);
  const jobs = t.pack.jobs.map(j => `${j.title} at ${j.place}, ${j.wage} coins a shift, ${j.hours[0]} to ${j.hours[1]}`);
  const feasts = t.pack.feasts.map(f => `${f.name} on the ${f.day}th of month ${f.month} at ${f.place}`);
  return `The island of ${t.name}:\nPlaces: ${places.join("; ")}.\nWork: ${jobs.join("; ")}.\nThe boat comes each morning; the six o'clock cart moves grain to the mill, flour to the bakery, bread and fish and apples to the market. Sundays have no shifts, Saturday is market day, the first of the month is council day.\nFeasts: ${feasts.join("; ")}.\nPlots for sale are listed in the morning plan; the council sells them.`;
}
