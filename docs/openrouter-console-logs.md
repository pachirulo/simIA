# OpenRouter console and simulation logs

## Files written by headless

`pnpm --filter @unwatched/headless soak` writes logs to `--out` and prints the absolute destination at startup. With `pnpm --filter`, `--out out/name` means `apps/headless/out/name/`; the default is `apps/headless/out/`. Use a new directory for each run: existing artifacts, including partial logs, are protected against overwriting.

| File | Contents |
| --- | --- |
| `events.jsonl` | Every emitted world event, one JSON object per line, including its payload. |
| `dialogue.jsonl` | Confirmed speech, with full text, resolved speakers and event IDs. |
| `run.log` | Headless console output: events, responses, diagnostics, repairs, dialogue and progress. External pnpm/Node output is not captured. |
| `run.json` | Run status, non-secret configuration, dates, reached minute, event count and accumulated OpenRouter usage. |
| `summary.json` | Summary of a normally completed simulation. |
| `construction.json` | Final construction state after normal completion. |

`run.json` starts as `running` and finishes as `completed`, `failed` or `interrupted`. A write failure produces `logging_failed`, a warning and a nonzero exit; it does not trigger another model request. Ctrl+C requests shutdown after the current tick, preserving partial files. Pending OpenRouter metadata is drained before closing the log. A forced termination can leave `running`, which does not prove completion. Synchronous writes do not guarantee recovery after power loss or a full disk.

World events also appear in `run.log` as `event {...}`, without an event-type filter. Proposals are never logged as completed world actions. JSON records use compact serialization; newlines inside strings remain escaped and recoverable. Historical files are not rewritten.

## Readable console format

Console labels are English, with a 24-hour `en-GB` timestamp. Each line identifies the citizen, logical call, operation and attempt. Response lines include provider, prompt/completion tokens, cached tokens, cost, local duration, finish reason, generation ID and the complete completion.

```text
[LLM 23:30:00 ag_1 a1b2c3d4] action_proposal | calling deepseek/deepseek-v4-flash-0731 · attempt 1 · HTTP 1
[LLM 23:30:02 ag_1 a1b2c3d4] action_proposal | DeepInfra · tokens 2177 input / 41 output · cache 0 · $0.000138 · 2.0s · finish=stop · Completion (attempt 1, id=gen-example): {"action":{"kind":"use","item":"bread"},"remember":[]}
[LLM 23:30:02 ag_1 a1b2c3d4] action_proposal | valid proposal: {"kind":"use","item":"bread"}
```

This is an illustrative example. Only validation summaries are shortened with `…`; completions are never truncated. The completion is logged before normalization and validation, including rejected responses. Non-JSON or incomplete output is encoded as a JSON string, so `JSON.parse` recovers the original text. Readable mode omits prompts, schemas and full provider envelopes. Acceptance by cognition does not establish engine execution.

## Structured diagnostics

Set `UW_OR_LOG_CONTENT=1` to emit `openrouter <event> {...}`. The server adds its `[town]` prefix. Full text is retained, including escaped newlines.

| Event | Contents |
| --- | --- |
| `request` | Exact POST body: messages, repairs, response schema, model, limits and parameters; no authentication headers. |
| `response` | Generation ID, provider, finish reason, local duration, tokens, cache, cost, usage and raw response before validation. |
| `validation` | Status, reason and whether repair follows. Accepted output includes the normalized value; dialogue adds complete ordered `dialogue: [{speaker, text}]` without outcome fields. |
| `generation` | Metadata fetched by generation ID, plus the OpenRouter log link. Original field names and nulls are preserved. |
| `generation_unavailable` | Missing ID, unavailable metadata or full logging queue; this is not a model fallback. |
| `repair_comparison` | Whether the repair preserved or reconsidered the choice, or drifted, with changed fields. |
| `http_error` / `transport_error` | Correlated HTTP or transport failure and duration. |

