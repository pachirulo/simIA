import type { SemanticIssue } from "./quality.ts";
import { sourceAssertions, type SourceAssertion } from "./sources.ts";
import { prepaidLodgingSupported } from "./lodging.ts";

export const fold = (text: string): string => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const numbers: Record<string, string> = Object.fromEntries([
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
].flatMap(list => list.split(" ").map((word, index) => [word, String(index)])));
Object.assign(numbers, { thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90" });
const STOP = new Set("a and at by for from here i in is it me my of on that the to he have has had was been today just already after said told rumor heard cost costs coins when if some more".split(" "));
/** Lexical anchors are diagnostic, not an equivalence proof. No world catalogue. */
export function anchors(text: string): string[] {
  return [...new Set((fold(text).match(/[\p{L}\p{N}_]+/gu) ?? []).map(t => numbers[t] ?? t).filter(t => !STOP.has(t) && (t.length > 2 || /^\d+$/u.test(t))))];
}
export function overlap(a: string, b: string): number {
  const left = anchors(a), right = new Set(anchors(b));
  return left.filter(t => right.has(t)).length;
}
export const uncertain = (s: string): boolean => /\b(?:if|when|until|unless|might|maybe|believe|suspect|said|told|rumor|promised)\b/u.test(fold(s));

export function conditionIssue(text: string, path: string, sources: string[]): SemanticIssue | null {
  const conditional = /\b(?:if|when|until|unless|pending|condition)\b/u;
  const paymentPromise = /\b(?:(?:agreed|promised)\s+to\s+pay|(?:will|i'll)\s+pay)\b/u;
  for (const clause of fold(text).split(/[.;!?]/u)) {
    if (!paymentPromise.test(clause) || conditional.test(clause) || /\b(?:not|never|no)\b/u.test(clause)) continue;
    const matching = sources.some(source => fold(source).split(/[.;!?]/u).some(part => conditional.test(part) && paymentPromise.test(part) && overlap(clause, part) >= 2));
    if (matching) return { code: "agreement_condition_lost", path, message: "The matching payment promise was conditional. Preserve its delivery/resource condition; do not summarize it as an unconditional obligation or confirmed payment." };
  }
  return null;
}

export interface EvidenceRecord { text: string; source: "observation" | "event" | "speech"; id?: number; kind?: string; speaker?: string; time?: number }
export interface ClaimContext { records: EvidenceRecord[]; selfNames: string[]; places?: { id: string; name: string }[]; debts?: { to: string; coins: number }[] | undefined; lodging?: { place: string; nights: number } | null; lodgingReference?: string; since?: number; until?: number }

export function observedRecords(records: string[]): EvidenceRecord[] {
  return physicalEvidence(sourceAssertions(records.map((text, i) => ({ ref: `records[${i}]`, text }))));
}

export function physicalEvidence(assertions: readonly SourceAssertion[]): EvidenceRecord[] {
  return assertions.flatMap(a => a.certainty === "observed"
    && (a.source.kind === "event" || a.source.kind === "observation")
    ? [{ text: a.assertion, source: a.source.kind,
      ...(a.source.eventId === null ? {} : { id: a.source.eventId }),
      ...(a.source.eventKind === null ? {} : { kind: a.source.eventKind }),
      ...(a.recordedAt === null ? {} : { time: a.recordedAt }) }] : []);
}

const outcomes = [
  { kind: "agent.trade", verb: /\b(?:bought|purchased)\b/u },
  { kind: "agent.trade", verb: /\bsold\b/u },
  { kind: "agent.trade", verb: /\b(?:traded|exchanged|swapped)\b/u },
  { kind: "agent.eat", verb: /\b(?:ate|eaten)\b|\bhunger (?:eased|satisfied)\b|\b(?:easing|eased|satisfying) (?:my |the )?hunger\b/u },
  { kind: "agent.give", verb: /\b(?:gave|given|delivered)\b|(?<![-\p{L}])handed\b/u },
  // Internal receipt projection, not a new world event or persisted operation.
  { kind: "receipt", verb: /\breceived\b/u },
  // Carrying is not a transfer. A give receipt only supports the explicit
  // recipient form ("brought me X"), projected below with its direction intact.
  { kind: "carrying", verb: /\bbrought\b/u },
  { kind: "agent.take", verb: /\btook\b/u },
  { kind: "agent.work", verb: /\b(?:worked|earned|(?:got|was|been) paid)\b/u },
  { kind: "agent.hired", verb: /\b(?:hired|taken on)\b/u },
  { kind: "building.repaired", verb: /\brepaired\b/u },
  { kind: "agent.move", verb: /\b(?:arrived|moved|walked (?:to|from)|set out from)\b/u },
  { kind: "payment", verb: /\b(?:paid|after paying)\b/u },
] as const;

type Outcome = typeof outcomes[number];
export interface PhysicalClaim {
  operation: string;
  objects: string[][];
  minimumOccurrences: number;
  amounts: string[];
  townArrival?: boolean;
}

const countPattern = new RegExp(`\\b(twice|several times|a few times|(?:\\d+|${Object.keys(numbers).join("|")}) times|once)\\b`, "u");
const noObject = /\b(?:today|earlier|this morning|this afternoon|this evening|tonight|several times|twice|once|\w+ times|my shift|a shift)\b/gu;

/** Only a bounded grammar of physical claims is recognized. Frequency is not
 * price; objects coordinated with 'and' each need evidence. No world catalogue. */
function physicalClaim(s: string, outcome: Outcome, ctx: ClaimContext): PhysicalClaim {
  const verb = outcome.verb.exec(s)!;
  const tail = s.slice(verb.index + verb[0].length);
  const frequency = countPattern.exec(tail)?.[1];
  let minimumOccurrences = frequency === "twice" || frequency === "several times" || frequency === "a few times" ? 2
    : frequency === "once" ? 1 : frequency ? Number(numbers[frequency.split(" ")[0]!] ?? frequency.split(" ")[0]) || 1 : 1;
  const monetary = tail.match(/\bfor\s+(\d+|\w+)(?:\s+coins?)?\b/u)?.[1]
    ?? (/earned|paid/u.test(verb[0]) ? tail.match(/^\s+(\d+|\w+)/u)?.[1] : undefined);
  const amount = monetary === undefined ? undefined : numbers[monetary] ?? (/^\d+$/u.test(monetary) ? monetary : undefined);
  let objectPhrase = tail.replace(noObject, "").split(/\bin exchange for\b|\b(?:at|for|with|from)\b|,/u)[0]!;
  if (outcome.kind === "agent.work") {
    objectPhrase = objectPhrase.replace(/^\s*(?:a|the|my) (?:(?:full|morning|afternoon|evening) )?shift\b/u, "");
    const shifts = /^\s*(one|two|three|\d+) shifts?\b/u.exec(objectPhrase);
    if (shifts) { minimumOccurrences = Number(numbers[shifts[1]!] ?? shifts[1]); objectPhrase = objectPhrase.slice(shifts[0].length); }
  }
  // Purpose does not become a completed meal or part of the purchased item.
  if (outcome.kind === "agent.trade") objectPhrase = objectPhrase.split(/\s+to (?:eat|keep|carry|share)\b/u)[0]!;
  let townArrival = false;
  if (outcome.kind === "agent.move") {
    // A generic arrival on the island is evidenced by agent.arrive. A named
    // destination still needs its own receipt, including for 'arrived at X'.
    objectPhrase = tail.replace(noObject, "").split(",")[0]!.trim().split(/\s+to\s+(?=look|see|ask|buy|eat|check)/u)[0]!;
    townArrival = /^(?:(?:in|to|at|on) (?:the )?(?:town|island))$/u.test(objectPhrase);
    objectPhrase = townArrival ? "" : objectPhrase.replace(/^(?:(?:at|to|in|on|off)\s+)+/u, "");
    // Lodging is a separate state assertion, checked below against its own
    // evidence. It is neither the destination nor an arrival possession.
    objectPhrase = objectPhrase.replace(/\s+and\s+(?:\d+|one|two|three|four|five) nights? (?:already )?paid\b.*$/u, "");
  }
  if (outcome.kind === "agent.work" && /earned|paid/u.test(verb[0])) objectPhrase = "";
  objectPhrase = objectPhrase.replace(/^\s*as\s+/u, "");
  if (outcome.kind === "agent.trade" || outcome.kind === "agent.eat") {
    const loaves = /^\s*(one|two|three|\d+) loaves? of bread\s*$/u.exec(objectPhrase);
    if (loaves) { minimumOccurrences = Math.max(minimumOccurrences, Number(numbers[loaves[1]!] ?? loaves[1])); objectPhrase = "bread"; }
    const portions = /^\s*(two|three|\d+) bowls? of soup\s*$/u.exec(objectPhrase);
    if (portions) { minimumOccurrences = Math.max(minimumOccurrences, Number(numbers[portions[1]!] ?? portions[1])); objectPhrase = "soup"; }
    else objectPhrase = objectPhrase.replace(/^\s*(?:a |one )?bowl of soup\s*$/u, "soup");
  }
  const objects = objectPhrase.split(/\band\b/u).map(anchors);
  if (outcome.kind === "agent.hired" || outcome.kind === "agent.work") {
    const workplace = tail.match(/\bat\s+([^,.;!?]+)/u)?.[1];
    if (workplace) {
      const named = workplace.replace(noObject, "").split(/\s+for\s+/u)[0]!.trim();
      const place = ctx.places?.find(p => fold(p.name) === named || fold(p.name).replace(/^the /u, "") === named.replace(/^the /u, ""));
      objects.push(anchors(place?.id ?? named));
    }
  }
  if (outcome.kind === "agent.take" || outcome.kind === "receipt") {
    const from = tail.match(/\bfrom\s+([^,.;!?]+)/u)?.[1];
    if (from) objects.push(anchors(from.replace(noObject, "")));
  }
  if (outcome.kind === "agent.trade" && /traded|exchanged|swapped/u.test(verb[0])) {
    const partner = tail.match(/\bwith\s+([^,.;!?]+)/u)?.[1];
    if (partner) objects.push(anchors(partner.replace(noObject, "")));
    const returned = tail.match(/\bfor\s+(.+?)(?:\s+with\b|$)/u)?.[1];
    if (returned) objects.push(anchors(returned.replace(noObject, "")));
  }
  return { operation: outcome.kind, objects, minimumOccurrences, amounts: amount === undefined ? [] : [amount], ...(townArrival ? { townArrival } : {}) };
}

interface ClaimClause { text: string; tentative: boolean; subject?: string; afterPrevious?: boolean }
const denied = (s: string): boolean => /\b(?:no|not|never|not yet|tried|haven't|hasn't|hadn't|didn't|wasn't|weren't|couldn't|wouldn't|can't|don't|doesn't)\b/u.test(fold(s));
function claimClauses(text: string): ClaimClause[] {
  // The unnamed 'they' in this exact hiring construction does not identify a
  // hirer. Expand the two destinations and the narrator's passive employment;
  // each still needs a matching receipt, including the named workplace/rate.
  text = text.replace(/\bI went (?:straight )?to ([^,.;!?]+?) and then to ([^,.;!?]+), where they took me on as ([^.;!?]+)/giu,
    (_all, first: string, second: string, job: string) => {
      const [role, rate] = job.split(/\s+for\s+/iu);
      return `I moved to ${first} and then I moved to ${second}; I was hired as ${role} at ${second}${rate ? ` for ${rate}` : ""}`;
    });
  // These introductory words do not change the implicit narrator of a passive
  // hiring. Retain the role/place and check their actual hiring receipt.
  text = text.replace(/\b((?:I )?[Ss]tarted the day) getting hired\b/gu, "I was hired");
  // A reduced passive following work describes wages received, not money sent.
  // Preserve active "and paid" and every amount for the receipt check below.
  text = text.replace(/\b(worked (?:a |my |one )?shift), paid\b/giu, "$1 and was paid");
  // Adjacent, explicit repeated purchase resolves 'both' to the same named food;
  // its two consumption receipts are still checked independently below.
  text = text.replace(/\b((?:I )?bought (\w+) twice(?:, once at [^.;!?]+?)?,? and (?:I )?)ate both\b/giu,
    (_all, prefix: string, item: string) => `${prefix}ate ${item} twice`);
  // In "bought and ate bread" both verbs share the object; splitting at 'and'
  // first would erase what was bought and accept an unrelated purchase.
  // Only an adjacent explicit first-person antecedent. Purchases resolve the
  // nouns; they NEVER supply the consumption receipts checked afterwards.
  const referenced = text.replace(/\bI (?:bought|purchased) ([^.;!?]+?)([.;]|,? and)\s*(?:I )?ate (?:them )?both\b/giu,
    (all, objects: string, separator: string) => {
      const names = objects.split(/\s+(?:at|for|from)\s+/iu)[0]!.trim();
      const pair = /^[\p{L} ]+ and [\p{L} ]+$/u.test(names);
      const two = /^two bowls? of soup$/iu.test(names);
      return pair || two ? all.replace(/ate (?:them )?both\b/iu, `ate ${two ? "soup twice" : names}`) : all;
    });
  const expanded = referenced.replace(/\b(bought|purchased|ate)\s+(and)\s+(ate|bought)\s+([^.;!?]+)/giu,
    (_all, first: string, _join: string, second: string, object: string, offset: number, source: string) => {
      const subject = source.slice(0, offset).split(/[.;!?]/u).at(-1)!.trim();
      return `${first} ${object}; ${subject} ${second} ${object}`;
    });
  // Bounded finite clauses, not noun lists: 'bread and soup' stays together.
  // Search/talk verbs delimit an action but are not certified physical outcomes.
  const finite = "(?:(?:i|we|he|she|they|have|had|me|no|not|never|haven't|hasn't|didn't)\\s+)*(?:bought|purchased|traded|exchanged|swapped|ate|eaten|paid|gave|given|handed|delivered|received|brought|took|earned|worked|arrived|moved|hired|repaired|looked|searched|spoke|talked|offered|promised|still owe)\\b";
  const extraFinite = "(?:(?:i|he|she|they)\\s+)?(?:got (?:hired|taken on|paid)|was (?:taken on|hired|paid)|walked (?:to|from)|slept|saw|easing|still have|have|had)\\b";
  const boundary = new RegExp(`[.;!?]["”»]?|\\b(?:but|because|so)\\b|,?\\s*\\bthen\\s+(?=${finite}|${extraFinite})|,\\s*(?=${finite}|${extraFinite}|hunger|even (?:if|though)\\b)|\\band\\s+(?=${finite}|${extraFinite})`, "giu");
  const quotes = [...expanded.matchAll(/"[^"]*"|“[^”]*”|«[^»]*»/gu)].map(m => [m.index, m.index + m[0].length] as const);
  const parts: string[] = [], clauses: ClaimClause[] = [];
  let start = 0;
  for (const match of expanded.matchAll(boundary)) {
    if (quotes.some(([from, to]) => match.index > from && match.index + match[0].length < to)) continue;
    parts.push(expanded.slice(start, match.index), match[0]); start = match.index + match[0].length;
  }
  parts.push(expanded.slice(start));
  let reportScope = false, previous: ClaimClause | undefined;
  for (let i = 0; i < parts.length; i += 2) {
    // "Brought it like he said" asserts fulfillment. The trailing comparison
    // does not turn the main action into reported speech. Keep actual leading
    // attribution ("Petar said ...") and conditions in the normal scope rules.
    const text = parts[i]!.trim().replace(/\s+(?:like|as)\s+(?:(?:he|she|they|i|we)\s+)?(?:said|promised)(?:\s+(?:he|she|they|i|we)\s+would)?$/iu, ""), separator = parts[i - 1] ?? "";
    if (!text) continue;
    if (!separator || /^[.;!?]["”»]?$/u.test(separator)) { reportScope = false; previous = undefined; }
    const s = fold(text), explicitSubject = /^(?:i|we|he|she|they)\b/u.test(s);
    const causal = /\b(?:because|so)\b/iu.test(separator);
    const inheritedDenial = !!previous && !explicitSubject && !causal && !/\bbut\b/iu.test(separator) && denied(previous.text);
    reportScope ||= uncertain(text) || /["“”«»]/u.test(text);
    let subject: string | undefined;
    if (previous && !explicitSubject && !causal) {
      const firstVerb = Math.min(...outcomes.map(o => previous!.text.search(new RegExp(o.verb.source, "iu"))).filter(index => index >= 0));
      const prefix = Number.isFinite(firstVerb) ? previous.text.slice(0, firstVerb).trim().replace(/\s+(?:was|have|had|has)$/iu, "") : "";
      subject = previous.subject ?? (prefix || undefined);
    }
    previous = { text, tentative: reportScope || inheritedDenial, ...(subject ? { subject } : {}), ...(/\bthen\b/iu.test(separator) ? { afterPrevious: true } : {}) };
    clauses.push(previous);
  }
  return clauses;
}

function supportsOperation(record: EvidenceRecord, outcome: Outcome): boolean {
  const r = fold(record.text);
  if (outcome.kind === "payment" && /\b(?:was|got|been) paid\b/u.test(r)) return false;
  if (outcome.kind === "payment" && record.kind === "agent.give" && /\bgave\b.+\b\d+ coins\b/u.test(r)) return true;
  if (outcome.kind === "agent.work" && record.kind === "agent.work" && /\bwas paid\b/u.test(r)) return true;
  if (outcome.kind === "agent.move" && record.kind === "agent.move" && /\bwent to\b/u.test(r)) return true;
  if (!outcome.verb.test(r)) return false;
  return !record.kind || record.kind === outcome.kind || outcome.kind === "payment"
    || outcome.kind === "agent.move" && record.kind === "agent.arrive";
}

function witnessed(record: EvidenceRecord): boolean {
  return record.source !== "speech" && record.kind !== "action.rejected"
    && !/["“”«»]/u.test(record.text)
    && !/\b(?:said|told|tried to|promised|would|will|not|never|no)\b/u.test(fold(record.text));
}

/** Conservative checks of asserted outcomes; incomplete evidence is never failure.
 * Quoted/conditional/explicitly subjective claims remain claims. */
export function groundedClaimIssue(text: string, path: string, ctx: ClaimContext): SemanticIssue | null {
  let previousTimes: number[] = [];
  for (const part of claimClauses(text)) {
    const clause = part.text;
    let s = fold(clause).trim().replace(/^(?:today|earlier|this morning|since|just)[, ]+/u, "");
    if (!s || part.tentative || denied(s) || /^(?:nothing|none)\s+(?:(?:was|has been|had been)\s+)?(?:bought|purchased|eaten|paid|given|received|delivered|taken|repaired)\b/u.test(s)) continue;
    // Employer metonymy is bounded to an actual wage receipt at that workplace.
    // This never identifies a human owner or converts hiring into wages paid.
    const employer = /^the (.+?) paid me (.+)$/u.exec(s);
    if (employer) {
      const workplace = ctx.places?.find(p => fold(p.name).replace(/^the /u, "") === employer[1])?.id ?? employer[1]!;
      const paidHere = ctx.records.some(r => r.kind === "agent.work" && witnessed(r)
        && (/^I /u.test(r.text) || ctx.selfNames.some(name => fold(r.text).startsWith(fold(name) + " ")))
        && fold(r.text).includes(" was paid ")
        && fold(r.text).replace(/\.$/u, "").endsWith(` at the ${fold(workplace).replace(/^the /u, "")}`));
      if (paidHere) s = `i was paid ${employer[2]}`;
    }
    const prepaid = prepaidLodgingSupported(s, ctx);
    if (prepaid === false) return { code: "memory_unverified_outcome", path,
      message: "The stated prepaid nights/place do not match the supplied accommodation evidence. Distinguish initial lodging from nights currently remaining. Prepaid accommodation does not prove that you personally paid anyone." };
    const debt = /\b(?:owe|owed)\b/u.test(s) && /\b(?:coins?|debt|ten|\d+)\b/u.test(s);
    if (debt && !/\bwill\b|\b\w+'ll\b/u.test(s.slice(0, s.search(/\b(?:owe|owed)\b/u)))) {
      const amounts = anchors(s).filter(t => /^\d+$/u.test(t));
      const known = ctx.debts?.some(d => (s.includes(fold(d.to)) || s.includes(fold(d.to).split(" ")[0]!)) && (!amounts.length || amounts.includes(String(d.coins))));
      if (!known) return { code: "unverified_obligation", path, message: "No matching effective debt is supplied. Preserve the payment condition and pending delivery; a promise is not an existing debt. Do not infer delivery, obligation or payment from talk." };
    }
    for (const outcome of outcomes) {
      if (!outcome.verb.test(s)) continue;
      const beforeVerb = s.slice(0, s.search(outcome.verb));
      // Perfect futures and passive goals are not completed events. Restrict
      // this to the prefix of this clause so a later goal cannot hide a fact.
      if (/\bwill\b|\b\w+'ll\b/u.test(beforeVerb) || /\b(?:get|be|being)\s*$/u.test(beforeVerb)) continue;
      // Non-inventory meanings of receipt/delivery need their own source rules.
      if (outcome.kind === "receipt" && /\breceived\s+(?:(?:a|an|the|some|his|her|their)\s+)?(?:advice|help|news|support|permission|answer|reply|letter|message|compliment|(?:warm )?welcome)\b/u.test(s)) continue;
      if (outcome.kind === "agent.give" && /\bdelivered\s+(?:(?:a|an|the)\s+)?(?:speech|lecture|warning|message|promise)\b/u.test(s)) continue;
      if (outcome.kind === "agent.give" && (/\bgave (?:general )?answers?\b/u.test(s)
        || /\b(?:about|considering)\b.+\bgiven (?:the )?(?:wind|weather|circumstances|situation)$/u.test(s))) continue;
      if (outcome.kind === "agent.take" && /\btook (?:my|the|our) day\b/u.test(s)) continue;
      if (outcome.kind === "agent.give" && /\bhanded\s+(?:me\s+)?(?:the\s+)?(?:mayor's seat|town's trust|responsibility|authority)\b/u.test(s)) continue;
      if (outcome.kind === "agent.trade" && /\b(?:traded|exchanged|swapped)\s+(?:jokes|stories|words|glances|ideas|news|gossip)\b/u.test(s)) continue;
      if (outcome.kind === "agent.trade" && /\bexchanged greetings$/u.test(s)) continue;
      if (outcome.kind === "carrying" && /\bbrought\s+(?:up\b|(?:the )?matter\b|(?:me\s+)?(?:(?:some|good|bad|the)\s+)?(?:news|advice|comfort|joy|hope|trouble|luck)\b)/u.test(s)) continue;
      // 'Took' can describe accepting an object or an activity/idiom. Only the
      // bounded direct-object form is checked; it does not imply theft.
      if (outcome.kind === "agent.take" && /\btook\s+(?:(?:a|an|the|my|his|her|their|our)\s+)?(?:on|off|up|over|part|place|time|turn|shift|job|work|walk|stroll|look|break|rest|chance|risk|interest|care|advice|initiative|seat|step|steps|note|notes|stock|issue|charge|advantage|pride|courage|effort)\b/u.test(s)) continue;
      if (/\b(?:want|need|hope|plan|try) to\b/u.test(s.slice(0, s.search(outcome.verb)))) continue;
      if (outcome.kind === "payment" && /\bpaid (?:job|work|employment)\b|\b(?:got|was|been) paid\b/u.test(s)) continue;
      // Prepaid lodging is a state, not a claim that the speaker transferred money.
      if (outcome.kind === "payment") {
        if (prepaid === true) continue;
      }
      // Future project descriptions do not assert completed actions.
      if (/\b(?:will|want to|to)\s+have /u.test(beforeVerb)) continue;
      const claim = physicalClaim(s, outcome, ctx);
      let subject = (part.subject ? fold(part.subject) : s.slice(0, s.search(outcome.verb))).trim()
        .replace(/^(?:today|earlier|this morning)[, ]+/u, "").replace(/\s+(?:was|have|had|has)$/u, "");
      // An elided actor can leave only the passive auxiliary after clause splitting.
      if (/^(?:was|have|had)$/u.test(subject)) subject = "";
      if (outcome.kind === "agent.hired" && subject === "got") subject = "";
      if (/^(?:he|she|they|we|you|him|her|them)\b/u.test(subject)) return {
        code: "memory_unverified_outcome", path,
        message: `The actor in ${JSON.stringify(clause.trim().slice(0, 180))} is unresolved. Name the actor explicitly and check their receipt; do not substitute the narrator or infer identity from a convenient event.`,
      };
      const own = !subject || /^(?:i\b|me\b)/u.test(subject);
      const broughtToSelf = outcome.kind === "carrying" && /\bbrought me\b|\bto me\b/u.test(s);
      const candidates = ctx.records.map(record => {
        // The engine's selected initial observation has an implicit personal
        // subject. Project only that exact record, retaining source/time and no
        // new event ID, so it cannot add another witnessed arrival occurrence.
        if (outcome.kind === "agent.move" && record.source === "observation"
          && /^Stepped off the boat with a suitcase and \d+ coins\. Three nights paid at the harbor inn\.$/u.test(record.text)) {
          return { ...record, kind: "agent.arrive", text: record.text.split(".")[0]!.replace("Stepped off", "I arrived on") + "." };
        }
        if (outcome.kind === "agent.hired" && record.source === "observation" && /^I got work as /u.test(record.text) && witnessed(record)) {
          return { ...record, kind: "agent.hired", text: record.text.replace("I got work as", "I was hired as") };
        }
        if (broughtToSelf && witnessed(record) && (!record.kind || record.kind === "agent.give")
          && /\bgave\b/u.test(fold(record.text))) {
          return { ...record, kind: "carrying", text: record.text.replace(/\bgave\b/iu, "brought") };
        }
        // A give receipt can substantiate the named recipient taking an item.
        // Project its direction before subject matching; the giver cannot use
        // the same receipt as evidence of receiving it. Keep event identity.
        if ((outcome.kind !== "agent.take" && outcome.kind !== "receipt")
          || record.kind && record.kind !== "agent.give" || !witnessed(record)) return record;
        const r = fold(record.text), names = own ? [...ctx.selfNames, "me"] : [subject];
        for (const name of [...names].sort((a, b) => b.length - a.length)) {
          const marker = ` gave ${fold(name)} `, at = r.indexOf(marker);
          if (at >= 0) return { ...record, kind: outcome.kind, text: `${name === "me" ? "I" : name} ${outcome.kind === "receipt" ? "received" : "took"} ${r.slice(at + marker.length).replace(/[.]$/u, "")} from ${r.slice(0, at)}` };
        }
        return record;
      }).filter(record => {
        if (!witnessed(record)) return false;
        const r = fold(record.text);
        if (broughtToSelf && !/\bbrought me\b|\bto me\b/u.test(r)
          && !ctx.selfNames.some(name => r.includes(` brought ${fold(name)} `) || r.includes(` to ${fold(name)}.`))) return false;
        if (outcome.kind === "agent.give" && (/\b(?:gave|handed|delivered) me\b/u.test(s) || /\bto me\b/u.test(s))
          && !/\bgave me\b/u.test(r) && !ctx.selfNames.some(name => r.includes(` gave ${fold(name)} `))) return false;
        // Personal evidence can include another actor's visible deed. Match its
        // subject explicitly; "Pedro gave me bread" is not "I gave Pedro bread".
        const starts = (name: string) => r === fold(name) || r.startsWith(fold(name) + " ");
        if (own ? !/^i /u.test(r)
          && !ctx.selfNames.some(starts) : !starts(subject)) return false;
        // A priced meal needs BOTH consumption and a priced purchase of its
        // object by this actor. A price never turns the purchase into eating.
        const priceMatches = claim.amounts.every(n => anchors(r).includes(n)) || outcome.kind === "agent.eat"
          && claim.amounts.length > 0 && ctx.records.some(purchase => witnessed(purchase) && purchase.kind === "agent.trade"
            && /\bbought\b/u.test(fold(purchase.text))
            && (own ? ctx.selfNames.some(name => fold(purchase.text).startsWith(fold(name) + " ")) : fold(purchase.text).startsWith(subject + " "))
            && claim.amounts.every(n => anchors(purchase.text).includes(n))
            && claim.objects.every(object => object.every(t => anchors(purchase.text).includes(t))));
        return (!claim.townArrival || record.kind === "agent.arrive") && supportsOperation(record, outcome) && priceMatches;
      });
      const supported = claim.objects.every(object => {
        const matches = candidates.filter(record => {
          const receipt = record.kind === "agent.move" ? record.text.split(/,\s*on the way to\b/iu)[0]! : record.text;
          const available = anchors(receipt);
          // A bounded linguistic paraphrase, never a command/item-ID rewrite.
          // Keep qualifiers and quantities: meat/rye/two loaves cannot silently
          // become an unqualified single bread. Literal loaf evidence wins.
          return object.every(t => available.includes(t)
            || (t === "loaf" || t === "loaves") && available.includes("bread")
              && !ctx.records.some(other => /\b(?:loaf|loaves)\b/u.test(fold(other.text))));
        });
        if (claim.minimumOccurrences === 1) return matches.length > 0;
        // Observations may summarize the same event. Only distinct event records
        // can substantiate a frequency; duplicate evidence lists are not witnesses.
        const events = matches.filter(record => record.source === "event");
        const ids = new Set(events.map(record => record.id === undefined ? JSON.stringify([record.kind, record.time, record.text]) : `event:${record.id}`));
        return ids.size >= claim.minimumOccurrences;
      });
      if (!supported) return { code: "memory_unverified_outcome", path,
        message: `Unsupported physical claim: ${JSON.stringify(clause.trim().slice(0, 180))}. A proposal, schedule, quotation or state change alone is not a receipt. Keep the condition/uncertainty, cite what was actually observed, or omit this claim.` };
      const times = candidates.filter(record => claim.objects.every(object => object.every(t => anchors(record.text).includes(t)))).flatMap(record => record.time === undefined ? [] : [record.time]);
      if (part.afterPrevious && previousTimes.length && times.length && !times.some(time => previousTimes.some(previous => time >= previous))) return {
        code: "memory_event_order", path, message: "The supplied receipts put these events in the opposite order to 'then'. Preserve their recorded times or state the facts without inventing their sequence.",
      };
      previousTimes = times;
      // A give receipt records one direction only. Even a reciprocal gift does
      // not allocate these transfers to a bargain. Retain separate observations
      // and qualify the claimed exchange instead of inventing that causal link.
      const counterItem = s.match(/\bfor (?:the|a|an) ([^,.;!?]+)$/u)?.[1];
      // Plain 'for' may express a purpose (for the journey). Treat its object
      // as a possible counter-item only when a supplied gift receipt names it;
      // that receipt still does not establish the bargain linking the gifts.
      const knownCounterItem = counterItem && ctx.records.some(record => witnessed(record)
        && (!record.kind || record.kind === "agent.give") && /\bgave\b/u.test(fold(record.text))
        && fold(record.text).trim().replace(/[.!?]$/u, "").endsWith(` ${counterItem}`));
      if ((outcome.kind === "agent.give" || broughtToSelf) && (/\bin exchange for\s+\S/u.test(s) || knownCounterItem)) return {
        code: "exchange_unverified", path,
        message: "A delivery is supported, but its claimed exchange is not established by the supplied receipts. Separate what each person gave from the unverified bargain; reciprocal gifts do not prove a completed barter or payment condition.",
      };
    }
  }
  return null;
}
