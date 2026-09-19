import { closeSync, existsSync, mkdirSync, openSync, writeFileSync, writeSync } from "node:fs";
import { resolve } from "node:path";

const files = ["events.jsonl", "dialogue.jsonl", "run.log"] as const;
type LogFile = typeof files[number];
type RunStatus = "completed" | "failed" | "interrupted";

/** Local run artifacts. Append synchronously so a terminated CLI retains all
 * writes already delivered to the logger; no unbounded stream buffer or retries.
 * This is not an fsync guarantee against power loss. No environment dump. */
export class RunLogs {
  readonly directory: string;
  private readonly handles = new Map<LogFile, number>();
  private readonly errors = new Set<string>();
  private closed = false;
  private readonly startedAt = new Date().toISOString();

  constructor(directory: string, private readonly config: Record<string, unknown>, private readonly warn: (message: string) => void = console.error) {
    this.directory = resolve(directory);
    const protectedFiles = [...files, "run.json", "summary.json", "construction.json"];
    if (protectedFiles.some(name => existsSync(resolve(this.directory, name)))) {
      throw new Error(`Run artifacts already exist in ${this.directory}. Choose a fresh --out directory; previous runs will not be overwritten.`);
    }
    mkdirSync(this.directory, { recursive: true });
    // Claim the run before opening other files. wx also protects concurrent runs.
    writeFileSync(resolve(this.directory, "run.json"), this.metadata("running"), { encoding: "utf8", flag: "wx" });
    try {
      for (const name of files) this.handles.set(name, openSync(resolve(this.directory, name), "wx"));
    } catch (error) {
      this.finish("failed", { failure: "Could not initialize run log files." });
      throw error;
    }
  }

  write(name: LogFile, text: string): void {
    if (this.closed || this.errors.has(name)) return;
    try {
      const bytes = Buffer.from(text, "utf8"), handle = this.handles.get(name);
      if (handle === undefined) throw new Error("Log file is not open");
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(handle, bytes, offset, bytes.length - offset);
        if (written === 0) throw new Error("Log write made no progress");
        offset += written;
      }
    } catch { this.failed(name); }
  }

  /** Returns false if any output failed. Never turn a logger failure into a
   * retry/fallback of the model or an action; the CLI reports an incomplete run. */
  finish(status: RunStatus, details: Record<string, unknown> = {}): boolean {
    if (this.closed) return this.errors.size === 0;
    this.closed = true;
    for (const [name, handle] of this.handles) {
      try { closeSync(handle); } catch { this.failed(name); }
    }
    this.handles.clear();
    try {
      writeFileSync(resolve(this.directory, "run.json"), this.metadata(this.errors.size ? "logging_failed" : status,
        { ...details, requestedStatus: status, finishedAt: new Date().toISOString(), loggingErrors: [...this.errors] }), "utf8");
    } catch { this.failed("run.json"); }
    return this.errors.size === 0;
  }

  private metadata(status: string, details: Record<string, unknown> = {}): string {
    return JSON.stringify({ ...details, config: this.config, directory: this.directory, startedAt: this.startedAt, status }) + "\n";
  }

  private failed(name: string): void {
    if (this.errors.has(name)) return;
    this.errors.add(name);
    try { this.warn(`Could not persist ${resolve(this.directory, name)}; run artifacts are incomplete.`); } catch { /* Keep diagnostics isolated. */ }
  }
}
