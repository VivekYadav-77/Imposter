# Current Android implementation state

**Last updated:** 2026-09-28
**Overall status:** Phase 7 automated resilience/privacy/security hardening implemented in source; core host tests pass, while Android compilation, device matrices, performance profiling, security review, and moderated usability remain blocked or unperformed
**Active phase:** Phase 7 — resilience, accessibility, privacy, and security hardening
**Active plan:** [`../plan/phase-07-resilience-accessibility-security.md`](../plan/phase-07-resilience-accessibility-security.md)
**Last verified commit:** not recorded
**Android build status:** Platform-neutral formatting and 26 core host tests pass; Android compilation stops before source compilation because SDK Platform 36 and Build Tools 36.0.0 licenses are not accepted

## Implemented through Phase 6

- Guest create/join, adaptive lobby and host setup, secure session resume, authoritative snapshots/retry/reconnect core, private role reveal, task/evidence flow, authorized flag/elimination, meetings/review/voting, and terminal results are source-implemented.
- Credentials use Android Keystore AES-256-GCM and non-backed-up private preferences. Gameplay is server authoritative; idempotency keys stay stable across a command retry and `409` conflicts refresh rather than replay.
- Evidence uses foreground-only preparation/upload, scoped capture files, orientation normalization, metadata-free JPEG re-encoding, signed PUT without participant authorization, and short-lived in-memory previews.

## Phase 7 source hardening implemented

- [x] Production manifest/network policy prohibits cleartext, disables backup/device transfer, and protects all gameplay windows from screenshots/recent previews; API 31+ gameplay also hides non-system overlays.
- [x] Copied room codes are marked clipboard-sensitive and an unchanged clip is cleared after 60 seconds.
- [x] API JSON bodies are bounded to 2 MiB (64 KiB for errors); server error text/request IDs/codes are normalized and bounded, raw error details are not rendered, and display DTO text is sanitized for controls/bidirectional overrides.
- [x] Token, role, ballot, evidence checksum/bytes, signed URL/header, and room/session DTO string representations are redacted where private values could otherwise be dumped.
- [x] Signed upload redirects are disabled; payloads remain JPEG-only and bounded to 5 MiB while server-authorized storage headers are preserved exactly.
- [x] Selected evidence is bounded by source bytes, source dimensions/pixels, decoded dimensions, re-encoded bytes, preview bytes, MIME type, and preview dimensions/pixels.
- [x] Command launch guards close the pre-coroutine double-tap race; older game snapshots cannot replace a newer `stateVersion`.
- [x] Lobby/game refresh failure exposes Offline/Reconnecting state without removing already-readable authoritative content.
- [x] Countdown accessibility text changes at minute, under-one-minute, and expiry boundaries rather than describing every second; English quantity wording no longer uses “(s)”.
- [x] [`phase-07-hardening.md`](phase-07-hardening.md) records the threat model, cleanup behavior, budgets, lifecycle/network matrix, accessibility matrix, and unperformed external validation.

## Verification

- `./gradlew.bat --no-daemon --no-configuration-cache --no-parallel '-Pkotlin.compiler.execution.strategy=in-process' spotlessApply spotlessCheck :core:data:test` — passed; 26 tests, 0 failures.
- `git diff --check` — passed.
- `ANDROID_HOME=C:\Users\Hp\AppData\Local\Android\Sdk ./gradlew ... :app:compileDebugKotlin :app:testDebugUnitTest` — blocked before source compilation: licenses for `build-tools;36.0.0` and `platforms;android-36` are not accepted.

## Remaining issues

- The product owner/developer must accept Android SDK legal terms; Codex cannot accept them on the user's behalf. App/design-system/session compilation, lint, Compose tests, screenshots, and device tests remain unverified.
- A staging HTTPS `IMPOSTER_API_BASE_URL` is required for authenticate → snapshot → reconnect → resync → revoke and multi-device command-race tests.
- The activity-scoped realtime session is not yet wired to feature gateways; visible lobby/game screens use a five-second authoritative polling fallback.
- Manual Phase 7 lifecycle/network, TalkBack, Switch Access/keyboard, 200% font/display-size, theme/contrast, reduced-motion/sound/haptic, overlay/task-switcher, TLS interception, backup, malicious-image corpus, low-memory, and API-level/form-factor matrices have not run.
- Startup/frame/memory/upload/reconnect budgets are defined but not measured. Per-second countdown still updates the gameplay `UiState`; profiling must prove Compose skips unrelated work or the timer must be split into isolated state before Phase 7 exit.
- No dependency vulnerability/license scan, independent security review, or moderated group usability study has been performed.
- Evidence pagination, player-called meetings, replay/account scope, and other unresolved Phase 0 decisions remain as previously recorded.

## Next action

Accept/install Android SDK Platform 36 and Build Tools 36.0.0, set `IMPOSTER_API_BASE_URL` to an HTTPS staging origin, run `./gradlew quality`, and fix any Android compile/lint/test defects before starting the API 26/31/36 device matrix in [`phase-07-hardening.md`](phase-07-hardening.md).

## Session handoff

**Date/time:** 2026-09-28 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 7 — resilience, accessibility, privacy, and security hardening
**Milestone:** Automated hardening foundation and auditable manual-validation matrix
**Status:** partial; source implementation and host verification complete, Android/device/external validation blocked or pending

### Changed

- `core/data`: bounded responses, untrusted-text normalization, diagnostic/log hardening, private DTO redaction, and stricter signed-upload behavior.
- `app`: display sanitization, clipboard expiry, overlay protection, stale-snapshot rejection, single-flight commands, reconnect status, image bounds, and timer accessibility cadence.
- `context/phase-07-hardening.md`: threat model, performance budgets, cleanup rules, and required device/accessibility/usability matrices.

### Verified

- Host formatting and 26 core tests pass.
- Android task dependency resolution confirms the remaining blocker is unaccepted SDK 36 licenses; Android source compilation did not run.

### Decisions added

- ADR-A-019 — Phase 7 secure-surface and untrusted-input policy.

### Remaining issues

- See the explicit unverified matrices and external reviews above; Phase 7 exit criteria are not yet met.

### Next action

Unblock Android SDK 36, run `./gradlew quality`, then execute the lifecycle/accessibility/privacy matrix on API 26, 31, and 36 devices.
