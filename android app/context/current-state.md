# Current Android implementation state

**Last updated:** 2026-09-29
**Overall status:** Phase 8 controls, physical-device QA repairs, and the unblocked website-equivalent Android UI/UX scope are implemented; production acceptance remains blocked on the full multi-client matrix, staging, and owner/vendor/store approvals
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Active plan:** [`../plan/phase-08-quality-release.md`](../plan/phase-08-quality-release.md)
**Last verified commit:** not recorded; current worktree contains the Phase 8 implementation
**Android build status:** Full `quality` and `connectedQuality` gates pass with JDK 17; the latest physical run passed on Acer One 8 T4-82L/API 33 and the current debug APK was installed and visually checked in persistent light and dark modes

## Implemented through Phase 7

- Guest create/join, adaptive lobby/host setup, secure resume, authoritative snapshots/retry/reconnect core, private role reveal, tasks/evidence, authorized flag/elimination, meetings/review/voting, and terminal results are source-implemented.
- Credentials use Android Keystore AES-256-GCM and non-backed-up private preferences. Gameplay remains server authoritative; command retries preserve idempotency identity and conflicts refresh.
- Phase 7 hardening covers secure windows/overlays, clipboard expiry, bounded/sanitized responses and images, private DTO redaction, signed-upload restrictions, stale snapshot rejection, reconnect status, and countdown accessibility cadence.

## Phase 8 repository controls

- [x] Version name/code, per-environment endpoints, external release signing, HTTPS validation, release R8/resource shrinking, and fail-closed release configuration tasks are defined.
- [x] Main CI has an Android quality job and a disposable-key signed/shrunk release build. A protected manual workflow runs the clean release gate twice and retains the AAB/R8 mapping.
- [x] Privacy-safe operational events cover bootstrap, join, reconnect, resync, upload transfer, conflict, and revocation without arbitrary labels/payloads.
- [x] Consent-gated in-memory support diagnostics expose only sanitized version/environment/network/request-ID fields through an explicit share confirmation.
- [x] [`phase-08-release.md`](phase-08-release.md) documents compatibility/forced-update policy, verification pyramid, alert proposals, store/privacy package, acceptance ledger, rollout gates, and stop criteria.
- [x] [`operations-runbook.md`](operations-runbook.md) covers bad releases, backend incompatibility, upload/storage outage, websocket outage, session incidents, rollout halt, and recovery exercise.

## Physical-device QA remediation

- [x] Fixed bounds-only evidence decoding and added connected coverage for JPEG, PNG, WebP, corrupt, unsupported, oversized, and revoked sources.
- [x] Failed cold resume now retains an explicit recovery state, exposes manual Retry, and retries automatically with bounded backoff without clearing the credential on transport failure.
- [x] Dirty lobby settings are explained beside Start with the Apply action; validation scrolls/focuses the first invalid field and announces the error.
- [x] Removed duplicated host status and dead-link styling; consolidated color, consent, and task-pack accessibility nodes.
- [x] Enabled predictive back and added publish-time rejection of duplicate/obvious placeholder task descriptions.
- [x] Added `connectedQuality` and a CI API 35 emulator job; app and design-system connected suites pass on the Acer/API 33 device.
- [x] Resolved same-origin relative signed-upload instructions against the validated API origin; a physical Acer run reached object transfer, confirmation, `Evidence accepted`, and a completed assignment.
- [x] Lobby polling now routes non-host participants into gameplay/results when another client changes the authoritative room status.

## Website-equivalent Android UI/UX implementation

- [x] Replaced the former blue/cyan Material brand roles with semantic charcoal/amber light and dark schemes, phase colors, private surfaces, result colors, 10/18/30dp shape roles, and 120/200/480ms motion roles.
- [x] Added persistent System/Light/Dark, sound, haptics, reduced-motion, and high-contrast app settings; system bars track the resolved theme.
- [x] Added typed, deduplicated, rate-limited, foreground-only sound/haptic feedback for role, task, evidence, elimination, meeting, vote, result, and game lifecycle events without licensed-asset risk.
- [x] Completed the server-supported host settings editor for voting/evidence visibility, meeting behavior, cooldowns, imposter count, task distribution, and specialist roles with local validation and authoritative Apply.
- [x] Added branded lobby invitation/readiness treatment, phase-aware top bars, private role styling, bounded evidence zoom, and website-equivalent terminal-result hierarchy and metrics.
- [x] Verified core token contrast in unit tests and verified the current APK plus preference persistence in light and dark modes on the physical Acer device.
- [ ] Player-called meetings, same-room replay, and native account/dashboard/history remain intentionally absent pending ADR-A-006, ADR-A-008, and ADR-A-009.

## Verification

