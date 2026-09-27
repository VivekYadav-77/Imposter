# Current Android implementation state

**Last updated:** 2026-09-28
**Overall status:** Phase 4 entry/lobby vertical slice implemented in source; Android compilation and device/E2E verification blocked on local Android SDK license acceptance and a staging API URL
**Active phase:** Phase 4 — entry, create/join, resume, and lobby
**Active plan:** [`../plan/phase-04-entry-lobby.md`](../plan/phase-04-entry-lobby.md)
**Last verified commit:** not recorded
**Android build status:** Platform-neutral compilation, formatting, and 18 host tests pass; Android compilation has not run

## Implemented

- [x] UI-independent JVM `core:data` module and Android `core:session` Keystore adapter registered with the root quality gates.
- [x] Frozen API v1 room/game/session DTOs and strict realtime schema-version dispatch.
- [x] HTTPS-by-default, cancellable OkHttp client with bearer auth, request IDs, bounded timeouts, typed safe errors, `Retry-After`, and allowlisted structured logging.
- [x] Immutable per-command idempotency metadata and bounded transient retry that never replays `409` conflicts.
- [x] AES-256-GCM Android Keystore participant-session storage with expiry, rotation seams, leave/logout clearing, invalidation handling, and fail-closed restore.
- [x] Observable room/game/freshness/connectivity/presence state with single-flight refreshes, full replacement, late-response protection, and state-version gap detection.
- [x] Socket.IO `/realtime` WebSocket-only transport using `auth.token`, heartbeat acknowledgement, bounded reconnect, event handling, resync coalescing, and permanent stop after revocation.
- [x] Server-authoritative bootstrap state machine and host-side tests for contract phases, redaction, retry identity, stale responses, gaps, backoff, revocation, and process recreation.
- [x] Guest-first Home, create, and join screens with saved room code/nickname/color, contract-matching validation, separate age/photo/privacy consent, keyboard actions, and duplicate-submit suppression.
- [x] Join-options lookup, visible code normalization, remaining-capacity feedback, stable idempotency keys, and color-slot race recovery that refreshes availability without clearing other form fields.
- [x] Secure credential persistence after create/join and bootstrap routing directly to lobby, active game, or results when a participant session already exists.
- [x] Adaptive lobby with copy/share code, roster presence/self/host semantics, host-transfer/material-roster announcements, explicit confirmed leave, and compact-height/two-pane composition.
- [x] Host setup checklist, published task-pack selection, bounded duration controls, collapsed advanced summary, explicit Apply, conflict refresh, and sticky Start with locally knowable disabled reasons plus server-authoritative readiness errors.
- [x] Phase 4 HTTP support for join options, task packs, PATCH settings, start, and stable caller-owned create/join idempotency keys.

## Verification

- `./gradlew spotlessApply spotlessCheck :core:data:test` — passed; 18 host tests.
- Phase 4 request-policy tests verify PATCH semantics/idempotency and join-options code normalization/decoding.
- Android app/design-system/session compilation and tests remain blocked because Android SDK Platform 36 and Build Tools 36.0.0 licenses are not accepted/installed.

## Remaining issues

- The product owner/developer must accept the Google Android SDK licenses; Codex cannot accept legal terms on their behalf.
- Phase 2 and Phase 3 source still require compilation, lint, host tests, and device/integration verification after SDK installation.
- A staging backend/base URL is still required for the Phase 3 authenticate → snapshot → reconnect → resync → revoke integration run.
- Set Gradle property or environment variable `IMPOSTER_API_BASE_URL` to an HTTPS staging origin before create/join can run against a backend.
- Phase 4 app unit tests, Compose tests, screenshots, TalkBack traversal, and two-device create/join/lobby E2E remain unexecuted because the Android toolchain is blocked.
- The existing realtime core is not yet wired into the activity-scoped Phase 4 gateway; the lobby currently performs a five-second authoritative snapshot refresh while visible.
- Phase 0 gameplay decisions ADR-A-005 through ADR-A-009 and ADR-A-011 remain unresolved.

## Next action

Accept the Android SDK licenses in Android Studio SDK Manager or with `sdkmanager.bat --licenses`, install Platform 36 and Build Tools 36.0.0, set `IMPOSTER_API_BASE_URL`, then run `./gradlew quality`; fix compilation/lint/test failures before connecting the existing realtime session to the activity-scoped lobby gateway and running the two-device Phase 4 E2E matrix.

## Session handoff

**Date/time:** 2026-09-28 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 4 — entry, create/join, resume, and lobby
**Milestone:** Source-complete entry and lobby vertical slice against the frozen HTTP contract
**Status:** partial; Android and integration verification blocked

### Changed

- `app/src/main/java/com/impostergame/android/entry`: entry/lobby state, gateway, validation, resume, mutation, and refresh behavior.
- `app/src/main/java/com/impostergame/android/ui/ImposterGameApp.kt`: guest entry and adaptive participant/host lobby UI.
- `core/data`: Phase 4 DTOs and join-options/settings/start/task-pack operations.
- `app/src/test` and `core/data/src/test`: validation/readiness and request-contract coverage.

### Verified

- `./gradlew spotlessApply spotlessCheck :core:data:test` — passed; 18 host tests.
- `ANDROID_HOME=... ./gradlew :app:compileDebugKotlin` — blocked before compilation by unaccepted Platform 36 and Build Tools 36.0.0 licenses.
- Manual/device check — not run; no installed licensed Android platform or configured staging backend.

### Decisions added

- ADR-A-016 — Lobby settings commit behavior.

### Remaining issues

- Android source, Compose behavior, accessibility, screenshots, process recreation, realtime delivery, and multi-device consistency remain unverified.
- No staging base URL is configured; blank builds safely surface connection failure instead of attempting an unknown endpoint.

### Next action

Install/accept the Android 36 SDK components, configure `IMPOSTER_API_BASE_URL`, run `./gradlew quality`, then wire and verify activity-scoped realtime lobby snapshot delivery before two-device E2E.
