# Android implementation plan index

This directory is the execution guide for the native Android client of Imposter Game. It contains planning only; creating these files does not begin Android implementation.

## Required reading order for an AI implementation agent

1. Read [`master-plan.md`](master-plan.md).
2. Read [`../context/current-state.md`](../context/current-state.md).
3. Read [`../context/decision-log.md`](../context/decision-log.md).
4. Read only the active phase file named in `current-state.md`.
5. Read the repository contracts linked from that phase; do not infer protocol behavior from the web UI.
6. Implement one small milestone, verify it, and update the context files before stopping.

## Phase files

| Phase | File | Outcome |
|---|---|---|
| 0 | [`phase-00-contract-alignment.md`](phase-00-contract-alignment.md) | Product and API contradictions are resolved before code exists. |
| 1 | [`phase-01-foundation.md`](phase-01-foundation.md) | Reproducible Kotlin/Compose project and enforceable architecture. |
| 2 | [`phase-02-design-system-adaptive-ui.md`](phase-02-design-system-adaptive-ui.md) | Accessible, adaptive UI foundation and canonical color avatars. |
| 3 | [`phase-03-data-session-realtime.md`](phase-03-data-session-realtime.md) | Safe HTTP, bearer session, snapshots, realtime, and recovery. |
| 4 | [`phase-04-entry-lobby.md`](phase-04-entry-lobby.md) | Create/join/resume and lobby experiences. |
| 5 | [`phase-05-role-tasks-evidence.md`](phase-05-role-tasks-evidence.md) | Private role, tasks, photos, evidence, kills, and meetings. |
| 6 | [`phase-06-meetings-voting-results.md`](phase-06-meetings-voting-results.md) | Discussion, review, voting, results, and replay. |
| 7 | [`phase-07-resilience-accessibility-security.md`](phase-07-resilience-accessibility-security.md) | Production resilience, accessibility, privacy, and security. |
| 8 | [`phase-08-quality-release.md`](phase-08-quality-release.md) | Full verification, performance, release, and operations readiness. |

## Source of truth priority

When sources disagree, stop and record the conflict instead of guessing. Use this priority after Phase 0 decisions are approved:

1. Approved entries in `../context/decision-log.md`
2. `openapi/openapi.json` and `contracts/realtime-v1.schema.json`
3. `docs/CLIENT_INTEGRATION.md`, `docs/API_CONTRACT.md`, and `docs/REALTIME_CONTRACT.md`
4. Android plan files
5. Existing web-client behavior and appearance

The web client is useful as a behavioral example, but it is not the visual reference for Android.
