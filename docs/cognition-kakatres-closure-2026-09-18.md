# Cognition closure: three bounded Kakatres fixes

Reference: `apps/headless/out/openrouter-deepseek-Kakatres`, seed 42, three agents, two days, 60-minute ticks. This review uses local `run.log`, `events.jsonl` and `dialogue.jsonl`; no OpenRouter requests or paid simulation were made. Original completion objects and relevant events are preserved in `packages/cognition/test/fixtures/kakatres-closure.json`. Full original HTTP requests are not claimed to have been recovered.

## 1. Explicit apply changed the requested job

Call `3d246c4a`, Petar, repaired completion at log line 32:

```json
{"action":{"kind":"apply","job":"cook at the bakery"},"intent":"Walking to the bakery to ask Ilić if I can take the cook shift, since today is Sunday and no shifts run, but I can still request the job for tomorrow.","remember":[]}
```

The agent was still at the harbor. Event **10**, minute **420**, hired him as **dock hand**, preserving that bakery intent in `payload.because`.

Cause: `Town.resolveAction` searched local open jobs, then used `(named ?? here[0])`. A failed specific search silently became the first unrelated local opening. The engine validator then validated the substituted dock job, so it could no longer reject the original request.

Change: only `apply` without a job may choose the first compatible opening. An explicit ID retains its identity. An exact title/normalized ID must be unique; a partial local reference must also be unique. Unresolved or ambiguous references remain unresolved for rejection. Remote and full exact jobs retain their identity and fail the existing location/opening checks. No protocol or validator changes were needed.

Regressions cover the actual bakery-to-dock case, exact IDs/titles, unique partial matches, ambiguity, closed positions, remote/unknown references and unchanged generic apply. The only engine production change is this `apply` resolution branch.

## 2. Synthetic fallback invented a public event

After call `3de32c50` failed, event **96**, minute **1980**, recorded Petar saying **“The boat was late again.”** The same line is in `dialogue.jsonl`. Prior boat events in the captured history record docking, not the claimed recurring delay.

Cause: model failure delegated decision-making to `MockBrain.decide`. Its scripted reply list contains that exact boat story, alongside other fictional local statements. The semantic checker deliberately permits ordinary character speech; it is not a complete truth filter for arbitrary dialogue. It therefore cannot make a creative mock policy safe as a provider fallback.

Change: both OpenRouter and Anthropic decision fallbacks now return a fresh `wait` proposal with no memories or invented intent. Reflection fallbacks also use neutral text and empty updates, avoiding the mock's random third-party opinions (for example, low trust becoming a claim of gossip). Existing dialogue fallback already uses neutral greetings, empty memories and no rumor, and remains unchanged. Explicit mock simulations remain available; their behavior was not edited. Gazette was not changed.

This intentionally gives up an interesting synthetic action when a model fails. The next normal decision can resume useful work. Existing fallback markers and OpenRouter's strict `allowFallback:false` behavior are preserved.

Tests force provider failures, make the mock return the real boat line, prove that this mock method is not called, and execute the resulting `wait` through the real engine. No speech, purchase, hire, payment or other world event is emitted. Additional tests cover neutral reflection fallback and Anthropic parity.

## 3. Structural purchase repair was mistaken for intention drift

Call `3de32c50`, Petar, log lines **337–348**:

```json
{"kind":"buy","item":"bread","with":"inn"}
```

was correctly rejected by the canonical schema, then repaired to:

```json
{"kind":"trade","with":"inn","buy":"bread"}
```

The intent was identical in both outputs: “I'll buy bread at the inn to eat now, since I'm hungry and need strength for the day ahead.” Cognition nevertheless reported `repair_intention_drift` for `action.kind`, `action.item` and `action.buy`.

Cause: the comparator compared raw field names. It exempted the discriminator named by the schema error, but treated moving the explicit product from `item` to `buy` as an unrelated change.

Change: **comparison only** recognizes the bounded `buy` → `trade` and `item` → `buy` representation change during schema repair when the intent is unchanged and the product is unambiguous. Optional empty strings use the existing normalization rules. Unknown schema-field removal is still permitted. Raw changed fields remain in diagnostics.

The first invalid response is never coerced into an accepted command or executed. A second, schema-valid model response is still required and goes through all existing decision checks. Product, partner/destination, monetary fields, material operation and an existing desire association remain protected. A different intent does not receive this structural exception. The existing separate policy for explicitly explained reconsideration is unchanged; it is not classified as a faithful repair.

Regressions replay both actual completions, verify acceptance on the second attempt without fallback, and apply the resulting bread purchase at the inn. Negative cases change bread to soup, inn to market or another person, buying to selling/eating/waiting, the desire association or the stated goal. Conflicting `item` and `buy` values also remain rejected.

## Changed files

- `packages/engine/src/engine.ts`: only explicit/generic `apply` resolution.
- `packages/cognition/src/semantics/repair.ts`: bounded structural comparison, preserving canonical validation.
- `packages/cognition/src/fallbacks.ts`: neutral decision and reflection outputs.
- `packages/cognition/src/openrouter.ts`, `packages/cognition/src/anthropic.ts`: use those shared fallbacks.
- `packages/engine/test/apply-resolution.test.ts`: 12 job-resolution regressions.
- `packages/cognition/test/kakatres-closure.test.ts`: 13 structural-repair/fallback regressions.
- `packages/cognition/test/anthropic-semantics.test.ts`: two fallback parity regressions.
- `packages/cognition/test/fixtures/kakatres-closure.json`: exact local completion/event evidence.
- This report.

No general pronoun or language heuristics were added. Gazette, personas, protocol and engine behavior outside `apply` are outside this change. Earlier cognition fixes are retained. The intentionally excluded narrative issues are not prerequisites for closing this phase.

## Verification

| Check | Result |
|---|---|
| New specific regressions | 27 passed: 12 engine, 13 cognition closure, 2 Anthropic parity |
| `pnpm --filter @unwatched/cognition test` | 415 passed, 28 files |
| Engine suite in full test run | 108 passed, 35 files |
| `pnpm test --concurrency=1` | 659 passed, 90 files; all six test tasks succeeded |
| `pnpm typecheck` | All eight tasks succeeded |
| `git diff --check` | Exit 0, no whitespace errors |
| UTF-8/whitespace checks | Passed for all ten added/edited files |
| Source scope comparison | Existing source changes limited to the three cognition files and the engine apply branch listed above; neutral fallback module added separately |

The first parallel full run exceeded the existing 30-second deadline in the five-day engine invariants test. The sequential-package run passed without changing test deadlines or assertions. Typechecking also caught two missing/optional `because` arguments in the new test calls; those test calls were corrected and the full tests/typecheck rerun successfully. Local verification logs and source hashes are in `packages/cognition/out/kakatres-closure/`.

No live provider improvement is claimed. The code phase is closed for these three cases; the next validation step is the user's final manual run.
