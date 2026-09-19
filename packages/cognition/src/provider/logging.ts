import type { CallKind, Slot } from "../model/router.ts";

export interface OpenRouterLoggingOptions {
  /** Opt-in full JSON diagnostics. Default false: concise human-readable console. */
  logContent?: boolean;
  /** Read generation metadata asynchronously by ID. Default true when a log sink exists. */
  logGeneration?: boolean;
}

export interface CallTrace { callId: string; agentId: string | null; kind: CallKind; model: string; slot: Slot }
export interface AttemptTrace extends CallTrace { attempt: number; httpAttempt: number }

/** Observability must never change model retries, results or accounting. */
export function safeLog(sink?: (line: string) => void): (line: string) => void {
  return line => { try { sink?.(line); } catch { /* Logging is best effort. */ } };
}

export class OpenRouterLogger {
  readonly content: boolean;
  private readonly generation: boolean;
  private readonly log: (line: string) => void;
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly apiKey: string, sink: ((line: string) => void) | undefined, options: OpenRouterLoggingOptions) {
    this.log = safeLog(sink);
    this.content = !!sink && (options.logContent ?? process.env.UW_OR_LOG_CONTENT === "1");
    this.generation = !!sink && (options.logGeneration ?? process.env.UW_OR_LOG_GENERATION !== "0");
  }

  emit(event: string, trace: CallTrace, fields: Record<string, unknown> = {}): void {
    try {
      const dialogue = acceptedDialogue(event, trace, fields);
      const details = dialogue ? { ...fields, dialogue } : fields;
      if (this.content) this.log(`openrouter ${event} ${JSON.stringify({ at: new Date().toISOString(), ...trace, ...details })}`);
      else this.log(`[LLM ${new Date().toLocaleTimeString("en-GB", { hour12: false })} ${trace.agentId ?? "town"} ${trace.callId.slice(0, 8)}] ${trace.kind} | ${readableEvent(event, details, trace)}`);
    }
    catch { /* Serializing diagnostics must not fail a valid model response. */ }
  }

  enrich(trace: AttemptTrace, id: string | null): void {
    if (!this.generation) return;
    if (!id || this.pending.size >= 32) {
      this.emit("generation_unavailable", trace, { id, reason: id ? "logging_queue_full" : "missing_generation_id" });
      return;
    }
    // Capture this transport so scheduled retries use the same runtime/test transport.
    const task = this.fetchGeneration(trace, id, globalThis.fetch);
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }

  /** Optional CLI drain after simulation finishes; never part of a decision. */
  async flush(): Promise<void> {
    // Referenced deadline keeps a short CLI alive while retry timers are unref'd.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([Promise.all([...this.pending]), new Promise<void>(resolve => { timer = setTimeout(resolve, 40_000); })]); }
    finally { clearTimeout(timer); }
  }

  private async fetchGeneration(trace: AttemptTrace, id: string, transport: typeof fetch): Promise<void> {
    let reason = "unavailable";
    // Fresh logs may return 404. Only retry this GET, never the model completion.
    for (const delay of [0, 1000, 4000, 12000]) {
      if (delay) await new Promise<void>(resolve => { setTimeout(resolve, delay).unref(); });
      try {
        const response = await transport(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          reason = `http_${response.status}`;
          if (response.status === 404 || response.status === 429 || response.status >= 500) continue;
          break;
        }
        const payload: unknown = await response.json();
        const data = payload && typeof payload === "object" && "data" in payload ? payload.data : null;
        if (!data || typeof data !== "object" || !("id" in data) || data.id !== id) { reason = "invalid_metadata"; break; }
        // Preserve API field names: normalized tokens and native tokens must not be
        // confused, and reported latency is distinct from our HTTP elapsed time.
        this.emit("generation", trace, { id, url: `https://openrouter.ai/logs?transaction=${encodeURIComponent(id)}`, metadata: data });
        return;
      } catch { reason = "metadata_request_failed"; }
    }
    this.emit("generation_unavailable", trace, { id, reason });
  }
}

