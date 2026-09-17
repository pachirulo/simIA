import { actionProposalSchema } from "./schema/action.ts";
import { buildDecideContext } from "./context/decide.ts";
import { buildPlanContext } from "./context/plan.ts";
import { buildConverseContext } from "./context/converse.ts";
import { buildReflectContext } from "./context/reflect.ts";
import { OpenRouterProvider, type ProviderUsage } from "./provider/openrouter.ts";
import { chooseModel, type CallKind, type Slot, type Models } from "./model/router.ts";
import { markFallback } from "./provider/response.ts";
import { withPrimer, type SystemContext } from "./context/shared.ts";
export { chooseModel, SLOT_OF } from "./model/router.ts";
export type { CallKind, Slot, Models } from "./model/router.ts";
export { PROSE_CAPS, trimProse, truncateProse, repairNote, markFallback, isFromFallback } from "./provider/response.ts";
export type { ProviderUsage } from "./provider/openrouter.ts";
import type { z } from "zod";
import { ActionProposal, Dialogue, Paper, Reflection, type Perception, DayPlan, DigestText, Persona, LifeText, Judgement, PersonaDepth } from "@unwatched/protocol";
import type { AgentState, Brain, ConverseContext, PaperContext, ReflectContext, Tier, PlanContext, DigestContext, ChildContext, LifeContext, JudgeContext } from "@unwatched/engine";
import { MockBrain } from "./mock.ts";
import { paperSystem, paperPrompt, lifeSystem, lifePrompt, judgeSystem, judgePrompt, digestSystem, digestPrompt, childSystem, childPrompt, depthSystem, depthPrompt } from "./prompts.ts";

export interface OpenRouterBrainOptions {
  /** Production must not deliver mock output as a paid model response. */
  allowFallback?: boolean;
  apiKey?: string;
  routine?: string;
  stakes?: string;
  reflect?: string;
  log?: (line: string) => void;
  /** Milliseconds before a routine or stakes call is given up on (env UW_OR_TIMEOUT_MS, default 45s) and a reflect-tier one (env UW_OR_TIMEOUT_REFLECT_MS, default 90s). */
  timeoutMs?: number;
  reflectTimeoutMs?: number;
}

/** Town-level calls (the Gazette, a child, the digest of someone who has left) have no citizen; the hook sees the town, which has no owner, so only the ceiling applies. */
const TOWN = Object.freeze({ id: "town", owner: null, brainKind: "hosted", funded: true }) as unknown as AgentState;

/**
 * The "your own key" path from the design: same prompts and same schemas as the hosted brain,
 * sent to OpenRouter, which fronts Claude and everything else. The engine cannot tell the difference.
 */
export class OpenRouterBrain implements Brain {
  readonly name = "openrouter";
  private provider: OpenRouterProvider;
  private allowFallback: boolean;
  private models: Models;
  private log: (l: string) => void;
  private fallback = new MockBrain(13);
  constructor(o: OpenRouterBrainOptions = {}) {
    const key = o.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    this.provider = new OpenRouterProvider({ ...o, apiKey: key });
    this.allowFallback = o.allowFallback ?? true;
    this.models = {
      routine: o.routine ?? process.env.UW_OR_MODEL_ROUTINE ?? "anthropic/claude-haiku-4.5",
      stakes: o.stakes ?? process.env.UW_OR_MODEL_STAKES ?? "anthropic/claude-sonnet-5",
      reflect: o.reflect ?? process.env.UW_OR_MODEL_REFLECT ?? "anthropic/claude-opus-5",
    };
    this.log = o.log ?? (() => {});
  }

  usage() { return this.provider.usage(); }
  cachedTokens() { return this.provider.cachedTokens(); }
  get onUsage() { return this.provider.onUsage; }
  set onUsage(hook: ((usage: ProviderUsage) => void) | null) { this.provider.onUsage = hook; }
  get onFallback() { return this.provider.onFallback; }
  set onFallback(hook: ((f: { what: string; model: string; reason: string }) => void) | null) { this.provider.onFallback = hook; }
  /** The models for one citizen when they differ from the town's: a Patron's careful thoughts and reflection go to the most capable mind; under the daily ceiling everyone thinks on cheaper minds. Consulted for every call. */
  modelsFor: ((a: AgentState) => Partial<Models> | null) | null = null;
  /** The island itself, in words, the same for every citizen: places, work, the calendar. Set by the server; part of the shared cached prefix. */
  primer = "";
  /** Reading summaries need not inherit a Patron's careful-decision upgrade. */
  digestModel: string | null = null;
  /** Which model a call goes to, for a citizen or for the town. A hook that throws is a hook that said nothing. */
  private pick(kind: CallKind, a: AgentState | null, slot?: Slot) {
    let o: Partial<Models> | null = null;
    try { o = this.modelsFor?.(a ?? TOWN) ?? null; } catch (err) { this.log(`warn: modelsFor threw for ${kind}: ${(err as Error).message}`); }
    if(kind === "digest" && this.digestModel)return {model:this.digestModel,slot:"stakes" as const};
    return chooseModel(kind, this.models, o, slot);
  }
  private stood<T extends object>(kind: CallKind, model: string, out: T): T { if (!this.allowFallback) throw new Error(`Model unavailable: ${kind} (${model}); no synthetic response delivered`); this.log(`warn: fallback stood in for ${kind} (${model})`); return markFallback(out); }

