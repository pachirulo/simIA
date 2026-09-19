# Kakados cognition review — 2026-09-18

Scope: `apps/headless/out/openrouter-deepseek-Kakados`, seed 42, three agents, two days, 60-minute tick, OpenRouter `deepseek/deepseek-v4-flash-0731`. English-only runtime and current personas are preserved. This change does not modify engine, protocol, Gazette or personas.

## Evidence and reproducibility

- Original `run.json`, `summary.json`, `run.log`, `events.jsonl` and `dialogue.jsonl` were inspected. Run completed at minute 2880 with 151 events. Provider accounting recorded 52 responses, 233,860 prompt tokens, 12,888 completion tokens and $0.022645754212. These are original-run measurements, not post-change measurements.
- `logContent:false` did not retain full request bodies. All 52 successful generation records were recovered through **read-only** OpenRouter `generation/content` requests. No new completion was purchased. Their original messages and completion strings agree with the logged outputs.
- Important limit: that API returned `input.messages`, **not the original response_format**. The contextual schema is reconstructed from the source and the explicitly empty persistent-desire lists. Do not describe these artifacts as recovered full HTTP bodies.
- `packages/cognition/test/fixtures/kakados-regressions.json` preserves 21 relevant responses, their original messages, call/generation IDs, attempt numbers and run-log line numbers. They include all ten reflection completions. Reflection context retains selected memories, action evidence, original truncated experience text and captured role supplements. Selected experience IDs are joined to the original events for full validator text/metadata; no unselected event is inserted into the reconstructed context.
- Other AgentState fields are fixture defaults, not an exact world snapshot. No final world snapshot was saved. Dialogue reconstruction uses captured public state; unavailable private memories are empty. Individual reconstructed validator results are not full provider/engine replays.
- `pnpm exec tsx packages/cognition/scripts/check-kakados.ts` produces the offline schema/semantic results. An optional source-directory argument compares earlier validators with the same evidence. Local raw captures, request transcripts, snapshots and comparisons are under `packages/cognition/out/kakados-review-20260918/` (ignored artifacts).
- Before edits, the same 21 outputs were compared against the source snapshot immediately before English-only cleanup. **All 21 semantic diagnoses matched.** `english-comparison.json` records that check. The bugs below were English grammar coverage gaps already present before the cleanup, not evidence that Spanish removal caused them.

## Findings by requested case

### 1. Specific intent accepted as bare trade

**Confirmed model error and undetected intent/action contradiction.**

`519a23a8/1` (Rosa, log line 125, day 1 minute 780) returned `{"kind":"trade","with":"market"}` while saying “I am buying a bread and a fish…”. Her perception listed both products; engine event **42** bought bread only. The previous intent parser omitted progressive “I am buying”, and the item checker examined only the first coordinated product. One buy field cannot execute two purchases.

`0faf0550/1` (Rosa, line 158, minute 960) returned bare trade at the inn while saying **bread**, specifically “I am at the inn and hungry, so I buy a bread…”. Event **52** bought bread. That happens to match the default, but the explicit item was absent from the command. The checker did not recognize this causal prefix.

**The claimed soup trade is not present in Kakados.** Across the recovered outputs, Rosa's soup reference is a `say` action about considering soup, not an immediate soup purchase. Event 52 and its saved `because` say bread. A soup/bare-trade negative test is clearly labeled a derived counterfactual.

Fix: recognize those direct progressive/causal forms, require the explicit item, and reject multiple immediate products even if one is placed in `buy`. The model must choose one immediate purchase and defer the other. Existing concrete repair examples still specify `action.buy`; no field is silently filled or executed. Bare trade without a specific item remains valid under the unchanged engine default.

### 2. Selected work/hire/pay receipts rejected

**Confirmed false rejections: evidence selected but not recognized.**

