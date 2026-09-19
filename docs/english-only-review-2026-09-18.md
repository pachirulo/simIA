# English-only cognition and character setup

The supported language for character backgrounds, generated prose and semantic checks is English. Proper names, identifiers and UTF-8 text retain their spelling. This change removes the Spanish adaptations without rolling back the evidence, continuity or repair fixes.

## Repository audit

The audit inventoried 900 repository files, including hidden configuration and untracked source files. Searches covered 496 source, configuration and test text files across `apps`, `packages`, scripts, examples and deployment configuration. Dependencies, generated build output, binary assets and historical run output were excluded from language matching. Matches were inspected rather than treating every accented name as Spanish prose.

The active seed personas, island pack, boarding form, server templates and examples were already English. `personas.ts` and engine/protocol source were left unchanged relative to the start of this task. The recent starting-state correction for the first three seed characters remains in place.

## Changes

- Removed Spanish vocabulary and grammar branches from intent/action matching, physical claims, number words, conditions, commitments, attribution, lodging and repair reconsideration. English checks retain their existing scope, diagnostic codes and receipt requirements.
- Removed the Spanish reported-speech alternative from the public paper context classifier. Its public/private boundary, editorial prompt and schema are unchanged.
- Removed Spanish `once = 11` from numeric normalization. English `once`, explicit occurrence counts and monetary amounts remain distinct.
- Removed the Spanish perfect auxiliary exception for `he`. English unresolved actors such as `he bought bread` still require an explicit actor and their receipt.
- Added the shared instruction to write prose in English and preserve proper names/identifiers to citizen cognition and character depth/child generation, as well as digest, judgement and life prompts. Both model adapters consume these shared prompts.
- Updated boarding guidance to request English character descriptions. Submitted and previously saved character text is not automatically translated or migrated.
- Converted readable OpenRouter console labels to English and timestamps to the explicit `en-GB` 24-hour locale. Structured event keys, completion contents, full-output preservation and logging failure isolation are unchanged.
- Converted synthetic biographies, conversations, memories and regression inputs to English. Tests still exercise source attribution, conditions, purchase/consumption separation, physical negations, lodging/payment distinctions and repair drift. Proper names and Unicode log coverage remain.

There is no automatic language detector, translator or extra provider call. English output is a prompt contract, not a guarantee that an arbitrary external brain or a model can never return another language. The removed Spanish grammar is no longer supported by the semantic validators. Existing free-text records are preserved as supplied.

## Historical evidence

Raw API capture fixtures, `events.jsonl`, `dialogue.jsonl`, `run.log`, saved snapshots and dated investigation reports remain verbatim. These describe previous runs; translating them would misrepresent the evidence. Current documentation supersedes historical statements about bilingual validator support.

The task baseline and its comparison are local ignored artifacts under `packages/cognition/out/english-only-review/`. Baseline source copies use a `.snapshot` suffix so test discovery cannot execute them. `task.diff` separates this task from earlier uncommitted changes.

## Verification

- `pnpm exec turbo run test --concurrency=1`: 604 tests across 87 test files; cognition includes 372 tests and all 30 Kaka regressions.
- `pnpm exec turbo run typecheck --concurrency=1`: eight workspace packages.
- `git diff --check`: no whitespace errors.
- Final language search: no remaining Spanish adaptation matches in the scanned active source/configuration/synthetic-test files. This search is a repository audit, not natural-language identification of arbitrary input.
- No paid model request or new live OpenRouter simulation was made. Provider-path tests use controlled HTTP/SDK responses.

An initial test invocation discovered baseline copies under `out`; they were renamed with the `.snapshot` suffix, and the clean suite was rerun. The final logs are `tests.log` and `typecheck.log` in the local review directory.
