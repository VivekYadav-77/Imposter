# Current Android implementation state

**Last updated:** 2026-09-27
**Overall status:** Phase 3 implemented in source; compilation and executable tests blocked on local Android SDK license acceptance
**Active phase:** Phase 3 — networking, secure session, snapshots, and realtime
**Active plan:** [`../plan/phase-03-data-session-realtime.md`](../plan/phase-03-data-session-realtime.md)
**Last verified commit:** not recorded
**Android build status:** Platform-neutral Phase 3 compilation and 16 host tests pass; Android compilation has not run

## Implemented

- [x] UI-independent JVM `core:data` module and Android `core:session` Keystore adapter registered with the root quality gates.
- [x] Frozen API v1 room/game/session DTOs and strict realtime schema-version dispatch.
- [x] HTTPS-by-default, cancellable OkHttp client with bearer auth, request IDs, bounded timeouts, typed safe errors, `Retry-After`, and allowlisted structured logging.
- [x] Immutable per-command idempotency metadata and bounded transient retry that never replays `409` conflicts.
- [x] AES-256-GCM Android Keystore participant-session storage with expiry, rotation seams, leave/logout clearing, invalidation handling, and fail-closed restore.
- [x] Observable room/game/freshness/connectivity/presence state with single-flight refreshes, full replacement, late-response protection, and state-version gap detection.
- [x] Socket.IO `/realtime` WebSocket-only transport using `auth.token`, heartbeat acknowledgement, bounded reconnect, event handling, resync coalescing, and permanent stop after revocation.
- [x] Server-authoritative bootstrap state machine and host-side tests for contract phases, redaction, retry identity, stale responses, gaps, backoff, revocation, and process recreation.

## Verification

- `./gradlew spotlessApply spotlessCheck :core:data:test` — passed; 16 host tests.
- Android app/design-system/session compilation and tests remain blocked because Android SDK Platform 36 and Build Tools 36.0.0 licenses are not accepted/installed.

## Remaining issues

- The product owner/developer must accept the Google Android SDK licenses; Codex cannot accept legal terms on their behalf.
- Phase 2 and Phase 3 source still require compilation, lint, host tests, and device/integration verification after SDK installation.
- A staging backend/base URL is still required for the Phase 3 authenticate → snapshot → reconnect → resync → revoke integration run.
- Phase 0 gameplay decisions ADR-A-005 through ADR-A-009 and ADR-A-011 remain unresolved.

## Next action

Accept the Android SDK licenses in Android Studio SDK Manager or with `sdkmanager.bat --licenses`, install Platform 36 and Build Tools 36.0.0, configure the SDK location, then run `./gradlew quality` and fix every compile, lint, and test failure before marking Phase 3 verified.