| Call / attempt | Original rejected wording | Selected evidence | Cause and correction |
|---|---|---|---|
| `7cd1d78e/1`, Petar day 1 | “I went straight to the market and then to Ilić's bakery, where they took me on as cook for 3 coins a shift” | Moves **8, 12**, hire **18**, observed employment/rate at minute 480 | `took` was interpreted as inventory transfer inside a compound. Expand only this bounded passive hiring construction into two movements and hiring, checking each receipt, role, place and rate. Unnamed “they” does not become a named employer. |
| `2403ad74/1`, Ivana day 1 | “Bought and ate two loaves of bread” | Purchases **39, 58**, consumption **43, 64** | “two loaves” was treated as literal object tokens. Count distinct purchase and consumption event IDs separately; duplicated evidence is not another loaf. |
| `3e821e89/1`, Rosa day 2 | “Started the day getting hired as help at the inn” | Hire **85**, wage **123**, observed employment at minute 1800 | Introductory wording polluted the subject. Normalize this narrow passive construction; retain role/place verification. |
| `77fc940d/1`, Petar day 2 | “Worked a full shift at the bakery and got paid 3 coins” | Wage **105**, paid 3 for a cook shift | “full shift” became an object; “got paid” did not start a separate finite clause. Recognize the shift phrase and split the wage clause. |
| `22e96db5/1`, Ivana day 2 | “Worked the morning shift at Ilić's bakery for 3 coins” | Wage **106**, move **96** to the bakery | “morning shift” became an object. Match the workplace name to its ID through selected observation/move metadata, not a hardcoded world catalogue. |

The related “The bakery paid me fairly for a day's work” is recognized as incoming wages only if an actual personal `agent.work` receipt states payment at that workplace. A hiring receipt, another payer, wrong amount or another actor does not pass. The possessive shop name never proves who owns it or who hired someone.

These changes do not establish every detail in a longer output. Remaining compound/anaphoric limitations are listed below. No global relaxation of physical validation was made.

### 3. Ivana's purchase plus consumption

**Evidence not selected; rejection justified relative to the supplied decision evidence.**

`1afd4c75/1` (line 139, day 1 minute 900) remembered “I ate the bread I bought at the market, so I am not starving.” Event **39** bought bread at minute 720; **43** ate bread at minute 780. Both happened before this call, at the market, for Ivana.

However, the request contains purchase **39**, and **no agent.eat receipt**. The purchase comes from the existing `foodLessons` projection in `decisionEvidence`. The unchanged `use` engine path emits `agent.eat` but does not create an equivalent persistent observed memory/food-lesson consumption receipt. `Brain.decide` receives perception and AgentState, not the world's event stream. This is a boundary/selection gap, not an included receipt ignored by the validator.

Inventory, hunger or the proposed action cannot safely manufacture the missing event. Also, “ate bread” plus “bought bread” and “ate the particular bread I bought” are different assertions. The relative object linkage remains conservative; no general `it/the bread I bought` equivalence was introduced. Tests distinguish purchased from consumed and assert that event 43 was absent from this actual request.

The second response removed the unsupported consumption and then hit the prepaid-lodging false rejection below. Thus the **final fallback of this call was unnecessary**, even though rejecting its first response was justified with the selected evidence.

### 4. Remaining prepaid lodging

**Confirmed false rejection of state, followed by an unnecessary fallback.**

`1afd4c75/2` (line 144) says “I have a paid night at the inn remaining, but I have not yet rested there today.” The original perception has `housing:{kind:"inn",nights_left:3}`. The grammar did not recognize indefinite `a paid night`, and the trailing `remaining` could become part of a place name.

“A paid night” asserts that accommodation is available; it does not necessarily claim an exact remaining total of one. It is supported with one or three nights, not zero. In contrast, **“one night left”** is an explicit count and must match. That distinction is now covered in intent, remember, summary, intentions and project progress. `prepaid` wording, trailing `remaining` and captured implicit first-person totals are recognized consistently.

“I paid for a night” and “coins left after paying for lodging” still require a payment receipt. No sleep transition or initial prepaid state creates that receipt. The complete original repair now passes with its original three-night perception.

### 5. Move now, buy later

**Confirmed false intent mismatch, with a separate valid rejection still present.**

`4b4f3127/1` tried to use bread without carrying it: correctly rejected. Its second response (line 163) proposed `move -> market` and said “Moving to the market is the first step; I'll buy bread once I'm there.” The parser missed `Moving to` and selected the later `I'll buy` as the immediate action.

Fix: recognize the stated movement as the first operation. The original full second response still remembers eating without a selected consumption receipt, so it remains rejected for that independent reason. Its fallback is not rendered unjustified merely by fixing the intent diagnosis. Tests also reject executing the later trade now or moving when the first explicit operation is buying now.

### 6. Semantic repair introduces schema failures

**Confirmed repair schema regressions.**

- `7cd1d78e/2` (line 234): new desire with `state:"set_aside"`, although the call has no persistent desires and requires new desires to start `active`.
- `77fc940d/2` (line 391): desire `id` values copied from event IDs and three updates, although `id` is unavailable and the limit is two updates.

