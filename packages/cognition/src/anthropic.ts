import { publicPaperContext } from "./context/paper.ts";
import { reflectionSchema, normalizeReflection } from "./schema/reflection.ts";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ActionProposal, Dialogue, Paper, Reflection, type Perception, DayPlan, DigestText, Persona, LifeText, Judgement, PersonaDepth } from "@unwatched/protocol";
import type { AgentState, Brain, ConverseContext, PaperContext, ReflectContext, Tier, PlanContext, DigestContext, ChildContext, LifeContext, JudgeContext } from "@unwatched/engine";
import { MockBrain } from "./mock.ts";
import { conservativeDecisionFallback, conservativeReflectionFallback } from "./fallbacks.ts";
import { buildDecideContext } from "./context/decide.ts";
import { decisionEvidence } from "./context/decision-evidence.ts";
import { DecisionContinuity } from "./context/continuity.ts";
import { buildPlanContext } from "./context/plan.ts";
import { buildReflectContext } from "./context/reflect.ts";
import { decisionIssue } from "./semantics/decision.ts";
import { normalizeOptionalStrings } from "./schema/normalize.ts";
import { CognitiveDayPlan } from "./schema/plan.ts";
import { planIssue, reflectionIssue } from "./semantics/lifecycle.ts";
import { dialogueIssue, canonicalDialogue } from "./semantics/dialogue.ts";
import { publicDialogueFallback } from "./context/converse.ts";
import { anchoredRepairNote, compareRepair, repairAnchor, restoreRepairMetadata, type RepairAnchor } from "./semantics/repair.ts";
import { markFallback } from "./provider/response.ts";
import { outputQualityIssue } from "./semantics/quality.ts";
import { WORLD, personaBlock, conversePrompt, paperSystem, paperPrompt, lifeSystem, lifePrompt, judgeSystem, judgePrompt, digestSystem, digestPrompt, childSystem, childPrompt, depthSystem, depthPrompt } from "./prompts.ts";

export interface AnthropicBrainOptions {
  routine?: string;   // tier 1
  stakes?: string;    // tier 2
  reflect?: string;   // tier 3 and the paper
  log?: (line: string) => void;
  /** Milliseconds before a routine or stakes call is given up on (env UW_TIMEOUT_MS, default 45s) and a reflect-tier one (env UW_TIMEOUT_REFLECT_MS, default 90s). One retry, then the fallback. */
  timeoutMs?: number;
  reflectTimeoutMs?: number;
}


/**
 * Three tiers on Claude, as the design says: a routine model for everyday thoughts,
 * a stakes model for decisions that matter, a reflection model for the night and the paper.
 * Every call is structured output validated against the protocol schemas, and the persona is a cached prefix.
 */
export class AnthropicBrain implements Brain {
  readonly name = "anthropic";
  private client = new Anthropic();
  private fallback = new MockBrain(11);
  private continuity = new DecisionContinuity();
  private routine: string; private stakes: string; private reflectModel: string;
  private log: (l: string) => void;
  private timeoutMs: number; private reflectTimeoutMs: number;
  constructor(o: AnthropicBrainOptions = {}) {
    this.routine = o.routine ?? process.env.UW_MODEL_ROUTINE ?? "claude-haiku-4-5";
    this.stakes = o.stakes ?? process.env.UW_MODEL_STAKES ?? "claude-sonnet-5";
    this.reflectModel = o.reflect ?? process.env.UW_MODEL_REFLECT ?? "claude-opus-5";
    this.log = o.log ?? (() => {});
    this.timeoutMs = o.timeoutMs ?? envMs("UW_TIMEOUT_MS", 45_000);
    this.reflectTimeoutMs = o.reflectTimeoutMs ?? envMs("UW_TIMEOUT_REFLECT_MS", 90_000);
  }
  /** The request options every call carries: a deadline by tier and one retry, so a stalled model cannot hold the morning. */
  private opts(model: string) { return { timeout: model === this.reflectModel ? this.reflectTimeoutMs : this.timeoutMs, maxRetries: 1 }; }