  private call<T>(name: CallKind, model: string, slot: Slot, system: SystemContext, user: string, schema: z.ZodType<T>, maxTokens: number, agentId: string | null = null) {
    return this.provider.call(name, model, slot, withPrimer(name, system, this.primer), user, schema, maxTokens, agentId);
  }

  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> {
    const { model, slot } = this.pick("action_proposal", a, tier >= 2 ? "stakes" : "routine");
    const { system, user } = buildDecideContext(p, a);
    const out = await this.call("action_proposal", model, slot, system, user, actionProposalSchema(p), 1024, a.id);
    return out ?? this.stood("action_proposal", model, await this.fallback.decide(p, a, tier));
  }
  async converse(ctx: ConverseContext): Promise<Dialogue> {
    const { model, slot } = this.pick("dialogue", ctx.a);
    const { system, user } = buildConverseContext(ctx);
    const out = await this.call("dialogue", model, slot, system, user, Dialogue, 1500, ctx.a.id);
    return out ?? this.stood("dialogue", model, await this.fallback.converse(ctx));
  }
  async reflect(ctx: ReflectContext): Promise<Reflection> {
    // a quiet night (nothing of importance happened, says the engine) is thought through on the middle mind, briefly; the prompt is the same
    const quiet = ctx.agent.budget?.reflectionIncluded !== true && (ctx as { quiet?: boolean }).quiet === true;
    const { model, slot } = this.pick("reflection", ctx.agent, quiet ? "stakes" : "reflect");
    const { system, user } = buildReflectContext(ctx);
    const out = await this.call("reflection", model, slot, system, user, Reflection, quiet ? 900 : 2000, ctx.agent.id);
    return out ?? this.stood("reflection", model, await this.fallback.reflect(ctx));
  }
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> {
    const { model, slot } = this.pick("day_plan", ctx.agent, tier >= 2 ? "stakes" : "routine");
    const { system, user } = buildPlanContext(ctx);
    const out = await this.call("day_plan", model, slot, system, user, DayPlan, 1200, ctx.agent.id);
    return out ?? this.stood("day_plan", model, await this.fallback.plan(ctx, tier));
  }
  /** The depth a person has beyond the sheet, written once by the strongest mind and kept with them. */
  async enrich(p: Persona, island: string): Promise<PersonaDepth | null> { const { model, slot } = this.pick("persona_depth", null); return this.call("persona_depth", model, slot, { shared: depthSystem }, depthPrompt(p, island), PersonaDepth, 900); }
  async digest(ctx: DigestContext): Promise<DigestText> {
    const { model, slot } = this.pick("digest", ctx.agent); // the owner's reading is the product: the middle mind writes it
    const out = await this.call("digest", model, slot, { shared: digestSystem }, digestPrompt(ctx), DigestText, 700, ctx.agent.id);
    return out ?? this.stood("digest", model, await this.fallback.digest(ctx));
  }
  async child(ctx: ChildContext): Promise<Persona> {
    const { model, slot } = this.pick("child", null);
    const out = await this.call("child", model, slot, { shared: childSystem }, childPrompt(ctx), Persona, 900);
    return out ?? this.stood("child", model, await this.fallback.child(ctx));
  }
  async writePaper(ctx: PaperContext): Promise<Paper> {
    const { model, slot } = this.pick("paper", null);
    const out = await this.call("paper", model, slot, { shared: paperSystem }, paperPrompt(ctx), Paper, 3000);
    return out ?? this.stood("paper", model, await this.fallback.writePaper(ctx));
  }
  async judge(ctx: JudgeContext): Promise<Judgement> {
    const { model, slot } = this.pick("judgement", ctx.agent);
    const out = await this.call("judgement", model, slot, { shared: judgeSystem }, judgePrompt(ctx), Judgement, 400, ctx.agent.id);
    return out ?? this.stood("judgement", model, await this.fallback.judge(ctx));
  }
  async life(ctx: LifeContext): Promise<LifeText> {
    const { model, slot } = this.pick("life", null);
    const out = await this.call("life", model, slot, { shared: lifeSystem }, lifePrompt(ctx), LifeText, 3200);
    return out ?? this.stood("life", model, await this.fallback.life(ctx));
  }
}
