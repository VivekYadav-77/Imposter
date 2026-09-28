# Current Android implementation state

**Last updated:** 2026-09-28
**Overall status:** Phase 8 controls plus the 2026-09-28 physical-device QA repairs are implemented; production acceptance remains blocked on the full multi-client matrix, staging, and owner/vendor/store approvals
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Active plan:** [`../plan/phase-08-quality-release.md`](../plan/phase-08-quality-release.md)
**Last verified commit:** not recorded; current worktree contains the Phase 8 implementation
**Android build status:** Full `quality` and `connectedQuality` gates pass with JDK 17; the latest physical run is 6/6 app plus 4/4 design-system tests on Acer/API 33

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

**Date/time:** 2026-09-28 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Milestone:** implementation and regression verification of `improvementApp1.md` code-level findings
**Status:** partial; APP-001 through APP-003 and APP-005 through APP-011 are implemented and locally verified, while APP-004 is an outstanding production-like acceptance run

### Changed

- `app`: evidence decoding, bootstrap recovery, validation focus/scroll, lobby dirty-state action, host labeling, accessibility semantics, explanatory footer, and predictive back.
- `app`/`core:designsystem` tests: stable launch/layout assertions, lock-screen-safe test host, evidence source matrix, and resume/backoff unit coverage.
- Gradle/CI: `connectedQuality` plus a required API 35 emulator job and retained reports.
- Backend task packs: publish-time duplicate/placeholder validation with unit and integration coverage.
- `context`: QA implementation status, ADR-A-022, and updated traceability.

### Verified

- Android `quality` and physical Acer/API 33 `connectedQuality` pass; the full backend/web `npm run check` and task-pack integration tests pass.

### Decisions added

- ADR-A-022 — Recoverable bootstrap and connected-device release gate.

### Remaining issues

- APP-004 remains: run the independently controlled three-client gameplay/meeting/results/replay/reconnect matrix on an approved production-like backend.
- Current published placeholder data must be archived or replaced administratively; the new validator prevents equivalent drafts from being published but intentionally does not mutate live data.

### Next action

Run APP-004 on approved staging with three independently controlled clients, then record the result in the Phase 8 acceptance ledger before producing the signed candidate.
