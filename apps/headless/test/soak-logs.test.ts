import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const entry = new URL("../src/soak.ts", import.meta.url);
const engine = new URL("../../../packages/engine/src/index.ts", import.meta.url);
const directories: string[] = [];
function run(mode: "completed" | "failed" | "interrupted") {
  const directory = mkdtempSync(join(tmpdir(), "simia-soak-logs-")); directories.push(directory);
  const out = join(directory, "run"), bootstrap = join(directory, "bootstrap.mts");
  // Controlled failure/signal after a real tick; engine source stays untouched.
  writeFileSync(bootstrap, mode === "completed" ? `await import(${JSON.stringify(entry.href)});` : `
    import { Town } from ${JSON.stringify(engine.href)};
    const tick = Town.prototype.tick;
    Town.prototype.tick = async function () {
      await tick.call(this);
      ${mode === "failed" ? 'throw new Error("Controlled tick failure");' : 'process.emit("SIGINT");'}
    };
    await import(${JSON.stringify(entry.href)});
  `, "utf8");
  const args = [require.resolve("tsx/cli"), bootstrap, "--brain", "mock", "--days", "1", "--agents", "2", "--tick", "60", "--seed", "853", "--out", out];
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 20000, cwd: fileURLToPath(new URL("..", import.meta.url)) });
  expect(result.error).toBeUndefined();
  return { result, args, out, read: (name: string) => readFileSync(join(out, name), "utf8") };
}
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });

it("CLI saves a completed mock run and refuses a second run in the same directory", () => {
  const { result, args, out, read } = run("completed");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(`Run files: ${out}`);
  const metadata = JSON.parse(read("run.json")), events = read("events.jsonl").trim().split("\n");
  expect(metadata).toMatchObject({ status: "completed", config: { brain: "mock", seed: 853 }, events: events.length });
  expect(JSON.parse(read("summary.json")).events).toBe(events.length);
  expect(read("run.log")).toContain("While you were away");
  const loggedEvents = read("run.log").split("\n").filter(line => line.startsWith("  event ")).map(line => JSON.parse(line.slice(8)));
  expect(loggedEvents).toEqual(events.map(line => JSON.parse(line)));
  for (const name of ["run.json", "summary.json", "construction.json"]) {
    expect(read(name).trim().split("\n")).toHaveLength(1);
    expect(() => JSON.parse(read(name))).not.toThrow();
  }
  expect(read("dialogue.jsonl").trim().split("\n").map(line => JSON.parse(line)).every(event => Array.isArray(event.dialogue))).toBe(true);
  const before = read("events.jsonl");
  const repeated = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 20000 });
  expect(repeated.status).not.toBe(0);
  expect(repeated.stderr).toContain("fresh --out");
  expect(read("events.jsonl")).toBe(before);
  expect(JSON.parse(read("run.json"))).toEqual(metadata);
}, 30000);

it.each(["failed", "interrupted"] as const)("CLI preserves a partial run with status %s and a nonzero exit code", mode => {
  const { result, out, read } = run(mode);
  expect(result.status).toBe(mode === "failed" ? 1 : 130);
  expect(JSON.parse(read("run.json"))).toMatchObject({ status: mode, events: expect.any(Number) });
  expect(read("events.jsonl").trim().length).toBeGreaterThan(0);
  expect(read("run.log")).toContain(mode === "failed" ? "Controlled tick failure" : "SIGINT");
  expect(existsSync(join(out, "summary.json"))).toBe(false);
}, 30000);
