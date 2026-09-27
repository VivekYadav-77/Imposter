# Phase 8 — end-to-end quality, release, and operations

## Goal

Prove Android v1 is deployable, observable, recoverable, and supportable—not merely feature complete.

## Automated verification pyramid

- Pure unit tests for mappers, reducers/state machines, countdown formatting, retry policy, redaction, avatar mapping, and validation.
- Repository integration tests using contract fixtures and a controllable fake server/socket.
- Backend staging contract tests for authentication, idempotency, conflicts, uploads, snapshots, and realtime.
- Compose UI tests for every critical journey and authorization variant.
- Screenshot/golden tests for compact portrait, compact landscape, expanded, dark/light, and large font.
- Multi-device end-to-end scenarios for lobby, tasks, kills, meetings, votes, reconnects, and results.
- Release-build tests with shrinking enabled.

## Required end-to-end scenarios

1. Create room, join to capacity subset, configure, start, complete tasks, crew win.
2. Imposter elimination, meeting, tie/skip, resume tasks.
3. Evidence flag, multi-item review, accepted/rejected evidence.
4. Imposters win through approved end condition.
5. Host disconnect/transfer and reconnect.
6. Player rotates/backgrounds/loses network during each phase.
7. Process death followed by secure resume into each authoritative phase.
8. Rate limit, state conflict, session revocation, server restart, and storage failure.
9. Public and private vote/evidence visibility modes.
10. Replay/new-room/terminal-history path approved in Phase 0.

## Release engineering

- Unique application ID/package naming approved by owner.
- Reproducible signed AAB pipeline with keys outside the repository.
- Staging and production endpoints selected by non-secret build configuration.
- Versioning, minimum supported version, API compatibility, and forced-update policy documented.
- R8/proguard rules verified; mapping files stored securely.
- Play integrity/attestation added only if threat model and server support justify it.
- Privacy policy, photo disclosure, data-safety form, permissions declaration, store listing, screenshots, and content rating completed.
- Internal testing -> closed testing -> staged production rollout with stop criteria.

## Operations

- Crash and ANR monitoring with privacy-safe breadcrumbs.
- Metrics for bootstrap success, join success, socket reconnects, resyncs, upload stages, command conflicts, and session revocations—never role/ballot/evidence payloads.
- Dashboards and alert thresholds agreed before rollout.
- Runbook for bad release, backend incompatibility, upload outage, websocket outage, and credential/session incident.
- Rollback and staged-rollout halt procedures tested.
- Support diagnostics expose only safe version/network/request IDs with user consent.

## Final acceptance

- Product owner runs the acceptance game on production-like infrastructure.
- Accessibility and privacy sign-offs are recorded.
- All Phase 0 decisions are satisfied and traced.
- Clean release candidate passes all required checks twice without flaky failures.
- Known limitations are documented in the release notes and context.
- `../context/current-state.md` is marked complete with the released version and commit.
