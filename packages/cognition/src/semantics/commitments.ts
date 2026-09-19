import { anchors, fold } from "./evidence.ts";
import type { SourceAssertion } from "./sources.ts";

interface SupportedStage { status: "unknown" | "observed" | "ambiguous"; evidence: string[] }
export interface CommitmentTrace {
  proposal: { payer: string; payee: string; coins: number; condition: string; item: string | null; evidence: string[] };
  agreement: SupportedStage;
  delivery: SupportedStage;
  /** A transfer is not a receipt allocating that money to this agreement. */
  payment: SupportedStage;
  outstanding: "unknown";
}
interface Candidate { source: SourceAssertion; payer: string; payee: string; coins: number; condition: string; item: string | null }
const group = (a: SourceAssertion): string => a.source.ref.split("#utterance")[0]!;
const ordinal = (a: SourceAssertion): number => Number(a.source.ref.split("#utterance")[1]);
const clean = (s: string): string => fold(s).trim().replace(/[.!]$/u, "");
const unknown = (): SupportedStage => ({ status: "unknown", evidence: [] });

/** Resolve explicit names only; ambiguous first names and pronouns stay unknown. */
function person(value: string, people: readonly string[]): string | null {
  const key = clean(value);
  const exact = people.filter(name => clean(name) === key);
  if (exact.length === 1) return exact[0]!;
  const short = people.filter(name => clean(name).split(" ")[0] === key);
  return short.length === 1 ? short[0]! : null;
}

function candidate(source: SourceAssertion, people: readonly string[]): Candidate | null {
  if (!source.speaker || source.certainty !== "reported" || !source.condition
    || !["speech", "event", "observation"].includes(source.source.kind)) return null;
  const s = clean(source.assertion);
  const match = /^(?:i will pay|i'll pay) (.+?) (\d+|\w+) coins? (?:when|if) (.+)$/u.exec(s);
  const target = match?.[1], amount = match?.[2], clause = match?.[3];
  if (!target || !amount || !clause) return null;
  const payee = person(target, people), coins = Number(anchors(amount)[0]);
  if (!payee || payee === source.speaker || !Number.isSafeInteger(coins) || coins <= 0) return null;
  // Only a direct delivery to this payer is matched. Other conditions are kept,
  // but never simplified (e.g. delivery AND obtaining flour, time or quality).
  const delivery = /^(.+?) delivers (?:me )?(.+)$/u.exec(clause);
  const actor = delivery?.[1], object = delivery?.[2];
  const actorKnown = actor ? person(actor, people) === payee : false;
  // 'he/she' can have another referent: retain the condition without resolving it.
  const item = object && actorKnown && !anchors(object).some(t => /^\d+$/u.test(t))
    && !/\b(?:and|or|if|when|before|after|only|unless)\b|[,;]|\d/u.test(object)
    ? object.replace(/^the /u, "") : null;
  return { source, payer: source.speaker, payee, coins, condition: source.condition.text, item };
}

function after(record: SourceAssertion, source: SourceAssertion): boolean {
  if (record.recordedAt === null || source.recordedAt === null) return false;
  if (record.recordedAt !== source.recordedAt) return record.recordedAt > source.recordedAt;
  return record.source.eventId !== null && source.source.eventId !== null && record.source.eventId > source.source.eventId;
}

function transfer(record: SourceAssertion, from: string, to: string, object: string): boolean {
  return record.certainty === "observed" && record.source.eventKind === "agent.give"
    && clean(record.assertion) === `${clean(from)} gave ${clean(to)} ${object}`;
}

/** Bounded evidence matching, not a contract engine. The full source survives
 * unsupported wording. No inferred balance, persistent ledger or global lookup.
 * Each observed stage has source references; missing or ambiguous links stay so. */
export function commitmentTraces(assertions: readonly SourceAssertion[], people: readonly string[]): CommitmentTrace[] {
  const candidates = assertions.flatMap(a => { const c = candidate(a, people); return c ? [c] : []; });
  // Prefer the event copy of a transcript: IDs establish ordering within a tick.
  const unique = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = JSON.stringify([c.payer, c.source.recordedAt, c.source.assertion]);
    const prior = unique.get(key);
    if (!prior || prior.source.source.eventId === null && c.source.source.eventId !== null) unique.set(key, c);
  }
  const offers = [...unique.values()];
  const events = [...new Map(assertions.filter(a => a.source.eventId !== null && a.certainty === "observed")
    .map(a => [a.source.eventId!, a])).values()];
  return offers.map(c => {
    const competing = offers.filter(other => other.payer === c.payer && other.payee === c.payee && other.item === c.item);
    const inConversation = candidates.filter(other => group(other.source) === group(c.source));
    const accepted = inConversation.length === 1 ? assertions.filter(a => group(a) === group(c.source)
      && a.speaker === c.payee && a.certainty === "reported" && ordinal(a) > ordinal(c.source)
      && /^(?:agreed|deal|i agree)$/u.test(clean(a.assertion))) : [];
    const agreement: SupportedStage = accepted.length ? { status: "observed", evidence: accepted.map(a => a.source.ref) } : unknown();
    const delivered = c.item && accepted.length ? events.filter(e => after(e, c.source) && transfer(e, c.payee, c.payer, c.item!)) : [];
    const delivery: SupportedStage = delivered.length ? { status: competing.length === 1 && delivered.length === 1 ? "observed" : "ambiguous", evidence: delivered.map(e => e.source.ref) } : unknown();
    const payments = delivery.status === "observed" ? events.filter(e => after(e, delivered[0]!) && transfer(e, c.payer, c.payee, `${c.coins} coins`)) : [];
    return {
      proposal: { payer: c.payer, payee: c.payee, coins: c.coins, condition: c.condition, item: c.item, evidence: [c.source.source.ref] },
      agreement, delivery,
      payment: payments.length ? { status: payments.length === 1 ? "observed" : "ambiguous", evidence: payments.map(e => e.source.ref) } : unknown(),
      outstanding: "unknown",
    };
  });
}
