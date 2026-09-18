// Opt-in benchmark observer. Does not log headers or alter request/response bodies.
// Captures simulated prompts locally; do not use with private production contexts.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const output = process.env.UW_CAPTURE_REQUESTS;
if (output) {
  const file = resolve(output);
  mkdirSync(dirname(file), { recursive: true });
  const original = globalThis.fetch;
  let sequence = 0;
  globalThis.fetch = async function (url, init) {
    if (String(url) !== "https://openrouter.ai/api/v1/chat/completions") return original(url, init);
    const id = ++sequence;
    appendFileSync(file, JSON.stringify({ phase: "request", id, body: JSON.parse(String(init.body)) }) + "\n");
    try {
      const response = await original(url, init);
      const body = await response.clone().text();
      appendFileSync(file, JSON.stringify({ phase: "response", id, status: response.status, body }) + "\n");
      return response;
    } catch (error) {
      appendFileSync(file, JSON.stringify({ phase: "error", id, error: String(error) }) + "\n");
      throw error;
    }
  };
}
