# Current Android implementation state

**Last updated:** 2026-09-28
**Overall status:** Phase 5 role/task/evidence/elimination vertical slice implemented in source; Android compilation and device/E2E verification blocked on local Android SDK license acceptance and a staging API URL
**Active phase:** Phase 5 — private role, tasks, evidence, kills, and meeting calls
**Active plan:** [`../plan/phase-05-role-tasks-evidence.md`](../plan/phase-05-role-tasks-evidence.md)
**Last verified commit:** not recorded
**Android build status:** Platform-neutral compilation, formatting, and 20 host tests pass; Android compilation has not run

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
- [x] Opaque role-seal destination with hold reveal, accessible non-hold alternative, explicit acknowledgement, `FLAG_SECURE`, and immediate reseal on pause/window-focus loss without persisting revealed state.
- [x] Authoritative task-phase UI with deadline display, self identity, crew progress, incomplete-first assignments, difficulty/evidence state, adaptive supporting rail, and life-status explanation.
- [x] Foreground-only camera/system-photo-picker pipeline with scoped capture URI, bounded decode, EXIF orientation correction, metadata-stripping JPEG re-encode, SHA-256 checksum, preview, retry, and cancellation cleanup.
- [x] Upload-intent → exact signed PUT → confirmation → authoritative snapshot/submission processing flow with stable per-step idempotency keys; participant bearer credentials are never sent to signed storage URLs.
- [x] Server-filtered evidence gallery with processing/empty/expired states, short-lived in-memory image loading, full-screen zoom, and capability/ownership/status-gated flag confirmation.
- [x] Capability and server-target-list-driven elimination selection, review, confirmation, current-version command, and stale-conflict closure/refresh.
- [x] Phase 5 API DTOs and operations for upload intents, confirmations, submissions, flags, kills, and redacted signed URL representations.

## Verification

- `./gradlew spotlessApply spotlessCheck :core:data:test` — passed; 20 host tests.
- Phase 4 request-policy tests verify PATCH semantics/idempotency and join-options code normalization/decoding.
- Phase 5 request-policy tests verify exact signed PUT headers/body, absence of participant authorization on storage requests, signed URL/header redaction, and rejection of unsupported upload methods.
- Android app/design-system/session compilation and tests remain blocked because Android SDK Platform 36 and Build Tools 36.0.0 licenses are not accepted/installed.

## Remaining issues

- The product owner/developer must accept the Google Android SDK licenses; Codex cannot accept legal terms on their behalf.
- Phase 2 and Phase 3 source still require compilation, lint, host tests, and device/integration verification after SDK installation.
- A staging backend/base URL is still required for the Phase 3 authenticate → snapshot → reconnect → resync → revoke integration run.
- Set Gradle property or environment variable `IMPOSTER_API_BASE_URL` to an HTTPS staging origin before create/join can run against a backend.
- Phase 4 app unit tests, Compose tests, screenshots, TalkBack traversal, and two-device create/join/lobby E2E remain unexecuted because the Android toolchain is blocked.
- The existing realtime core is not yet wired into the activity-scoped Phase 4 gateway; the lobby currently performs a five-second authoritative snapshot refresh while visible.
- Phase 5 uses five-second authoritative snapshot/submission refreshes; activity-scoped realtime delivery remains unwired.
- The evidence list contract returns no continuation cursor in response metadata, so Android can safely fetch only the contract maximum of 50 visible submissions; true pagination is blocked on a backend contract addition.
- `FLAG_SECURE`, lifecycle resealing, camera/photo picker, foreground cancellation, image memory bounds, full-screen zoom, screenshots, accessibility, and physical-device upload behavior are source-implemented but unverified without Android compilation/device execution.
- Player-called meetings remain intentionally absent because ADR-A-006 is unresolved; Phase 5 does not infer approval from the existing endpoint or capability.
- Phase 0 gameplay decisions ADR-A-005 through ADR-A-009 and ADR-A-011 remain unresolved.

## Next action

Accept the Android SDK licenses in Android Studio SDK Manager or with `sdkmanager.bat --licenses`, install Platform 36 and Build Tools 36.0.0, set `IMPOSTER_API_BASE_URL`, then run `./gradlew quality`; fix compilation/lint/test failures before physical-device privacy/media tests and staging evidence E2E.

## Session handoff

**Date/time:** 2026-09-28 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 5 — private role, tasks, evidence, kills, and meeting calls
**Milestone:** Source implementation of approved role/task/evidence/flag/elimination behavior against the frozen HTTP contract
**Status:** partial; Android and integration verification blocked

### Changed

- `app/src/main/java/com/impostergame/android/gameplay`: privacy state, gateway, foreground media preparation, and gameplay coordination.
- `app/src/main/java/com/impostergame/android/ui/GameplayScreen.kt`: sealed role, adaptive tasks, evidence gallery/preview, and elimination UI.
- `core/data`: evidence/kill DTOs, HTTP operations, and isolated signed-storage PUT client.
- `app/src/test` and `core/data/src/test`: capability rules, ordering, sensitive destinations, and storage request coverage.

### Verified

- `./gradlew spotlessApply spotlessCheck :core:data:test` — passed; 20 host tests.
- `ANDROID_HOME=... ./gradlew :app:compileDebugKotlin` — blocked before compilation by unaccepted Platform 36 and Build Tools 36.0.0 licenses.
- Manual/device check — not run; no installed licensed Android platform or configured staging backend.

### Decisions added

- ADR-A-016 — Lobby settings commit behavior.

### Remaining issues

- Android source compilation, Compose behavior, privacy lifecycle, media processing, accessibility, screenshots, process recreation, realtime delivery, and multi-device consistency remain unverified.
- No staging base URL is configured; blank builds safely surface connection failure instead of attempting an unknown endpoint.
- Player-called meeting UI is blocked by ADR-A-006, and evidence pagination is blocked because the list response has no next cursor.

### Next action

Install/accept the Android 36 SDK components, configure `IMPOSTER_API_BASE_URL`, run `./gradlew quality`, then fix all Android errors before running secure-role and evidence upload tests on a physical device.