- Android Studio, SDK Platform 36, Build Tools 36.0.0, platform tools, emulator, and API 36 Google APIs x86_64 images are installed; licenses are accepted.
- `gradlew quality --no-parallel --max-workers=1` with pinned JDK 17 — passed after the live-test fix; 142 tasks, no lint or unit-test failures.
- `gradlew :core:data:test :app:assembleDebug` — passed; the debug APK installs successfully.
- Local backend migration and `/health/live` plus `/health/ready` checks — passed.
- API 36 phone (`1080x2400`) — app launched, create-room request completed, host lobby rendered, process remained alive, and post-fix logcat contained no app fatal exception.
- API 36 tablet (`2560x1600`) — app installed/launched and the expanded landing layout rendered; post-launch logcat contained no app fatal exception.
- Live testing found and fixed `NetworkOnMainThreadException` in `ApiClient`: response parsing and close now remain on `Dispatchers.IO`.
- `validateStagingConfiguration`, `validateReleaseConfiguration` with non-production validation inputs, and `git diff --check` — passed.
- `gradlew quality --no-parallel --max-workers=1` — passed after QA remediation.
- `gradlew connectedQuality --no-parallel --max-workers=1` — app 6/6 and design-system 4/4 passed on Acer One 8 T4-82L, Android 13/API 33.
- 2026-09-29 `gradlew spotlessApply quality connectedQuality --no-parallel --max-workers=1` — final combined gate passed (234 tasks) on Acer One 8 T4-82L/API 33 after the UI/UX parity implementation.
- The debug APK was installed, launched, and visually checked in both themes, including light-theme persistence after force-stop/relaunch; the final APK was reinstalled with the app returned to its default Follow device preference.
- `npm run check` — formatting, lint, typecheck, 21 files/120 unit tests, OpenAPI, and realtime fixtures passed; the database-backed `tests/integration/task-packs.test.ts` also passed (3 tests).

## Remaining release blockers

- Approved staging/production HTTPS origins, staging accounts, production signing secrets/recovery, Play Console protected environment, and final application ID are not supplied.
- The ten production-like E2E scenarios, API 26/31/36 lifecycle matrix, multi-client gameplay acceptance, feature goldens, full TalkBack/privacy reviews, performance measurements, dependency/license review, and moderated usability are not complete.
- The 6 GB development host can run one 2 GB emulator reliably, but the API 36 system image can briefly show a System UI ANR during first boot; run phone and tablet AVDs one at a time. This is an emulator/host-capacity condition, not an app crash.
- Crash/ANR vendor, retention/residency, dashboards, alert owners, and synthetic routing need explicit approval. The code provides privacy-safe seams, not a configured monitoring service.
- Privacy-policy URL, data-safety form, permission declaration, content rating, store listing/screenshots, countries/locales, support contact, and owner acceptance are external sign-offs.
- ADR-A-005 through ADR-A-009 remain unresolved. Player-called meetings, same-room replay, and account history cannot be accepted as implemented.

## Next action

Configure the protected CI environment and approved staging origin, then execute the required independently controlled three-client gameplay matrix and produce the first signed internal candidate.

## Session handoff

**Date/time:** 2026-09-29 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Milestone:** implement the unblocked scope in `implementationAppui/ux.md`
**Status:** unblocked UI/UX implementation complete and locally/device verified; approval-gated product features and production-like multi-client acceptance remain open

### Changed

- `core:designsystem`: charcoal/amber themes, semantic phase/private/result colors, shared shape/motion roles, phase-aware top bar, and contrast tests.
- `app`: persistent appearance/feedback settings, lifecycle-safe typed sound/haptics, complete host settings controls/validation, branded lobby readiness, private role styling, bounded evidence gesture API, and expanded result presentation.
- `app` tests: preference parsing, feedback deduplication/rate limiting, and host-settings validation.
- `context`: UI/UX implementation status, ADR-A-024, and updated traceability.

### Verified

- `gradlew spotlessApply quality connectedQuality --no-parallel --max-workers=1` passes (234 tasks) on physical Acer/API 33.
- Current debug APK installs and launches; dark and light visual checks pass and the selected theme survives force-stop/relaunch.

### Decisions added

- ADR-A-024 — Website-equivalent native brand, preferences, and feedback.

### Remaining issues

- APP-004 remains: run the independently controlled three-client gameplay/meeting/results/reconnect matrix on an approved production-like backend.
- Player-called meetings, replay, and account/dashboard/history remain blocked on ADR-A-006, ADR-A-008, and ADR-A-009; there is no dead placeholder UI for them.
- Full TalkBack traversal, 200% font across every gameplay phase, API 26/31/36, and compact-landscape/tablet product acceptance still require the Phase 8 device matrix.

### Next action

Execute APP-004 on approved staging with three independently controlled clients and record the Phase 8 acceptance ledger.
