import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Dialogue, type Reflection } from "@unwatched/protocol";
import { kakadosRow, kakadosReflection, kakadosPerception } from "./fixtures/kakados.ts";
import { contexts } from "./fixtures.ts";
import { decisionIssue, tradeIssue } from "../src/semantics/decision.ts";
import { intentIssue } from "../src/semantics/intent.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { groundedClaimIssue, observedRecords, physicalEvidence } from "../src/semantics/evidence.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { normalizeReflection, reflectionSchema } from "../src/schema/reflection.ts";
import { normalizeOptionalStrings } from "../src/schema/normalize.ts";
import { OpenRouterProvider } from "../src/provider/openrouter.ts";
import { OpenRouterLogger } from "../src/provider/logging.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { sourceAssertions } from "../src/semantics/sources.ts";

afterEach(() => vi.unstubAllGlobals());
const reflection = (summary: string): Reflection => ({ summary, insights: [], opinions: [], intentions: [], letter_to_owner: null });
const claims = (call: string) => reflectionEvidence(kakadosReflection(call)).claims;
const proposal = (call: string, attempt = 1) => ActionProposal.parse(normalizeOptionalStrings(kakadosRow(call, attempt).output, ActionProposal));
const response = (out: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(out) } }] }));

describe("Kakados: captured evidence, without a new provider simulation", () => {
  it("rejects the real progressive two-product intent even if one buy field is filled", () => {
    const out = proposal("519a23a8"), p = kakadosPerception("519a23a8");
    expect(out.action).toEqual({ kind: "trade", with: "market" });
    expect(tradeIssue(out, p)).toMatchObject({ code: "trade_item_intent_mismatch", path: "action.buy" });
    expect(tradeIssue({ ...out, action: { kind: "trade", buy: "bread" } }, p)?.message).toContain("multiple products");
    expect(tradeIssue({ ...out, action: { kind: "trade", buy: "bread" }, intent: "I am buying bread now. I'll buy fish later." }, p)).toBeNull();
  });

  it("requires buy for the real causal bread intent; soup is a derived counterfactual", () => {
    const out = proposal("0faf0550"), p = kakadosPerception("0faf0550");
    expect(out.intent).toContain("so I buy a bread");
    expect(tradeIssue(out, p)?.code).toBe("trade_item_intent_mismatch");
    expect(tradeIssue({ ...out, action: { kind: "trade", buy: "bread" } }, p)).toBeNull();
    const soup = { ...out, intent: "I am buying soup at the inn." };
    expect(tradeIssue(soup, p)?.message).toContain('Set action.buy to "soup"');
    expect(tradeIssue({ ...soup, action: { kind: "trade", buy: "bread" } }, p)?.code).toBe("trade_item_intent_mismatch");
    expect(tradeIssue({ ...soup, action: { kind: "trade", buy: "soup" } }, p)).toBeNull();
    for (const intent of ["I might buy soup.", 'Ivana said "I am buying soup".', "I want to ask about soup."])
      expect(tradeIssue({ ...out, intent }, p)).toBeNull();
  });

  it("sends an exact trade field repair and validates the returned command", async () => {
    const out = proposal("0faf0550"), p = kakadosPerception("0faf0550");
    const fixed = { ...out, action: { ...out.action, buy: "bread" } };
    const requests: { messages: { content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body))); return response(requests.length === 1 ? out : fixed);
    }));
    const provider = new OpenRouterProvider({ apiKey: "test", logGeneration: false });
    expect(await provider.call("action_proposal", "test", "routine", { shared: "rules" }, "state", ActionProposal, 1000, "ag_1", o => decisionIssue(o, p, "Rosa Vidal"))).toEqual(fixed);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain('"buy":"bread"');
  });

  it.each([
    ["3e821e89", 85, "Started the day getting hired as help at the inn"],
    ["77fc940d", 105, "Worked a full shift at the bakery and got paid 3 coins"],
    ["22e96db5", 106, "Worked the morning shift at Ilić's bakery for 3 coins"],
  ] as const)("recognizes the selected hiring/wage receipt in %s", (call, eventId, text) => {
    const evidence = claims(call);
    expect(evidence.records.some(r => r.id === eventId)).toBe(true);
    expect(groundedClaimIssue(text, "summary", evidence)).toBeNull();
    expect(groundedClaimIssue(text, "summary", { ...evidence, records: evidence.records.filter(r => !["agent.hired", "agent.work"].includes(r.kind ?? "") && !/^I got work as /u.test(r.text)) })).not.toBeNull();
  });

  it("checks actual work, actor, amount and workplace; arrival is not a work receipt", () => {
    const evidence = claims("22e96db5");
    for (const text of ["Worked the morning shift at the inn for 3 coins", "Worked the morning shift at Ilić's bakery for 9 coins", "Petar Ilić worked the morning shift at the bakery for 3 coins", "I paid 3 coins for a shift."])
      expect(groundedClaimIssue(text, "summary", evidence), text).not.toBeNull();
    expect(groundedClaimIssue("Worked the morning shift at Ilić's bakery for 3 coins", "summary", claims("2403ad74"))).not.toBeNull();
  });

  it("grounds employer-paid-me wording only in an actual wage receipt at that workplace", () => {
    const evidence = claims("77fc940d");
    expect(groundedClaimIssue("The bakery paid me fairly for a day's work.", "insight", evidence)).toBeNull();
    expect(groundedClaimIssue("The bakery paid me 3 coins.", "insight", evidence)).toBeNull();
    for (const text of ["The inn paid me 3 coins.", "The bakery paid me 9 coins.", "Petar paid me 3 coins."])
      expect(groundedClaimIssue(text, "insight", evidence), text).not.toBeNull();
    expect(groundedClaimIssue("The bakery paid me 3 coins.", "insight", claims("7cd1d78e"))).not.toBeNull();
  });

  it("expands the real movement plus passive hiring without inventing a named employer", () => {
    const text = "I went straight to the market and then to Ilić's bakery, where they took me on as cook for 3 coins a shift.";
    const evidence = claims("7cd1d78e");
    expect(groundedClaimIssue(text, "summary", evidence)).toBeNull();
    expect(groundedClaimIssue(text, "summary", { ...evidence, records: evidence.records.filter(r => r.id !== 12) })).not.toBeNull();
    expect(groundedClaimIssue(text.replace("cook", "clerk"), "summary", evidence)).not.toBeNull();
    expect(groundedClaimIssue(text.replace("3 coins", "9 coins"), "summary", evidence)).not.toBeNull();
  });

  it("counts two loaves using distinct purchase AND consumption receipts", () => {
    const evidence = claims("2403ad74"), text = "Bought and ate two loaves of bread.";
    expect(groundedClaimIssue(text, "summary", evidence)).toBeNull();
    for (const kind of ["agent.trade", "agent.eat"]) {
      const one = evidence.records.find(r => r.kind === kind)!;
      const fewer = evidence.records.filter(r => r.kind !== kind).concat(one, one);
      expect(groundedClaimIssue(text, "summary", { ...evidence, records: fewer })).not.toBeNull();
    }
    expect(groundedClaimIssue(text.replace("bread", "rye bread"), "summary", evidence)).not.toBeNull();
  });

  it("finds Ivana's eating event in history but not in her captured decision evidence", () => {
    const p = kakadosPerception("1afd4c75"), records = observedRecords(p.recent);
    expect(records.some(r => r.id === 39 && r.kind === "agent.trade")).toBe(true);
    expect(records.some(r => r.kind === "agent.eat")).toBe(false);
    expect(kakadosReflection("2403ad74").desireEvidence?.find(e => e.id === 43)).toMatchObject({ t: 780, kind: "agent.eat", actors: ["ag_3"], text: "Ivana Horvat ate bread." });
    expect(decisionIssue(proposal("1afd4c75"), p, "Ivana Horvat")?.code).toBe("memory_unverified_outcome");
    const evidence = { records, selfNames: ["Ivana Horvat"] };
    expect(groundedClaimIssue("I bought bread.", "remember", evidence)).toBeNull();
    expect(groundedClaimIssue("I ate bread.", "remember", evidence)).not.toBeNull();
    // Inventory/hunger changes are not receipts or item-identity evidence.
    p.self.inventory.push("bread");
    expect(decisionIssue(proposal("1afd4c75"), p, "Ivana Horvat")?.code).toBe("memory_unverified_outcome");
  });

  it("accepts the actual repaired indefinite prepaid claim with three nights remaining", () => {
    const p = kakadosPerception("1afd4c75");
    expect(p.self.housing?.nights_left).toBe(3);
    expect(proposal("1afd4c75", 2).remember.join(" ")).toContain("a paid night at the inn remaining");
    expect(decisionIssue(proposal("1afd4c75", 2), p, "Ivana Horvat")).toBeNull();
  });

  it.each([1, 3])("uses the same indefinite prepaid state in all fields with %s nights", nights => {
    const text = "I have a paid night at the inn remaining.", p = kakadosPerception("1afd4c75");
    p.self.housing!.nights_left = nights;
    expect(decisionIssue({ action: { kind: "move", to: "inn" }, intent: text, remember: [text] }, p, "Ivana Horvat")).toBeNull();
    const ctx = kakadosReflection("22e96db5"); ctx.agent.home!.nightsPaid = nights;
    expect(reflectionIssue({ ...reflection(text), intentions: [text], projects: [{ title: "Rest", progress: text }] }, ctx)).toBeNull();
  });

  it("keeps exact counts, destinations and personal payment separate from prepaid availability", () => {
    const ctx = kakadosReflection("22e96db5");
    expect(reflectionIssue(reflection("I have one prepaid night left at the inn."), ctx)).toBeNull();
    for (const text of ["I have two prepaid nights left at the inn.", "I have a paid night at the mill remaining.", "I paid for a night.", "I have 39 coins left after paying for lodging."])
      expect(reflectionIssue(reflection(text), ctx), text).not.toBeNull();
    ctx.agent.home!.nightsPaid = 0;
    expect(reflectionIssue(reflection("I have a paid night at the inn remaining."), ctx)).not.toBeNull();
  });

  it("recognizes the captured implicit first-person lodging totals without assigning another person's lodging", () => {
    expect(groundedClaimIssue("Still have 39 coins and one paid night at the inn.", "summary", claims("77fc940d"))).toBeNull();
    expect(groundedClaimIssue("Slept at the harbor inn, two nights left paid.", "summary", claims("2403ad74"))).toBeNull();
    expect(groundedClaimIssue("Petar slept at the harbor inn, two nights left paid.", "summary", claims("2403ad74"))).not.toBeNull();
  });

  it("recognizes the real move-first intent while preserving its separate missing-receipt rejection", () => {
    const out = proposal("4b4f3127", 2), p = kakadosPerception("4b4f3127");
    expect(out.action).toEqual({ kind: "move", to: "market" });
    expect(intentIssue(out)).toBeNull();
    expect(decisionIssue(out, p, "Ivana Horvat")?.code).toBe("memory_unverified_outcome");
    expect(decisionIssue({ ...out, remember: [] }, p, "Ivana Horvat")).toBeNull();
    expect(intentIssue({ ...out, action: { kind: "trade", buy: "bread" } })?.code).toBe("intent_action_mismatch");
    expect(intentIssue({ ...out, intent: "I'll buy bread right now. I'll move later." })?.code).toBe("intent_action_mismatch");
  });

  it("treats greetings as social speech without excusing an accompanying physical transfer", () => {
    const ctx = kakadosReflection("3e821e89"), evidence = reflectionEvidence(ctx).claims;
    expect(reflectionIssue(normalizeReflection(kakadosRow("3e821e89", 2).output) as Reflection, ctx)).toBeNull();
    expect(groundedClaimIssue("We only exchanged greetings.", "summary", evidence)).toBeNull();
    for (const text of ["We exchanged greetings and bread.", "We exchanged greetings and gave Ivana bread.", "I exchanged bread for fish."])
      expect(groundedClaimIssue(text, "summary", evidence)).not.toBeNull();
  });

  it("does not turn a shop's possessive name or a hire receipt into proof Petar hired Ivana", () => {
    const ctx = kakadosReflection("22e96db5"), evidence = reflectionEvidence(ctx).claims;
    expect(reflectionIssue(normalizeReflection(kakadosRow("22e96db5", 2).output) as Reflection, ctx)?.message).toContain("He gave me work");
    expect(groundedClaimIssue("Petar Ilić gave me work at the bakery.", "opinion", evidence)).not.toBeNull();
    expect(groundedClaimIssue("He gave me work at the bakery.", "opinion", claims("2403ad74"))).not.toBeNull();
  });

  it.each([["7cd1d78e", "state"], ["77fc940d", "id"]])("retains the actual repair schema rejection in %s", (call, field) => {
    const result = reflectionSchema(kakadosReflection(call!)).safeParse(normalizeReflection(kakadosRow(call!, 2).output));
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error.issues)).toContain(field);
  });

  it("repeats the contextual desire schema during semantic repair and can preserve valid structure", async () => {
    const ctx = kakadosReflection("7cd1d78e"), schema = reflectionSchema(ctx), original = schema.parse(normalizeOptionalStrings(normalizeReflection(kakadosRow("7cd1d78e").output), schema));
    const fixed = { ...reflection("I was hired as cook at the bakery."), desires: original.desires };
    const prompt = buildReflectContext(ctx);
    expect(prompt.user).not.toContain("state: active|set_aside|fulfilled");
    const requests: { messages: { content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body))); return response(requests.length === 1 ? original : fixed);
    }));
    const provider = new OpenRouterProvider({ apiKey: "test", logGeneration: false });
    expect(await provider.call("reflection", "test", "reflect", prompt.system, prompt.user, schema, 1800, ctx.agent.id, out => reflectionIssue(out, ctx))).toEqual(fixed);
    expect(requests).toHaveLength(2);
    const repair = requests[1]!.messages.at(-1)!.content;
    expect(repair).toContain('"const":"active"');
    expect(repair).toContain('"maxItems":2');
    expect(repair).toContain("Event IDs belong in evidence, never in id");
    expect(repair).toContain("Previous desire structure");
  });

  it("does not silently normalize an invalid desire repair or add a third attempt", async () => {
    const ctx = kakadosReflection("7cd1d78e"), schema = reflectionSchema(ctx), prompt = buildReflectContext(ctx);
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => response(kakadosRow("7cd1d78e", ++calls).output)));
    const provider = new OpenRouterProvider({ apiKey: "test", logGeneration: false }), fallback = vi.fn(); provider.onFallback = fallback;
    expect(await provider.call("reflection", "test", "reflect", prompt.system, prompt.user, schema, 1800, ctx.agent.id, out => reflectionIssue(out, ctx))).toBeNull();
    expect(calls).toBe(2); expect(fallback.mock.calls[0]![0].reason).toMatch(/^schema:/u);
  });

  it.each(["1315b15b", "5c551d63", "5e9b2934"])("preserves attributed fictional speech in accepted dialogue %s", call => {
    const row = kakadosRow(call), data = row.context;
    if (!data.public || !data.system) throw Error("Missing dialogue capture");
    const ctx = contexts().converse;
    for (const side of ["a", "b"] as const) { ctx[side].id = data.public[side].id; ctx[side].persona.name = data.public[side].name; ctx[side].arrivedAt = 360; }
    ctx.time = /day \d+ \d+:\d+/u.exec(data.system)?.[0] ?? "unknown"; ctx.aMemories = ctx.bMemories = [];
    const out = Dialogue.parse(row.output);
    expect(dialogueIssue(out, ctx)).toBeNull();
    const assertions = sourceAssertions(out.lines.map((l, i) => ({ ref: `line[${i}]`, text: `[reported speech] ${l.speaker} said: "${l.text}"` })));
    expect(physicalEvidence(assertions)).toEqual([]);
    expect(claims("22e96db5").records.some(r => /shutters|smithy|flooded/u.test(r.text))).toBe(false);
  });

  it("logs optional self normalization without calling it a rejection or an exhausted retry", () => {
    const lines: string[] = [], logger = new OpenRouterLogger("test", line => lines.push(line), { logContent: false, logGeneration: false });
    logger.emit("validation", { callId: "test", agentId: "ag_1", kind: "reflection", model: "test", slot: "reflect" }, { status: "normalized", fields: ["self"], reason: "null optional self means no identity update" });
    expect(lines.join("\n")).toContain("normalized optional fields");
    expect(lines.join("\n")).not.toMatch(/rejected|no retries/u);
  });

  it("characterizes unchanged lodging consumption per awake-to-sleep transition, even on the same day", () => {
    const { town, a } = contexts(); a.location = "inn";
    const day = town.day, coins = a.coins;
    expect(a.home!.nightsPaid).toBe(3);
    expect(town.apply(a, { kind: "sleep" }, "lodging characterization")).toBe(true);
    expect(a.home!.nightsPaid).toBe(2);
    town.apply(a, { kind: "sleep" }, "already asleep"); expect(a.home!.nightsPaid).toBe(2);
    a.asleep = false; // Controlled second transition, not a reconstructed wake event.
    town.apply(a, { kind: "sleep" }, "second sleep on the same day");
    expect(a.home!.nightsPaid).toBe(1); expect(town.day).toBe(day); expect(a.coins).toBe(coins);
    expect(town.events.filter(e => e.kind === "agent.rent")).toHaveLength(0);
  });
});
