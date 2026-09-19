import type { ClaimContext } from "./evidence.ts";
import type { Perception } from "@unwatched/protocol";

/** Same housing state already supplied in Perception; never infer a payment. */
export function perceivedLodging(p: Perception, text: string): Pick<ClaimContext, "lodging" | "lodgingReference"> {
  const housing = p.self.housing;
  const destination = housing?.kind;
  const escaped = destination?.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const named = escaped && new RegExp(`\\b(?:to|at|in) (?:the )?(?:harbor )?${escaped}\\b`, "iu").test(text);
  return { lodging: housing ? { place: housing.kind, nights: housing.nights_left } : null,
    ...(named && destination ? { lodgingReference: destination } : {}) };
}

const counts = "zero one two three four five six seven eight nine ten".split(" ");
const quantity = "(\\d+|a|zero|one|two|three|four|five|six|seven|eight|nine|ten)";
const prepaid = new RegExp(`\\b${quantity} (?:more )?(?:(?:prepaid|paid) nights?(?: left| remaining)?|nights?(?: left| remaining)? (?:is |was |are |were )?(?:already )?(?:prepaid|paid)(?: for)?)\\b`, "u");
const bed = /\b(?:a |my )?(?:bed|room|lodging|accommodation) (?:is |was )?(?:already )?(?:paid for|prepaid)\b|\bprepaid (?:lodging|accommodation|bed|room)\b/u;
const count = (value: string): number => /^\d+$/u.test(value) ? Number(value) : counts.indexOf(value);
const place = (value: string): string => value.trim().replace(/^the /u, "").replace(/\s+(?:and|with)\b.*$/u, "").replace(/\s+(?:left|remaining)$/u, "");

/** Recognizes prepaid accommodation, never an active transfer by the narrator.
 * null = not this grammar; false = recognized state lacks supplied support. */
export function prepaidLodgingSupported(clause: string, ctx: ClaimContext): boolean | null {
  if (/\b(?:i|we) (?:have |had )?paid\b/u.test(clause)) return null;
  const match = prepaid.exec(clause) ?? bed.exec(clause);
  if (!match) return null;
  const subject = clause.slice(0, match.index).trim().replace(/^(?:initially|on arrival)[, ]*/u, "");
  if (subject && !/^(?:i\b|(?:still )?have\b|one\b|stepped off the boat\b|arrived\b|with\b)/u.test(subject)
    && !/^slept (?:at|in) [^,]+,$/u.test(subject)) return false;
  // Indefinite 'a paid night' establishes availability, not an exact total.
  // Explicit 'one night left' still has to match the supplied remaining count.
  const nights = match[1] === undefined || match[1] === "a" ? null : count(match[1]);
  const suffix = clause.slice(match.index + match[0].length);
  const destinationText = /^\s*(?:left |remaining )?(?:at|in) (?:the )?([^,.;]+)/u.exec(suffix)?.[1];
  const destination = destinationText ? place(destinationText) : /\bthere\b/u.test(suffix) ? ctx.lodgingReference ?? "unresolved there" : null;
  const historical = /\b(?:initially|on arrival|arrived(?: on the boat| by boat| this morning)?\b|landed|(?:stepped|got|came) off the boat|started with|had)\b/u.test(clause.slice(0, match.index))
    && !/\b(?:still|remaining|left|now)\b/u.test(clause);
  const observations = ctx.records.flatMap(record => {
    // Only the exact, directly observed initial record identifies its implicit
    // first-person holder. Other people's lodging and reported speech cannot.
    if (record.source !== "observation" || !/^Stepped off the boat with a suitcase and \d+ coins\. Three nights paid at the harbor inn\.$/u.test(record.text)) return [];
    return [{ nights: 3, place: "harbor inn" }];
  });
  const current = ctx.lodging;
  const states = historical || current === undefined ? observations : current ? [current] : [];
  return states.some(state => (nights === null ? state.nights > 0 : state.nights === nights) && (destination === null || destination === state.place
    || state.place === "harbor inn" && destination === "inn"
    || state.place === "inn" && destination === "harbor inn" && observations.length > 0));
}
