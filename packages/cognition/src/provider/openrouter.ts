import { z } from "zod";
import type { CallKind, Slot } from "../model/router.ts";
import type { SystemContext } from "../context/shared.ts";
import { cleanSchema, strictSchema, stripNulls, wantsStrict } from "../schema/json.ts";
import { truncateProse, repairNote } from "./response.ts";

export interface ProviderUsage { agentId: string | null; kind: CallKind; model: string; promptTokens: number; completionTokens: number; cachedTokens: number; costUsd: number | null; reasoningTokens?: number; finishReason?: string | null; provider?: string | null; generationId?: string | null; }

interface ProviderResponse {
  id?: string; provider?: string;
  error?: { code?: number; message?: string };
  choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
  usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } };
}

export interface ProviderOptions {
  apiKey: string;
  timeoutMs?: number;
  reflectTimeoutMs?: number;
  log?: (line: string) => void;
}

/** Stable operation/world/schema prefix first, persona second, volatile context last. */
export function buildMessages(system: SystemContext, user: string): { role: string; content: unknown }[] {
  return [{ role: "system", content: [
    { type: "text", text: system.shared + "\n\nAnswer with a single JSON object matching the supplied response schema, no prose.", cache_control: { type: "ephemeral" } },
    ...(system.own ? [system.cacheOwn ? { type: "text", text: system.own, cache_control: { type: "ephemeral" } } : { type: "text", text: system.own }] : []),
  ] }, { role: "user", content: user }];
}

/** HTTP, accounting and structured-response repair; no agent state or model selection. */
export class OpenRouterProvider {
  private key: string;
  private blockedUntil = 0;
  private log: (line: string) => void;
  private timeoutMs: number;
  private reflectTimeoutMs: number;
  private providerCost: number | null = 0;
  private spent = { calls: 0, prompt: 0, completion: 0 };
  private cached = 0;
  onUsage: ((usage: ProviderUsage) => void) | null = null;
  onFallback: ((f: { what: string; model: string; reason: string }) => void) | null = null;

  constructor(o: ProviderOptions) {
    this.key = o.apiKey;
    this.timeoutMs = o.timeoutMs ?? envMs("UW_OR_TIMEOUT_MS", 45_000);
    this.reflectTimeoutMs = o.reflectTimeoutMs ?? envMs("UW_OR_TIMEOUT_REFLECT_MS", 90_000);
    this.log = o.log ?? (() => {});
  }
  usage() { return { ...this.spent, costUsd: this.providerCost }; }
  cachedTokens() { return this.cached; }