The original first responses were schema-valid after existing optional-field normalization. Their repairs changed structural content while attempting to correct prose. The prompt first stated the contextual rule, then advertised `active|set_aside|fulfilled` generically. Semantic repair supplied the issue but did not repeat the contextual schema or previous desire structure.

Fix: render the allowed state list consistently; on both semantic and schema repair, reiterate the actual contextual desire schema, separate event IDs from desire IDs, and retain a small snapshot of the prior valid desire structure. This is a prompt correction, **not proof the live model will comply**. Tests capture the outbound repair, accept a valid corrected response, and continue to reject the actual invalid repair with no silent deletion of IDs/state and no third attempt.

### 7. Pronouns and greetings

`3e821e89/2` (line 376), “we only exchanged greetings”: **false rejection**. `exchanged` was classified as physical trade, followed by an unresolved-actor rejection. A terminal `exchanged greetings` is now treated as social language. An accompanying exchange/gift of bread still needs actor and physical evidence. No general resolution of `we` was added.

`22e96db5/2` (line 404), opinion about Petar, “He gave me work at the bakery”: **model error; rejection correct, diagnostic incomplete**. `opinions.about` suggests that “He” means Petar, but this does not establish the deed. Ivana's hire event **50** names Ivana and the job, not Petar as hirer. Petar is another cook. Even explicitly writing “Petar Ilić gave me work” remains unsupported. No convenient substitution of the narrator or shop owner was implemented.

### 8. Invented local details and provenance

Conversations **24** (`1315b15b`), **31** (`5c551d63`) and **114** (`5e9b2934`) introduce flooding, leaks, a damp patch, shutters, a busy smithy and supposed repairs. The lines exist in both original completions and executed conversation/dialogue logs. Some speakers present inventions confidently; the events prove they said them, not that the details exist.

Their generated outcome memories retain speakers/reporting such as “Ivana said”, “she mentioned”, “I asked” or “her own guess”. The next reflection request labels conversation text as reported speech. Source extraction excludes these lines, even when stored inside a conversation event or an observation containing a quotation, from physical receipts. Regressions preserve this behavior and allow fictional speech.

There **are attempted unqualified claims** in rejected reflection outputs: an unpatched council leak, a backed-up smithy, and a slick inn floor in insights/beliefs. All six original reflections ultimately used fallback; none of these rejected model reflections persisted. Original fallback events **74–76, 146, 147, 149** are safe fallback text or explicitly source-labeled personal records. No verified repair/damage receipt or persisted model reflection confirming those claims was found.

Limit: the validator does not exhaustively recognize every unmodeled-world assertion or loss of attribution in free prose. Accepting a reflection in this offline comparison does not certify all of its insights as independently observed. Beliefs/reflection remain interpretation sources, never physical receipts. This remains a provenance/wording limitation, not grounds to ban rumor or fictional dialogue.

### 9. Provider, JSON, schema and fallback accounting

Original run: **10 fallback calls** — two decisions, two dialogues, six reflections. There were zero model reflections accepted, but not six identical causes.

| Category | Original evidence | Interpretation |
|---|---|---|
| Provider timeout | `d44a5354`, Rosa day-1 reflection, 90 seconds; `98b64678`, day-2 dialogue, 45 seconds | Two provider failures; justified fallback. No usable completion or generation content was available for those timed-out calls. No speculative resubmission was added. |
| Invalid JSON | `aadd7215/2`, line 189, trust deltas written as `0,2` | One syntactically invalid completion. Not a timeout or truncation. Correct rejection and fallback. The first attempt correctly failed rumor direction. |
| Schema mismatch | `7cd1d78e/2`, `77fc940d/2` | Two real schema-rejected responses, including the desire regressions above. Correct rejection of those final responses even where the first semantic rejection was false. |
| Semantic mismatch | 14 response-level log entries | Mixed causes; assessed by call above. This count is not 14 independent false rejections. |
| Optional normalization | Four misleading `rejected (normalized)` lines for `self:null` | Not rejections and not exhausted retries. Normalization continued to schema/semantic validation. Logger now explicitly says normalization; runtime behavior unchanged. |

After the bounded fixes, replay of the ten frozen reflection outputs has **three schema-valid, semantically accepted candidates**: Rosa day 2 attempts 1 and 2, and Petar day 2 attempt 1. These represent **two logical reflection calls**, not three successful new live calls. The original invalid schema repairs remain invalid. Other outputs retain independent unresolved or invalid claims. No live fallback rate or cost improvement is claimed.

