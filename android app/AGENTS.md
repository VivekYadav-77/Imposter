# Instructions for AI agents working in this directory

These instructions apply to every file under `android app/`.

## Before editing

1. Read `plan/master-plan.md` completely.
2. Read `context/current-state.md` and `context/decision-log.md`.
3. Read the active phase file linked by `context/current-state.md`.
4. Inspect repository status and preserve unrelated changes.
5. Verify protocol assumptions against `../openapi/openapi.json` and `../contracts/realtime-v1.schema.json`.

## Scope and behavior

- Work only on the active milestone unless the user explicitly changes scope.
- Do not begin Phase 1 while `current-state.md` still says Phase 0 is active.
- Do not infer unresolved product choices. Record a blocker or obtain the missing decision.
- The server is authoritative for roles, phases, eligibility, progress, ballots, and results.
- Do not copy the website UI, animal avatar assets, animal labels, or website layout measurements.
- Use the one canonical crewmate vector from `plan/master-plan.md`, tinted with the stable unique player color.
- Never store or expose tokens, private roles, ballots, evidence bytes/URLs, or signed upload data in logs, analytics, navigation, saved state, documentation, or test snapshots.
- Implement small vertical milestones and include failure behavior and tests in the same change.

## Before ending work

1. Run relevant formatting, static analysis, tests, and build checks.
2. Update `context/current-state.md` with verified facts and one concrete next action.
3. Add durable decisions to `context/decision-log.md` without rewriting history.
4. Update `context/requirements-traceability.md` when a requirement becomes verified or blocked.
5. Use `context/handoff-template.md`; never claim unverified work is complete.