  private system(a: AgentState, shared = WORLD) {
    // Stable prefix first (world, persona), cached. Volatile content goes in the user turn.
    return [
      { type: "text" as const, text: shared },
      { type: "text" as const, text: personaBlock(a), cache_control: { type: "ephemeral" as const } },
    ];
  }

  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> {
    p = decisionEvidence(p, a);
    const model = tier >= 2 ? this.stakes : this.routine;
    const context = buildDecideContext(p, a, this.continuity.describe(a, p));
    const messages: { role: "user"; content: string }[] = [{ role: "user", content: context.user }];
    let anchor: RepairAnchor | null = null;
    const fallback = async (): Promise<ActionProposal> => markFallback(conservativeDecisionFallback());
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await this.client.messages.parse({
          model, max_tokens: 1024, system: this.system(a, context.system.shared), messages,
          output_config: { format: zodOutputFormat(ActionProposal) },
        }, this.opts(model));
        if (res.stop_reason === "refusal" || !res.parsed_output) return fallback();
        const out = ActionProposal.parse(restoreRepairMetadata(anchor, normalizeOptionalStrings(res.parsed_output, ActionProposal)));
        const transition = anchor ? compareRepair(anchor, out) : null;
        if (transition) this.log(`repair comparison: ${transition.status}; changed ${transition.changed.join(", ")}`);
        const issue = transition?.issue ?? decisionIssue(out, p, a.persona.name);
        if (!issue) { this.continuity.record(a, p, out); return out; }
        this.log(`semantic mismatch from ${model}: ${issue.code} at ${issue.path}`);
        anchor = repairAnchor(out, issue);
        messages.push({ role: "user", content: anchoredRepairNote(issue, anchor) });
      }
      return fallback();
    } catch (err) { return this.handle(err, fallback); }
  }

  async converse(ctx: ConverseContext): Promise<Dialogue> {
    const fallback = async () => markFallback(publicDialogueFallback(ctx));
    try {
      const res = await this.client.messages.parse({
        model: this.routine, max_tokens: 1500,
        system: [{ type: "text", text: WORLD }, { type: "text", text: conversePrompt.system(ctx) }],
        messages: [{ role: "user", content: conversePrompt.user(ctx) }],
        output_config: { format: zodOutputFormat(Dialogue) },
      }, this.opts(this.routine));
      if (res.stop_reason === "refusal" || !res.parsed_output || dialogueIssue(res.parsed_output, ctx)) return fallback();
      return canonicalDialogue(res.parsed_output, ctx);
    } catch (err) { return this.handle(err, fallback); }
  }

  async reflect(ctx: ReflectContext): Promise<Reflection> {
    const a = ctx.agent;
    const context = buildReflectContext(ctx);
    const fallback = async () => markFallback(conservativeReflectionFallback());
    try {
      const res = await this.client.messages.parse({
        model: this.reflectModel, max_tokens: 2000,
        system: this.system(a, context.system.shared),
        messages: [{ role: "user", content: context.user }],
        output_config: { format: zodOutputFormat(reflectionSchema(ctx)) },
      }, this.opts(this.reflectModel));
      const out = reflectionSchema(ctx).safeParse(normalizeReflection(res.parsed_output));
      if (res.stop_reason === "refusal" || !out.success || outputQualityIssue(out.data) || reflectionIssue(out.data, ctx)) return fallback();
      return out.data;
    } catch (err) { return this.handle(err, fallback); }
  }

  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> {
    const context = buildPlanContext(ctx);
    try {
      const res = await this.client.messages.parse({
        model: tier >= 2 ? this.stakes : this.routine, max_tokens: 1200,
        system: this.system(ctx.agent, context.system.shared),
        messages: [{ role: "user", content: context.user }],
        output_config: { format: zodOutputFormat(CognitiveDayPlan) },
      }, this.opts(tier >= 2 ? this.stakes : this.routine));
      if (res.stop_reason === "refusal" || !res.parsed_output || outputQualityIssue(res.parsed_output) || planIssue(res.parsed_output, ctx)) return this.fallback.plan(ctx, tier);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.plan(ctx, tier)); }
  }

  async digest(ctx: DigestContext): Promise<DigestText> {
    try {
      const res = await this.client.messages.parse({ model: this.routine, max_tokens: 600, system: digestSystem, messages: [{ role: "user", content: digestPrompt(ctx) }], output_config: { format: zodOutputFormat(DigestText) } }, this.opts(this.routine));
      if (res.stop_reason === "refusal" || !res.parsed_output) return this.fallback.digest(ctx);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.digest(ctx)); }
  }
  async child(ctx: ChildContext): Promise<Persona> {
    try {
      const res = await this.client.messages.parse({ model: this.stakes, max_tokens: 900, system: childSystem, messages: [{ role: "user", content: childPrompt(ctx) }], output_config: { format: zodOutputFormat(Persona) } }, this.opts(this.stakes));
      if (res.stop_reason === "refusal" || !res.parsed_output) return this.fallback.child(ctx);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.child(ctx)); }
  }
  async writePaper(ctx: PaperContext): Promise<Paper> {
    ctx = publicPaperContext(ctx);
    try {
      const res = await this.client.messages.parse({
        model: this.reflectModel, max_tokens: 3000,
        system: paperSystem,
        messages: [{ role: "user", content: paperPrompt(ctx) }],
        output_config: { format: zodOutputFormat(Paper) },
      }, this.opts(this.reflectModel));
      if (res.stop_reason === "refusal" || !res.parsed_output) return this.fallback.writePaper(ctx);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.writePaper(ctx)); }
  }
  async judge(ctx: JudgeContext): Promise<Judgement> {
    try {
      const res = await this.client.messages.parse({ model: this.routine, max_tokens: 400, system: judgeSystem, messages: [{ role: "user", content: judgePrompt(ctx) }], output_config: { format: zodOutputFormat(Judgement) } }, this.opts(this.routine));
      if (res.stop_reason === "refusal" || !res.parsed_output) return this.fallback.judge(ctx);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.judge(ctx)); }
  }
  async life(ctx: LifeContext): Promise<LifeText> {
    try {
      const res = await this.client.messages.parse({
        model: this.reflectModel, max_tokens: 3200,
        system: lifeSystem,
        messages: [{ role: "user", content: lifePrompt(ctx) }],
        output_config: { format: zodOutputFormat(LifeText) },
      }, this.opts(this.reflectModel));
      if (res.stop_reason === "refusal" || !res.parsed_output) return this.fallback.life(ctx);
      return res.parsed_output;
    } catch (err) { return this.handle(err, () => this.fallback.life(ctx)); }
  }

  /** The depth a person has beyond the sheet, written once by the strongest mind and kept with them; the same prompt and schema as the OpenRouter brain. */
  async enrich(p: Persona, island: string): Promise<PersonaDepth | null> {
    try {
      const res = await this.client.messages.parse({ model: this.reflectModel, max_tokens: 900, system: depthSystem, messages: [{ role: "user", content: depthPrompt(p, island) }], output_config: { format: zodOutputFormat(PersonaDepth) } }, this.opts(this.reflectModel));
      if (res.stop_reason === "refusal" || !res.parsed_output) return null;
      return res.parsed_output;
    } catch (err) { return this.handle(err, async () => null); }
  }

  private async handle<T>(err: unknown, fallback: () => Promise<T>): Promise<T> {
    if (err instanceof Anthropic.RateLimitError) { this.log("rate limited; this thought falls back to habit"); return fallback(); }
    if (err instanceof Anthropic.APIConnectionTimeoutError) { this.log("no answer before the deadline; falling back"); return fallback(); }
    if (err instanceof Anthropic.APIConnectionError) { this.log("connection lost; falling back"); return fallback(); }
    if (err instanceof Anthropic.BadRequestError) { this.log(`bad request: ${err.message}`); return fallback(); }
    if (err instanceof Anthropic.APIError) { this.log(`api error ${err.status}: ${err.message}`); return fallback(); }
    throw err;
  }
}

function envMs(name: string, dflt: number): number { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : dflt; }
