import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunLogs } from "../src/run-logs.ts";
import { ActionProposal } from "@unwatched/protocol";
import { OpenRouterProvider } from "../../../packages/cognition/src/provider/openrouter.ts";

vi.mock("node:fs", async importOriginal => {
  const original = await importOriginal<typeof fs>();
  return { ...original, writeSync: vi.fn(original.writeSync) };
});
const directories: string[] = [], openLogs: RunLogs[] = [];
function directory() { const path = fs.mkdtempSync(join(tmpdir(), "simia-run-logs-")); directories.push(path); return path; }
function logger(path = directory(), warn = vi.fn()) { const logs = new RunLogs(path, { brain: "mock", seed: 853 }, warn); openLogs.push(logs); return logs; }
function read(logs: RunLogs, name: string) { return fs.readFileSync(join(logs.directory, name), "utf8"); }
afterEach(() => {
  for (const logs of openLogs.splice(0)) logs.finish("failed");
  for (const path of directories.splice(0)) fs.rmSync(path, { recursive: true, force: true });
  vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("durable headless diagnostics", () => {
  it("persists complete UTF-8 records before closing and distinguishes an unfinished run", () => {
    const logs = logger(), speech = { dialogue: [{ speaker: "Inés", text: "Bread?\nYes, here. 🍞" }] };
    logs.write("dialogue.jsonl", JSON.stringify(speech) + "\n");
    logs.write("run.log", "response:\n" + "rejected the action; ".repeat(300) + "\n");
    logs.write("run.log", "repair: still pending\n");
    expect(JSON.parse(read(logs, "dialogue.jsonl"))).toEqual(speech);
    expect(read(logs, "run.log")).toBe("response:\n" + "rejected the action; ".repeat(300) + "\nrepair: still pending\n");
    expect(JSON.parse(read(logs, "run.json")).status).toBe("running");
    expect(logs.finish("completed", { events: 1 })).toBe(true);
    expect(JSON.parse(read(logs, "run.json"))).toMatchObject({ status: "completed", events: 1, loggingErrors: [], finishedAt: expect.any(String) });
    const before = read(logs, "run.json");
    logs.write("run.log", "late write"); logs.finish("failed");
    expect(read(logs, "run.json")).toBe(before);
    expect(read(logs, "run.log")).not.toContain("late write");
  });

  it.each(["run.log", "run.json", "events.jsonl", "dialogue.jsonl", "summary.json", "construction.json"])("refuses to overwrite an existing %s", name => {
    const path = directory(); fs.writeFileSync(join(path, name), "previous run", "utf8");
    expect(() => logger(path)).toThrow("fresh --out");
    expect(fs.readFileSync(join(path, name), "utf8")).toBe("previous run");
  });

  it.each(["failed", "interrupted"] as const)("retains partial events when a run is %s", status => {
    const logs = logger(); logs.write("events.jsonl", '{"id":1}\n');
    expect(() => logger(logs.directory)).toThrow("fresh --out");
    logs.finish(status, { minute: 360 });
    expect(read(logs, "events.jsonl")).toBe('{"id":1}\n');
    expect(JSON.parse(read(logs, "run.json"))).toMatchObject({ status, minute: 360 });
  });

  it("isolates disk failure without throwing into model/action callbacks and marks the run incomplete", () => {
    const warn = vi.fn(), logs = logger(directory(), warn);
    vi.mocked(fs.writeSync).mockImplementationOnce(() => { throw new Error("disk full"); });
    expect(() => logs.write("run.log", "response")).not.toThrow();
    logs.write("run.log", "retry is deliberately suppressed");
    logs.write("events.jsonl", '{"id":2}\n');
    expect(logs.finish("completed")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(read(logs, "events.jsonl")).toBe('{"id":2}\n');
    expect(JSON.parse(read(logs, "run.json"))).toMatchObject({ status: "logging_failed", requestedStatus: "completed", loggingErrors: ["run.log"] });
  });

  it("stores rejected and repaired provider responses and drains delayed generation metadata before closing", async () => {
    const logs = logger(); let posts = 0;
    const pending: Array<() => void> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/generation?")) return new Promise<Response>(resolve => pending.push(() => resolve(new Response(JSON.stringify({ data: { id: new URL(url).searchParams.get("id"), total_cost: 0 } })))));
      posts++;
      return new Response(JSON.stringify({ id: `gen-file-${posts}`, choices: [{ finish_reason: "stop", message: { content: posts === 1 ? "Malformed response: bread?" : JSON.stringify({ action: { kind: "wait" }, remember: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    }));
    const provider = new OpenRouterProvider({ apiKey: "SECRET_NOT_FOR_LOGS", logContent: true, logGeneration: true, log: line => logs.write("run.log", line + "\n") });
    const proposal = await provider.call("action_proposal", "test/model", "routine", { shared: "Rules" }, "State", ActionProposal, 500, "ag_1");
    expect(proposal?.action.kind).toBe("wait");
    expect(posts).toBe(2);
    expect(read(logs, "run.log")).toContain("Malformed response: bread?");
    expect(read(logs, "run.log")).not.toContain("openrouter generation ");
    for (const release of pending) release();
    await provider.flushLogs();
    logs.finish("completed", { usage: provider.usage() });
    const lines = read(logs, "run.log").trim().split("\n");
    expect(lines.filter(line => line.startsWith("openrouter generation "))).toHaveLength(2);
    expect(read(logs, "run.log")).toContain('"status":"accepted"');
    expect(read(logs, "run.log")).not.toContain("SECRET_NOT_FOR_LOGS");
    expect(JSON.parse(read(logs, "run.json")).usage.calls).toBe(2);
  });
});
