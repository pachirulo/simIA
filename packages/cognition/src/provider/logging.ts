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
      if (this.content) this.log(`openrouter ${event} ${JSON.stringify({ at: new Date().toISOString(), ...trace, ...fields })}`);
      else this.log(`[LLM ${new Date().toLocaleTimeString("es-AR", { hour12: false })} ${trace.agentId ?? "pueblo"} ${trace.callId.slice(0, 8)}] ${trace.kind} | ${readableEvent(event, fields, trace)}`);
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
const number = (value: unknown) => typeof value === "number" ? String(value) : "?";
const cost = (value: unknown) => typeof value === "number" ? `$${value.toFixed(6)}` : "coste desconocido";

/** Summaries only: never serialize a prompt, schema or full provider payload here. */
function readableEvent(event: string, fields: Record<string, unknown>, trace: CallTrace): string {
  switch (event) {
    case "request": return `consultando ${trace.model} · intento ${fields.attempt ?? (trace as Partial<AttemptTrace>).attempt ?? 1}/${(trace as Partial<AttemptTrace>).httpAttempt ?? 1}`;
    case "response": return `${fields.provider ?? "proveedor desconocido"} · tokens ${number(fields.prompt)} entrada / ${number(fields.completion)} salida · caché ${number(fields.cached)} · ${cost(fields.costUsd)} · ${typeof fields.durationMs === "number" ? (fields.durationMs / 1000).toFixed(1) + "s" : "?"} · fin=${fields.finishReason ?? "?"}${fields.error ? ` · error: ${brief(fields.error)}` : ""}`;
    case "validation": {
      if (fields.status !== "accepted") {
        const issue = record(fields.issue);
        return `rechazado (${fields.status})${issue.code ? ` · ${issue.code}` : ""}${issue.message ? `: ${brief(issue.message)}` : ""} · ${fields.willRetry ? "se repara" : "sin más reintentos"}`;
      }
      const value = record(fields.value);
      const lead = record(value.lead);
      const summary = value.action ?? value.summary ?? lead.headline ?? value.headline ?? value.goals ?? value.text ?? value.title
        ?? (Array.isArray(value.lines) ? `diálogo: ${value.lines.length} intervenciones` : "respuesta válida");
      return `${value.action ? "propuesta válida" : "respuesta válida"}: ${brief(summary, 240)}${value.intent ? ` · motivo: ${brief(value.intent, 140)}` : ""}${Array.isArray(value.remember) && value.remember.length ? ` · recuerdos: ${value.remember.length}` : ""}`;
    }
    case "generation": {
      const m = record(fields.metadata);
      return `OpenRouter confirmado · nativos ${number(m.native_tokens_prompt)}/${number(m.native_tokens_completion)} · caché ${number(m.native_tokens_cached)} · ${cost(m.total_cost)} · id=${fields.id}`;
    }
    case "generation_unavailable": return `metadata no disponible (${fields.reason}) · id=${fields.id ?? "desconocido"}`;
    case "http_error": return `error HTTP ${fields.status}`;
    case "transport_error": return `error de conexión: ${brief(fields.reason)}`;
    default: return event;
  }
}
