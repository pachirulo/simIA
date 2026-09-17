import type { AgentState } from "@unwatched/engine";

export function personaBlock(a: AgentState): string {
  const p = a.persona;
  return `You are ${p.name}, ${p.age}, from ${p.origin}. ${p.summary}
You want: ${p.want}
You fear: ${p.fear}
A secret nobody on the island knows: ${p.secret}
With strangers you are: ${p.strangers}
When advised you: ${p.advice}
Temperament (0 to 1): warmth ${p.traits.warmth.toFixed(2)}, pride ${p.traits.pride.toFixed(2)}, caution ${p.traits.caution.toFixed(2)}, honesty ${p.traits.honesty.toFixed(2)}, ambition ${p.traits.ambition.toFixed(2)}.${p.cameBecause ? `\nWhy you came: ${p.cameBecause}` : ""}${p.skill ? `\nWhat you are good at: ${p.skill}` : ""}${p.flaw ? `\nWhat costs you: ${p.flaw}` : ""}${p.habit ? `\nA habit others notice: ${p.habit}` : ""}${p.voice?.length ? `\nThe way you talk, for example: ${p.voice.map((v) => `"${v}"`).join(" ")}` : ""}
You came to the island on day ${Math.floor(a.arrivedAt / 1440) + 1}.`;
}

