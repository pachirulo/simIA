# Gazette front-page decisions — 2026-09-16

Status: implemented in [PR #1](https://github.com/pachirulo/simIA/pull/1); not yet released.

## Why this changed

The Gazette could turn a thin or ambiguous daily record into confident new prose. Its previous editor received the 16 highest-importance events and wrote an entire paper, including headlines, notices and dates. That gave the model room to add unsupported facts and let several related events crowd out other news. The presentation also made the lead and smaller items feel like a feed rather than a newspaper front page.

## Decisions

| Decision | Reason and consequence |
| --- | --- |
| Keep one lead and up to four secondary stories. Give the lead the largest headline and image, then place briefs, notices and standing columns around it. | A front page needs a clear hierarchy. Four briefs are a maximum, not a quota; a quiet day may print fewer. |
| Let the model choose numeric story IDs only. Build the published date, weather, headline, body, notices and columns in the engine. | Editorial ranking can still vary with the day's news. A model response cannot insert a new factual sentence into the edition. Invalid IDs are ignored; an editor failure falls back to deterministic ranking. |
| Admit event kinds to the paper through an explicit allowlist, limited to the edition day and importance at least 0.3. Require a public place for sensitive speech and exchanges; hide `agent.became` from the street moments and events feed too. | A newly added private event kind cannot enter the paper by default. Private thoughts, letters, plans, personal identity changes and free-form action claims are excluded. A proposal or quote remains a recorded proposal or quote, not proof that its contents are true. |
| Group related events before ranking stories, including a fire and its gathering, and council proceedings. Lower the rank of a routine council gathering. | One incident should not fill several brief slots or displace a more consequential event. The grouping is heuristic and may need refinement as new event kinds appear. |
| Attach source event IDs to each new story and link them to public moments. Derive the scene from the selected lead. | A reader can inspect what the edition used, and the picture follows the lead instead of an unrelated high-scoring event. Older stored editions remain readable without source IDs. |
| Distinguish `agent.do_attempt` from `agent.do_outcome` in new records, while retaining the legacy `agent.do` protocol value. Keep both new kinds out of the Gazette. | An attempted action must not read as an achieved result. Even a judged outcome can contain model-authored details that the world state does not independently confirm. |
| Use the same light paper and dark ink in both site themes, with a mobile column layout. | The front page needs a stable newspaper identity and readable contrast. |

## Evidence checked

- A controlled test makes a false model draft claim that the inn has a new owner and changes the date. The printed edition retains the recorded fire, correct date and source ID instead.
- Tests cover private-event exclusion, fire/council grouping, source ordering and the distinction between free-form attempts and outcomes.
- Engine, cognition, server and web typechecks passed. Engine, cognition and server test suites passed. The front page was visually checked at desktop and mobile widths, including dark mode.

## Limits and follow-up decisions

1. **The event record itself is not a truth oracle.** This change stops the newspaper editor from adding facts; it does not prove that a recorded speaker was truthful or that every model-authored event text matches world state. Keep unverified free-form outcomes out until they have state-backed evidence.
2. **The old raw record route is still public.** `/api/record/:day` returns the complete sealed event record, including private event text. The seal checks record integrity, not factual truth or privacy. Decide how to offer a public audit without exposing private events before claiming end-to-end privacy.
3. **Past editions are immutable.** The new page layout displays them, but their content and source data are not recomposed. The sourcing rules apply to future editions. Do not silently rewrite published editions; any correction policy should be explicit and visible.
4. **Measure the page after real use.** Review whether the grouping combines unrelated events, whether routine items still become leads, and whether readers can distinguish reported speech from verified outcomes. Adjust the grouping and ranking with examples from actual editions.