const brief = (value: unknown, limit = 180): string => {
  const text = (typeof value === "string" ? value : JSON.stringify(value) ?? "").replace(/\s+/gu, " ").trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
function acceptedDialogue(event: string, trace: CallTrace, fields: Record<string, unknown>): { speaker: string; text: string }[] | null {
  if (event !== "validation" || fields.status !== "accepted" || trace.kind !== "dialogue") return null;
  const lines: unknown = record(fields.value).lines;
  if (!Array.isArray(lines) || !lines.length || !lines.every(line => typeof record(line).speaker === "string" && typeof record(line).text === "string")) return null;
  return lines.map(line => ({ speaker: line.speaker as string, text: line.text as string }));
}
const number = (value: unknown) => typeof value === "number" ? String(value) : "?";
const cost = (value: unknown) => typeof value === "number" ? `$${value.toFixed(6)}` : "unknown cost";

/** Preserve the entire completion, including rejected/truncated text. */
function completionBlock(value: unknown): string {
  if (typeof value !== "string") return "(no content)";
  if (!value.length) return "(empty)";
  try { return JSON.stringify(JSON.parse(value)); }
  catch { return JSON.stringify(value); } // Lossless escaped string, including incomplete JSON.
}

/** Concise metadata plus full completion; never print prompts or provider envelopes. */
function readableEvent(event: string, fields: Record<string, unknown>, trace: CallTrace): string {
  switch (event) {
    case "request": return `calling ${trace.model} · attempt ${fields.attempt ?? (trace as Partial<AttemptTrace>).attempt ?? 1} · HTTP ${(trace as Partial<AttemptTrace>).httpAttempt ?? 1}`;
    case "response": return `${fields.provider ?? "unknown provider"} · tokens ${number(fields.prompt)} input / ${number(fields.completion)} output · cache ${number(fields.cached)} · ${cost(fields.costUsd)} · ${typeof fields.durationMs === "number" ? (fields.durationMs / 1000).toFixed(1) + "s" : "?"} · finish=${fields.finishReason ?? "?"}${fields.error ? ` · error: ${brief(fields.error)}` : ""} · Completion (attempt ${(trace as Partial<AttemptTrace>).attempt ?? 1}, id=${fields.id ?? "unknown"}): ${completionBlock(fields.completionText)}`;
    case "validation": {
      if (fields.status === "normalized") return `normalized optional fields: ${brief(fields.fields)} · ${fields.reason ?? "validation continues"}`;
      if (fields.status !== "accepted") {
        const issue = record(fields.issue);
        return `rejected (${fields.status})${issue.code ? ` · ${issue.code}` : ""}${issue.message ? `: ${brief(issue.message)}` : ""} · ${fields.willRetry ? "repairing" : "no retries left"}`;
      }
      if (fields.dialogue) return `dialogue=${JSON.stringify(fields.dialogue)} · accepted by cognition; execution not yet confirmed`;
      const value = record(fields.value);
      const lead = record(value.lead);
      const summary = value.action ?? value.summary ?? lead.headline ?? value.headline ?? value.goals ?? value.text ?? value.title
        ?? (Array.isArray(value.lines) ? `dialogue: ${value.lines.length} lines` : "valid response");
      return `${value.action ? "valid proposal" : "valid response"}: ${brief(summary, 240)}${value.intent ? ` · reason: ${brief(value.intent, 140)}` : ""}${Array.isArray(value.remember) && value.remember.length ? ` · memories: ${value.remember.length}` : ""}`;
    }
    case "generation": {
      const m = record(fields.metadata);
      return `OpenRouter confirmed · native ${number(m.native_tokens_prompt)}/${number(m.native_tokens_completion)} · cache ${number(m.native_tokens_cached)} · ${cost(m.total_cost)} · id=${fields.id}`;
    }
    case "generation_unavailable": return `metadata unavailable (${fields.reason}) · id=${fields.id ?? "unknown"}`;
    case "repair_comparison": return `repair: ${fields.status} · fields: ${brief(fields.changed)}`;
    case "http_error": return `HTTP error ${fields.status}`;
    case "transport_error": return `connection error: ${brief(fields.reason)}`;
    default: return event;
  }
}
