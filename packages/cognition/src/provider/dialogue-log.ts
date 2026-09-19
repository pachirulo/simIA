import type { TownEvent } from "@unwatched/protocol";

interface SpokenLine { speakerId: string; speaker: string; text: string }
type NameOf = (id: string) => string | undefined;

/** Read committed world speech, not LLM proposals, memories or interpretations. */
export function spokenDialogue(event: TownEvent, nameOf: NameOf): SpokenLine[] {
  if (event.kind === "conversation") {
    const lines: unknown = event.payload?.lines;
    if (!Array.isArray(lines)) return [];
    return lines.flatMap((line: unknown) => {
      if (!line || typeof line !== "object" || !("speaker" in line) || !("text" in line)
        || typeof line.speaker !== "string" || typeof line.text !== "string" || !event.actors.includes(line.speaker)) return [];
      return [{ speakerId: line.speaker, speaker: nameOf(line.speaker) ?? line.speaker, text: line.text }];
    });
  }
  if (event.kind !== "agent.say" || !event.actors[0]) return [];
  // agent.say also covers approaching someone, writing and nicknaming a place.
  // Only the engine's spoken-text envelope is an utterance; retain inner quotes.
  const spoken = /^(.+?): “([\s\S]*)”$/u.exec(event.text);
  if (!spoken) return [];
  const speakerId = event.actors[0], speaker = nameOf(speakerId) ?? speakerId;
  return [{ speakerId, speaker, text: spoken[2]! }];
}

export function logDialogue(event: TownEvent, nameOf: NameOf, log: (line: string) => void): void {
  try {
    const dialogue = spokenDialogue(event, nameOf);
    if (dialogue.length) log(`dialogue ${JSON.stringify({ eventId: event.id, minute: event.t, kind: event.kind, dialogue })}`);
  } catch { /* Diagnostics must never interrupt event delivery or persistence. */ }
}