  private async post(body: unknown, model: string, name: CallKind, slot: Slot, agentId: string | null): Promise<{ text: string; finishReason: string | null } | null> {
    if (Date.now() < this.blockedUntil) throw new Error("Provider unavailable; retry after cooldown");
    const ms = slot === "reflect" ? this.reflectTimeoutMs : this.timeoutMs;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() < this.blockedUntil) throw new Error("Provider unavailable; retry after cooldown");
      // the whole attempt is inside the try: the deadline aborts the body as well as the headers, so an answer that arrives half-read must fall back like any other
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "HTTP-Referer": "https://unwatched.town", "X-Title": "Unwatched" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(ms),
        });
        if (res.status === 429 || res.status >= 500) { this.log(`openrouter ${res.status}; ${attempt === 0 ? "retrying" : "falling back"}`); if (attempt === 1) { this.onFallback?.({ what: name, model, reason: `openrouter ${res.status}` }); return null; } await new Promise((r) => setTimeout(r, 1500)); continue; }
        if (!res.ok) { const msg = (await res.text()).slice(0, 600); if ([401, 402, 403].includes(res.status)) this.blockedUntil = Date.now() + (/daily limit/i.test(msg)?3600000:300000); this.log(`openrouter ${res.status}: ${msg}`); this.onFallback?.({ what: name, model, reason: `openrouter ${res.status}` }); return null; }
        const data = await res.json() as ProviderResponse;
        const finishReason = data.choices?.[0]?.finish_reason ?? null;
        if (typeof data.usage?.cost === "number" && this.providerCost !== null) this.providerCost += data.usage.cost; else this.providerCost = null;
        try { this.onUsage?.({agentId,kind:name,model,promptTokens:data.usage?.prompt_tokens??0,completionTokens:data.usage?.completion_tokens??0,cachedTokens:data.usage?.prompt_tokens_details?.cached_tokens??0,costUsd:typeof data.usage?.cost === "number" ? data.usage.cost : null, reasoningTokens:data.usage?.completion_tokens_details?.reasoning_tokens??0, finishReason, provider:data.provider??null, generationId:data.id??null}); } catch { this.log("Provider usage reporting failed"); }
        this.spent.calls++; this.spent.prompt += data.usage?.prompt_tokens ?? 0; this.spent.completion += data.usage?.completion_tokens ?? 0; this.cached += data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
        this.log(`openrouter response ${JSON.stringify({ kind: name, model, id: data.id, provider: data.provider, finishReason, prompt: data.usage?.prompt_tokens, completion: data.usage?.completion_tokens, reasoning: data.usage?.completion_tokens_details?.reasoning_tokens, cached: data.usage?.prompt_tokens_details?.cached_tokens, costUsd: data.usage?.cost })}`);
        if (data.error || (finishReason !== null && !["stop", "length"].includes(finishReason))) {
          const reason = data.error ? `provider error ${data.error.code ?? "unknown"}` : `finish_reason=${finishReason}`;
          this.log(`openrouter ${name}: ${reason}`);
          this.onFallback?.({ what: name, model, reason }); return null;
        }
        return { text: typeof data.choices?.[0]?.message?.content === "string" ? data.choices[0].message.content : "", finishReason };
      } catch (err) {
        const why = (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError" ? `no answer in ${Math.round(ms / 1000)}s` : `no usable answer: ${(err as Error).message}`;
        this.log(`openrouter ${why}; not replaying an uncertain request`); this.onFallback?.({ what: name, model, reason: why }); return null;
      }
    }
    return null;
  }

  async call<T>(name: CallKind, model: string, slot: Slot, system: SystemContext, user: string, schema: z.ZodType<T>, maxTokens: number, agentId: string | null = null): Promise<T | null> {
    // Providers behind OpenRouter accept a subset of JSON Schema: no regex patterns, no defaults, anyOf not oneOf.
    // Send the schema once, as a strict response format. Duplicating it in system is costly.
    const jsonSchema = wantsStrict(model) ? strictSchema(cleanSchema(z.toJSONSchema(schema))) : cleanSchema(z.toJSONSchema(schema));
    const messages = buildMessages(system, user);
    // V4 Flash enables high reasoning by default. These existing operation budgets
    // are for the final JSON, not an unbounded thinking phase. Other models retain their policy.
    const disableReasoning = /^deepseek\/deepseek-v4-flash-(?:0731|20260731)(?::.*)?$/.test(model);
    const body = { model, stream: false, max_tokens: maxTokens, messages,
      ...(disableReasoning ? { reasoning: { enabled: false } } : {}),
      provider: { require_parameters: true },
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema: jsonSchema } } };
    for (let attempt = 0; attempt < 2; attempt++) {
      const got = await this.post(body, model, name, slot, agentId); if (!got) return null;
      if (got.finishReason === "length") {
        this.log(`openrouter ${name} (${model}): truncated at max_tokens=${body.max_tokens}; ${attempt === 0 ? "retrying once with double budget" : "giving up"}`);
        if (attempt === 1) { this.onFallback?.({ what: name, model, reason: "finish_reason=length" }); return null; }
        body.max_tokens = maxTokens * 2;
        continue; // Never parse or replay truncated assistant text as a completed answer.
      }
      const text = got.text;
      let raw: unknown;
      try { raw = JSON.parse(text.trim().replace(/^```json\s*|```$/g, "")); }
      catch { this.log(`not json from ${model}: ${text.slice(0, 80)}`); if (attempt === 1) { this.onFallback?.({ what: name, model, reason: text.trim() ? "not json" : "no answer" }); return null; } if (text.trim()) messages.push({ role: "assistant", content: text }, { role: "user", content: "That was not a single JSON object. Return the same answer as JSON only, matching the schema." }); continue; } // an empty turn is refused by the providers, so an answer with nothing in it is simply asked again
      const parsed = schema.safeParse(truncateProse(name, wantsStrict(model) ? stripNulls(raw) : raw));
      if (parsed.success) return parsed.data;
      const issue = parsed.error.issues[0];
      this.log(`schema mismatch from ${model}: ${issue?.message ?? "?"} at ${issue?.path.join(".") || "root"}; got ${text.slice(0, 160)}`);
      if (attempt === 1 || !issue) { this.onFallback?.({ what: name, model, reason: `schema: ${issue?.message ?? "?"}` }); return null; }
      // the repair: the model sees its own answer and the one thing wrong with it, and gives the same answer inside the limits
      messages.push({ role: "assistant", content: text }, { role: "user", content: repairNote(issue as Parameters<typeof repairNote>[0], raw) });
    }
    return null;
  }

}

function envMs(name: string, dflt: number): number { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : dflt; }
