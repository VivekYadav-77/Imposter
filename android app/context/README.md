# Android agent context

This folder is the compact working memory for Android implementation agents. Its purpose is to avoid rereading the entire codebase or previous conversation on every session.

## Files

- [`current-state.md`](current-state.md): the only authoritative summary of what is done, active, blocked, and next.
- [`decision-log.md`](decision-log.md): durable approved decisions and unresolved product questions.
- [`requirements-traceability.md`](requirements-traceability.md): requirement-to-phase/test coverage.
- [`api-contract-map.md`](api-contract-map.md): compact protocol map; the actual OpenAPI/realtime schemas remain authoritative.
- [`handoff-template.md`](handoff-template.md): exact format an agent uses at the end of a work session.

## Update rules

1. Keep `current-state.md` concise—prefer links to code/tests over copied explanations.
2. Mark work complete only after its listed verification command passes.
3. Never rewrite an approved decision silently. Add a superseding decision with reason and approver.
4. Record blockers with the precise missing decision, failing command, or contract conflict.
5. Do not paste secrets, tokens, private role data, ballots, evidence URLs, or user photos here.
6. Update context in the same change as the implementation it describes.
7. Remove stale “next action” text when a milestone completes.

## Fast start for a new agent

Read, in order:

1. `../plan/master-plan.md`
2. `current-state.md`
3. `decision-log.md`
4. the active phase file linked from `current-state.md`
5. only the contract/source files named by that phase

This is sufficient context for normal continuation. Inspect additional code only when the active milestone requires it.
