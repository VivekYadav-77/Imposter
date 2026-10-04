# Instructions for AI agents working in this directory

These instructions apply to every file under `android app/`.

## Before editing

1. Read `context/current-state.md` and `context/decision-log.md`.
2. Read the supporting context files linked by `context/current-state.md`.
3. Inspect repository status and preserve unrelated changes.
4. Verify protocol assumptions against `../website/openapi/openapi.json` and `../website/contracts/realtime-v1.schema.json`.

## Scope and behavior

- Work only on the active milestone unless the user explicitly changes scope.
- Do not infer unresolved product choices. Record a blocker or obtain the missing decision.
- The server is authoritative for roles, phases, eligibility, progress, ballots, and results.
- Do not copy the website UI, animal avatar assets, animal labels, or website layout measurements.
- Follow the approved presentation and identity decisions recorded in `context/decision-log.md`.
- Never store or expose tokens, private roles, ballots, evidence bytes/URLs, or signed upload data in logs, analytics, navigation, saved state, documentation, or test snapshots.
- Implement small vertical milestones and include failure behavior and tests in the same change.

## Before ending work

1. Run relevant formatting, static analysis, tests, and build checks.
2. Update `context/current-state.md` with verified facts and one concrete next action.
3. Add durable decisions to `context/decision-log.md` without rewriting history.
4. Update `context/requirements-traceability.md` when a requirement becomes verified or blocked.
5. Use `context/handoff-template.md`; never claim unverified work is complete.
