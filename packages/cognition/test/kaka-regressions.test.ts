import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionProposal, Dialogue, Reflection } from "@unwatched/protocol";
import { contexts } from "./fixtures.ts";
import { kakaRow, kakaReflection, kakaPerception } from "./fixtures/kaka.ts";
import { groundedClaimIssue } from "../src/semantics/evidence.ts";
import { reflectionEvidence } from "../src/context/reflection-evidence.ts";
import { reflectionIssue } from "../src/semantics/lifecycle.ts";
import { decisionIssue } from "../src/semantics/decision.ts";
import { dialogueIssue } from "../src/semantics/dialogue.ts";
import { buildReflectContext } from "../src/context/reflect.ts";
import { buildConverseContext } from "../src/context/converse.ts";
import { knownMayor } from "../src/semantics/continuity-claims.ts";
import { OpenRouterBrain, isFromFallback } from "../src/openrouter.ts";
import { decisionEvidence } from "../src/context/decision-evidence.ts";

afterEach(() => vi.unstubAllGlobals());
const reflection = (summary: string): Reflection => ({summary,insights:[],intentions:[],opinions:[],letter_to_owner:null});
function dialogueContext(call: string) {
  const data = kakaRow(call).context;
  if (!data.public || !data.system) throw Error("Missing public dialogue context");
  const c = contexts();
  for (const key of ["a","b"] as const) { c[key].id = data.public[key].id; c[key].persona.name = data.public[key].name; c[key].arrivedAt = 360; }
  c.converse.time = /day \d+ \d+:\d+/u.exec(data.system)?.[0] ?? "unknown";
  c.converse.aMemories = c.converse.bMemories = [];
  return c.converse;
}