### 10. Lodging engine audit — documented separately, no behavior change

`engine.ts`, `sleep` branch: when the character is awake, is at their home and has prepaid nights, decrement `nightsPaid` by one and set `asleep=true`. Repeating sleep while already asleep does not decrement it. The branch has no calendar-day or already-charged-night key. Daytime wake logic can clear `asleep` without an explicit wake event (`10 <= hour < 20`). Midnight itself does not consume a prepaid night.

| Agent | Executed sleep events / absolute minute | Prepaid balance |
|---|---|---|
| Rosa | **59 / 1080** (day 1, 18:00), **93 / 1860** (day 2, 07:00), **141 / 2700** (day 2, 21:00) | 3 → 2 → 1 → 0; event **150** at 2880 says the nights are up; final `home:null`. |
| Petar | **70 / 1260**, **142 / 2760** | 3 → 2 → 1. |
| Ivana | **71 / 1260**, **143 / 2760** | 3 → 2 → 1. |

Current semantics are **three prepaid sleep entries**, not necessarily three calendar nights. Daytime naps can exhaust them early, which conflicts with the ordinary interpretation of “three prepaid nights on arrival”. Sleeping elsewhere does not consume this home's prepaid balance; its own bed/rent rules apply. The regression characterizes two awake-to-sleep transitions on the same day without editing the engine. Deciding a calendar-night policy is separate work.

## Changed files and remaining limits

Runtime changes are limited to cognition:

- `semantics/decision.ts`, `semantics/intent.ts`: direct purchase forms, multiple-product check and immediate movement.
- `semantics/evidence.ts`, `semantics/lodging.ts`, `context/reflection-evidence.ts`: bounded physical paraphrases, distinct food receipts, selected place aliases, employer wage phrasing and prepaid state.
- `context/reflect.ts`, `schema/reflection.ts`, `provider/openrouter.ts`: consistent contextual desire rules during generation and repair.
- `provider/logging.ts`: normalization is no longer reported as rejection.

Added: `test/kakados-regressions.test.ts`, `test/fixtures/kakados.ts`, `test/fixtures/kakados-regressions.json`, `scripts/check-kakados.ts` and this report. Existing dirty changes from earlier work were preserved.

Remaining limits:

1. Decision context still cannot select the missing consumption receipt from an event stream it does not receive. No guessed event was injected.
2. Some longer phrases still produce false/ambiguous rejections: `ate it later`, `hired on as cook there`, `Took the cook shift ... starting at six`, and the purpose-qualified arrival in Ivana's identity update. Shift ordinals and compound project descriptions are also not fully covered. This patch does not claim general English understanding or general pronoun resolution.
3. Free-form world claims can lose explicit attribution in proposed insights/beliefs; they remain interpretation rather than physical evidence, but exhaustive claim-level attribution is not implemented.
4. Real provider adherence to the repaired prompts requires another controlled live run. Mock-provider tests prove request construction and rejection boundaries, not live model success.
5. Prepaid lodging charging remains the current engine behavior described above.

## Verification

The dedicated regression suite contains 28 tests grounded in the captures or explicitly marked counterfactuals. It covers item specificity, multi-item intent, selected hire/work/pay, amount/actor/place negatives, distinct food receipts, missing consumption evidence, lodging state versus payment, move-first intent, social versus physical exchange, schema repair preservation/rejection, quoted-world provenance, normalization logging and unchanged sleep charging. Existing Kaka continuity/denial/trade regressions remain in the full cognition suite.

| Check | Result |
|---|---|
| Dedicated Kakados regression suite | 28 passed |
| Cognition suite, executed during `pnpm test` | 400 passed, 27 files |
| Final `pnpm test` | 632 passed, 88 files across cognition/engine/server/web/store/headless |
| `pnpm typecheck` | 8 tasks successful |
| `git diff --check` | Exit 0; no whitespace errors |
| Byte comparison with pre-review snapshot | All 20 protected engine/protocol/persona source files unchanged; no changes to Gazette/paper source |

The first full test run overlapped with typechecking and hit the existing 20-second `spawnSync` deadline in the headless CLI smoke test (`ETIMEDOUT`); cognition passed all 400 tests in that run. After typecheck finished, rerunning `pnpm test` passed the CLI test and the full suite. No timeout, test assertion or engine behavior was changed to make it pass. Logs are `tests-all.log`, `tests-all-final.log`, `typecheck.log`, and `scope-check.json` in the local audit directory.