`callId` groups a logical operation; `agentId`, `kind`, `model` and `slot` identify its context. `attempt` identifies response/repair attempts, while `httpAttempt` identifies transport retries. Response `id` links to that generation.

Normalized `tokens_prompt/completion`, native `native_tokens_*`, cache counts, discounts, final cost and provider latency remain separate metrics. Local `durationMs` is not provider generation time. Metadata is read from OpenRouter's generation endpoint using the same key and generation ID. Exact requests and responses are captured locally in structured mode; readable mode retains completions but not the sent prompt.

## Reading confirmed dialogue

Accepted cognition dialogue appears in validation logs as `dialogue=[...]`. It can still contain speaker aliases and does not establish execution. Confirmed world speech is emitted by the server as `[town] dialogue {...}` and by headless as `dialogue {...}` plus `dialogue.jsonl`.

```text
[town] dialogue {"eventId":42,"minute":600,"kind":"conversation","dialogue":[{"speakerId":"ag_1","speaker":"Inés Vidal","text":"Did you bring the bread?"},{"speakerId":"ag_2","speaker":"Pedro Ibáñez","text":"Not yet."}]}
```

The extractor uses structured conversation lines and the engine's literal speech envelope. Internal `agent.say` variants for approaches, writing and nicknames are excluded, as are rejected actions. Memories never reconstruct dialogue. Names retain their Unicode spelling.

From the repository root, use the actual run directory:

```powershell
Get-Content -LiteralPath .\apps\headless\out\openrouter-deepseek-Kaka\dialogue.jsonl -Wait |
  ForEach-Object {
    ($_ | ConvertFrom-Json).dialogue | ForEach-Object {
      '{0}: {1}' -f $_.speaker, $_.text
    }
  }
```

The server writes diagnostics to the console. To retain them, use a new file per session:

```powershell
pnpm --filter @unwatched/server start 2>&1 | Tee-Object -FilePath .\server-run.log
```

Server state persistence is not a model-response log. Older runs that never captured diagnostics cannot be reconstructed by this logger.

## Configuration and failure isolation

```dotenv
UW_OR_LOG_CONTENT=0
UW_OR_LOG_GENERATION=1
```

These defaults apply when a logger exists. `logContent` and `logGeneration` options override the environment. Without a logger, no generation lookups are made. Setting `UW_OR_LOG_GENERATION=0` disables extra GETs while preserving immediate response metrics. Restart running processes to load changes.

Generation metadata is fetched asynchronously: up to four GETs, with delays of 0, 1, 4 and 12 seconds, a five-second request timeout and at most 32 pending generations per local provider. Temporary 404/429/5xx and transport errors have bounded retries. Logging failures never repeat model POSTs, call `onUsage`, add costs again or trigger fallback.

`await brain.flushLogs()` drains pending metadata with a 40-second limit. Headless calls it before closing `run.log`, including failed and interrupted runs. Retry timers alone do not keep a process alive. Full structured logs contain private character context supplied to the model; authentication headers and API keys are not inserted into logged bodies or exposed to the newspaper.

## Verification

Run `pnpm --filter @unwatched/cognition test`, `pnpm --filter @unwatched/headless test` and `pnpm --filter @unwatched/server test`. Coverage includes complete UTF-8 output, rejected/repaired responses, metadata retries, correlation, disk failure, file protection, and normal/failed/interrupted CLI runs.

Historical initial live logger evidence remains under `out/openrouter-console-logging/`: generation `gen-1789698593-g1gkQmXIoo2bPlxgXECw`, DeepInfra, 2,177 prompt tokens, 41 completion tokens and USD 0.000138. Metadata appeared about 18 seconds after the response; the decision did not wait. This verified logging, not citizen behavior.

Implementation: `packages/cognition/src/provider/logging.ts` owns presentation, enrichment and failure isolation; `provider/openrouter.ts` emits records at request, response and validation boundaries. No new dependencies are required.