describe("Kaka: selected real evidence and bounded counterfactuals", () => {
  it("recognizes both Rosa hiring and wage phrases with the receipts already in the request", () => {
    const ctx = kakaReflection("8896ff74"), claims = reflectionEvidence(ctx).claims;
    expect(claims.records.some(r=>r.id===107 && r.kind==="agent.hired")).toBe(true);
    expect(claims.records.some(r=>r.id===130 && r.kind==="agent.work")).toBe(true);
    for(const attempt of [1,2]) {
      const out = kakaRow("8896ff74",attempt).output as unknown as Reflection;
      expect(groundedClaimIssue(out.summary,"summary",claims)).toBeNull();
    }
    expect(groundedClaimIssue("I worked a shift, paid 9 coins.","summary",claims)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I worked a shift and paid 2 coins for lodging.","summary",claims)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I was hired as a cook at the bakery.","summary",claims)?.code).toBe("memory_unverified_outcome");
  });

  it("does not mistake English once for eleven; extra consumption still needs distinct receipts", () => {
    const claims = reflectionEvidence(kakaReflection("aeb4eadc")).claims;
    expect(claims.records.filter(r=>r.kind==="agent.eat").map(r=>r.id)).toEqual([81,139]);
    expect(groundedClaimIssue("I bought bread twice and ate once.","summary",claims)).toBeNull();
    expect(groundedClaimIssue("I ate bread eleven times.","summary",claims)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate bread three times.","summary",claims)?.code).toBe("memory_unverified_outcome");
    expect(groundedClaimIssue("I ate once.","summary",{...claims,records:claims.records.filter(r=>r.kind!=="agent.eat")})).not.toBeNull();
  });

  it("retains the missing-receipt diagnosis for Rosa's real soup purchase", () => {
    const p=kakaPerception("785ea9c7");
    expect(p.self.inventory).toContain("soup");
    expect(p.recent.some(s=>/bought soup/u.test(s))).toBe(false);
    expect(decisionIssue(ActionProposal.parse(kakaRow("785ea9c7").output),p,"Rosa Vidal")?.code).toBe("memory_unverified_outcome");
  });
  it("selects the existing purchase experience and supplies the same receipt to prompt and validator",async()=>{
    const p=kakaPerception("785ea9c7"),original=ActionProposal.parse(kakaRow("785ea9c7").output),a=contexts().a;
    a.id=p.agent_id;a.persona.name="Rosa Vidal";
    // Reconstructed from event 41 and the unchanged engine's recordPurchase path;
    // the original request exposes learned_food counts, not the private lesson array.
    a.foodLessons=[{place:"inn",item:"soup",evidence:[{t:780,cost:2,success:true,eventId:41}]}];
    const source=structuredClone(p),enriched=decisionEvidence(p,a);
    expect(enriched.recent.at(-1)).toContain("[event 41, minute 780, agent.trade]");
    expect(decisionEvidence(enriched,a).recent).toEqual(enriched.recent);
    expect(decisionIssue(original,enriched,a.persona.name)).toBeNull();
    expect(p).toEqual(source);
    const bodies:string[]=[];
    vi.stubGlobal("fetch",vi.fn(async(_url,init:RequestInit)=>{
      bodies.push(String(init.body));return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(original)}}]}));
    }));
    const out=await new OpenRouterBrain({apiKey:"test",allowFallback:false}).decide(p,a,1);
    expect(out).toEqual(original);expect(bodies).toHaveLength(1);expect(bodies[0]).toContain("[event 41, minute 780, agent.trade]");
  });
  it("never selects failed, future, stale or unreferenced purchase attempts",()=>{
    const p=kakaPerception("785ea9c7"),a=contexts().a;a.id=p.agent_id;
    a.foodLessons=[{place:"inn",item:"soup",evidence:[{t:780,cost:2,success:false,eventId:41},{t:780,cost:2,success:true},{t:900,cost:2,success:true,eventId:99},{t:-2000,cost:2,success:true,eventId:1}]}];
    expect(decisionEvidence(p,a)).toBe(p);
    a.foodLessons[0]!.evidence=[{t:780,cost:2,success:true,eventId:41}];a.id="another-person";
    expect(decisionEvidence(p,a)).toBe(p);
  });
  it("reads a receipt recorded by the unchanged engine, not a fabricated lesson",()=>{
    const {town,a}=contexts();a.location="inn";a.coins=10;
    expect(town.apply(a,{kind:"trade",buy:"soup"},"purchase regression")).toBe(true);
    const receipt=town.events.filter(e=>e.kind==="agent.trade" && e.actors.includes(a.id)).at(-1)!;
    expect(a.foodLessons?.find(l=>l.item==="soup")?.evidence.at(-1)).toMatchObject({success:true,eventId:receipt.id,t:receipt.t,cost:2});
    const p=decisionEvidence(town.perceive(a),a);
    expect(p.recent.some(s=>s.startsWith(`[event ${receipt.id},`))).toBe(true);
    expect(decisionIssue({action:{kind:"wait"},remember:["I bought soup for 2 coins."]},p,a.persona.name)).toBeNull();
    expect(decisionIssue({action:{kind:"wait"},remember:["I ate soup."]},p,a.persona.name)?.code).toBe("memory_unverified_outcome");
  });

  it.each(["I have one night paid at the inn.","I have one paid night left at the inn.","I still have 39 coins and one paid night left at the inn.","I have a bed paid for at the inn.","I have prepaid lodging."])("accepts current prepaid state across reflection fields: %s", text => {
    const ctx=kakaReflection("236613e4");
    const out={...reflection(text),intentions:[text],projects:[{title:"Lodging",progress:text}],self:{summary:text}};
    expect(reflectionIssue(out,ctx)).toBeNull();
  });
  it.each(["I have two paid nights left at the inn.","I have one paid night left at the mill.","Petar has one night paid at the inn.","I paid for lodging.","I have 39 coins left after paying for my lodging."])("rejects wrong state, actor or active payment: %s",text=>{
    expect(reflectionIssue(reflection(text),kakaReflection("236613e4"))?.code).toBe("memory_unverified_outcome");
  });
  it("uses the perception housing in intent and remember, including resolved there",()=>{
    const p=kakaPerception("0019286f");
    expect(p.self.housing).toMatchObject({kind:"inn",nights_left:2});
    for(const text of ["Return to the inn. I have a bed paid for there.","Return to the inn. I have two nights left paid there."]){
      const out:ActionProposal={action:{kind:"move",to:"inn"},intent:text,remember:[text]};
      expect(decisionIssue(out,p,"Rosa Vidal")).toBeNull();
    }
    expect(decisionIssue({action:{kind:"move",to:"inn"},intent:"I have a bed paid for there.",remember:[]},p,"Rosa Vidal")?.code).toBe("intent_unverified_premise");
    expect(decisionIssue({action:{kind:"move",to:"inn"},intent:"Return to the inn. I paid for lodging.",remember:[]},p,"Rosa Vidal")?.code).toBe("intent_unverified_premise");
  });
  it("distinguishes initial lodging from current nights for the captured elided arrival",()=>{
    const claims=reflectionEvidence(kakaReflection("0467d158")).claims;
    expect(groundedClaimIssue("Arrived this morning with 40 coins and three nights paid at the inn.","summary",claims)).toBeNull();
    expect(groundedClaimIssue("I have three nights paid at the inn.","summary",claims)).not.toBeNull();
  });
  it("rejects Petar's actual repair drift after paying, without inventing a payment receipt",()=>{
    const ctx=kakaReflection("236613e4"),out=kakaRow("236613e4",2).output as unknown as Reflection;
    expect(reflectionIssue(out,ctx)?.message).toContain("after paying for my lodging");
  });
  it("recognizes work counters in projects without counting the wage as shifts",()=>{
    const ctx=kakaReflection("236613e4");
    expect(reflectionIssue({...reflection("I have one paid night left at the inn."),projects:[{title:"Bakery",progress:"Worked one shift; no conversation with the baker yet."}]},ctx)).toBeNull();
    expect(reflectionIssue({...reflection("A quiet day."),projects:[{title:"Bakery",progress:"Worked three shifts."}]},ctx)?.code).toBe("memory_unverified_outcome");
  });
  it("resolves bought bread twice and ate both without converting purchases to meals",()=>{
    const claims=reflectionEvidence(kakaReflection("0467d158")).claims;
    const text="Bought bread twice, once at the market and once at the inn, and ate both.";
    expect(groundedClaimIssue(text,"summary",claims)).toBeNull();
    expect(groundedClaimIssue(text,"summary",{...claims,records:claims.records.filter(r=>r.kind!=="agent.eat")})).not.toBeNull();
    expect(groundedClaimIssue("I ate and slept at the inn.","summary",reflectionEvidence(kakaReflection("1a348e90")).claims)).toBeNull();
  });

  it("compares denials to actual destinations, work and conversations",()=>{
    const ctx=kakaReflection("8896ff74");
    for(const text of ["I did not go to the chandlery.","I did not work.","I did not meet Ivana."])
      expect(reflectionIssue(reflection(text),ctx)?.code,text).toBe("memory_contradicted_denial");
    for(const text of ["I did not go to the quarry.","I did not go to the inn for work.","I did not meet Ivana formally."])
      expect(reflectionIssue(reflection(text),ctx),text).toBeNull();
    const petar=kakaReflection("236613e4");
    expect(reflectionIssue(reflection("I did not get to the mill in the morning."),petar)).toBeNull();
  });
  it("does not use a route destination as proof of arriving, or another actor's work",()=>{
    const ctx=kakaReflection("8896ff74");
    ctx.actionEvidence=[];ctx.dayMemories=[];ctx.keyMemories=[];
    ctx.desireEvidence=[{id:1,t:2000,day:2,kind:"agent.move",actors:[ctx.agent.id],importance:.1,text:"Rosa Vidal went to the market square, on the way to the quarry."}];
    expect(reflectionIssue(reflection("I did not go to the quarry."),ctx)).toBeNull();
    ctx.desireEvidence=[{id:2,t:2000,day:2,kind:"agent.work",actors:["ag_2"],importance:.1,text:"Petar Ilić was paid 3 for a shift as cook."}];
    expect(reflectionIssue(reflection("I did not work."),ctx)).toBeNull();
  });
  it("retrieves only the personal role report omitted by the original day-two selection",()=>{
    const ctx=kakaReflection("aeb4eadc");
    expect(knownMayor(reflectionEvidence(ctx).assertions)).toBeNull();
    ctx.agent.memory.push({t:600,kind:"rumor",importance:.5,text:"Rosa Vidal is mayor now."},{t:2200,kind:"obs",importance:1,text:"PRIVATE_UNRELATED"});
    const prompt=buildReflectContext(ctx).user;
    expect(prompt).toContain("Rosa Vidal is mayor now."); expect(prompt).not.toContain("PRIVATE_UNRELATED");
    expect(knownMayor(reflectionEvidence(ctx).assertions)).toEqual({name:"Rosa Vidal",certainty:"reported"});
    for(const text of ["I did not meet the mayor.","Ask Rosa Vidal for advice on meeting the mayor."])
      expect(reflectionIssue(reflection(text),ctx)?.code).toBe("known_role_identity_lost");
    expect(reflectionIssue(reflection("I did not meet the mayor formally."),ctx)).toBeNull();
    expect(reflectionIssue(reflection("Rosa is reportedly mayor; I have not confirmed her office."),ctx)).toBeNull();
  });

  it("checks public arrival chronology while preserving deliberately identified lying",()=>{
    const ctx=dialogueContext("4497e5c2"),out=Dialogue.parse(kakaRow("4497e5c2",2).output);
    expect(buildConverseContext(ctx).user).toContain('"elapsedMinutes":120');
    expect(dialogueIssue(out,ctx)?.code).toBe("dialogue_autobiography_conflict");
    const lie=structuredClone(out); lie.outcome.a_remember="I lied about spending the night in the common room.";lie.outcome.b_remember="I lied about having been here for days.";
    expect(dialogueIssue(lie,ctx)).toBeNull();
    const later={...ctx,time:"day 5 08:00"};
    expect(dialogueIssue(out,later)).toBeNull();
  });
  it("treats the storm statement as unverified speech, not proven personal experience",()=>{
    const ctx=dialogueContext("29c6b303"),out=Dialogue.parse(kakaRow("29c6b303").output);
    expect(dialogueIssue(out,ctx)).toBeNull();
  });
  it("detects the quarry's implied prior visit without letting a later rumor hide it",()=>{
    const ctx=dialogueContext("0929617c"),out=Dialogue.parse(kakaRow("0929617c").output);
    expect(dialogueIssue(out,ctx)).toMatchObject({code:"dialogue_autobiography_conflict",path:"lines[3].text"});
    out.lines[3]!.text="I heard the quarry road is muddy. I might visit when it dries.";
    expect(dialogueIssue(out,ctx)).toBeNull();
  });
  it("accepts the real same-response question; given wind is not a physical transfer",()=>{
    const ctx=dialogueContext("206bd64f"),out=Dialogue.parse(kakaRow("206bd64f").output);
    expect(out.lines[2]!.text).toBe("You think the market'll be quiet tomorrow then?");
    expect(dialogueIssue(out,ctx)).toBeNull();
    const falseDelivery=structuredClone(out);falseDelivery.outcome.a_remember="I gave Ivana bread.";
    expect(dialogueIssue(falseDelivery,ctx)?.code).toBe("memory_unverified_outcome");
    falseDelivery.outcome.a_remember="I was given wind chimes.";
    expect(dialogueIssue(falseDelivery,ctx)?.code).toBe("memory_unverified_outcome");
  });

  it("gives trade repair a concrete correction, validates it and never fills buy silently",async()=>{
    const p=kakaPerception("8331a21a"),original=ActionProposal.parse(kakaRow("8331a21a").output);
    const requests:{messages:{content:unknown}[]}[]=[];
    const repaired={...original,action:{...original.action,buy:"bread"}};
    vi.stubGlobal("fetch",vi.fn(async (_url,init:RequestInit)=>{
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(requests.length===1?original:repaired)}}]}));
    }));
    const a=contexts().a;a.id="ag_2";a.persona.name="Petar Ilić";
    const out=await new OpenRouterBrain({apiKey:"test",allowFallback:false}).decide(p,a,1);
    expect(out.action).toEqual(repaired.action);expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)!.content).toContain('"buy":"bread"');
    expect(decisionIssue(original,p,a.persona.name)?.code).toBe("trade_item_intent_mismatch");
  });
  it("keeps fallback justified when the provider repeats the original bare trade",async()=>{
    const p=kakaPerception("8331a21a"),original=kakaRow("8331a21a").output,a=contexts().a;
    a.persona.name="Petar Ilić";
    const fetch=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(original)}}]})));
    vi.stubGlobal("fetch",fetch);
    const out=await new OpenRouterBrain({apiKey:"test"}).decide(p,a,1);
    expect(fetch).toHaveBeenCalledTimes(2);expect(isFromFallback(out)).toBe(true);
  });
});
