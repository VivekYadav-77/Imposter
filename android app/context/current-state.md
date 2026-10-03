# Current Android implementation state

**Last updated:** 2026-10-03
**Overall status:** Phase 8 remains active. The product owner has replaced the earlier native-adaptation direction with approval-gated exact mobile-website parity under ADR-A-028. The shared design-system foundation and first screen group (bootstrap/resume, Home, Settings) are implemented and locally verified; later screen groups are intentionally waiting for approval.
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Active plan:** [`../plan/phase-08-quality-release.md`](../plan/phase-08-quality-release.md)
**Last verified commit:** not recorded; current worktree contains the Phase 8 implementation
**Android build status:** Full `quality` and `connectedQuality` gates pass with JDK 17; the latest physical run passed on Acer One 8 T4-82L/API 33 and the current debug APK was installed and visually checked in persistent light and dark modes

## Implemented through Phase 7

- Guest create/join, adaptive lobby/host setup, secure resume, authoritative snapshots/retry/reconnect core, private role reveal, tasks/evidence, authorized flag/elimination, meetings/review/voting, and terminal results are source-implemented.
- Credentials use Android Keystore AES-256-GCM and non-backed-up private preferences. Gameplay remains server authoritative; command retries preserve idempotency identity and conflicts refresh.
- Phase 7 hardening covers lifecycle role resealing, clipboard expiry, bounded/sanitized responses and images, private DTO redaction, signed-upload restrictions, stale snapshot rejection, reconnect status, and countdown accessibility cadence. Screenshot/recent-task and overlay blocking were removed from every build by the explicit ADR-A-030 product decision.

## Phase 8 repository controls

- [x] Version name/code, per-environment endpoints, external release signing, HTTPS validation, release R8/resource shrinking, and fail-closed release configuration tasks are defined.
- [x] Main CI has an Android quality job and a disposable-key signed/shrunk release build. A protected manual workflow runs the clean release gate twice and retains the AAB/R8 mapping.
- [x] Privacy-safe operational events cover bootstrap, join, reconnect, resync, upload transfer, conflict, and revocation without arbitrary labels/payloads.
- [x] Consent-gated in-memory support diagnostics expose only sanitized version/environment/network/request-ID fields through an explicit share confirmation.
- [x] [`phase-08-release.md`](phase-08-release.md) documents compatibility/forced-update policy, verification pyramid, alert proposals, store/privacy package, acceptance ledger, rollout gates, and stop criteria.
- [x] [`operations-runbook.md`](operations-runbook.md) covers bad releases, backend incompatibility, upload/storage outage, websocket outage, session incidents, rollout halt, and recovery exercise.

## Physical-device QA remediation

- [x] System Back now follows the app hierarchy: settings and entry return Home, lobby Back requests explicit leave confirmation, transient gameplay surfaces close first, Evidence returns to Tasks, Results returns Home, and active authoritative phases offer safe minimization instead of closing the task. Labeled in-app back controls name their destination.
- [x] Fixed bounds-only evidence decoding and added connected coverage for JPEG, PNG, WebP, corrupt, unsupported, oversized, and revoked sources.
- [x] Failed cold resume now retains an explicit recovery state, exposes manual Retry, and retries automatically with bounded backoff without clearing the credential on transport failure.
- [x] Dirty lobby settings are explained beside Start with the Apply action; validation scrolls/focuses the first invalid field and announces the error.
- [x] Removed duplicated host status and dead-link styling; consolidated color, consent, and task-pack accessibility nodes.
- [x] Enabled predictive back and added publish-time rejection of duplicate/obvious placeholder task descriptions.
- [x] Added `connectedQuality` and a CI API 35 emulator job; app and design-system connected suites pass on the Acer/API 33 device.
- [x] Resolved same-origin relative signed-upload instructions against the validated API origin; a physical Acer run reached object transfer, confirmation, `Evidence accepted`, and a completed assignment.
- [x] Lobby polling now routes non-host participants into gameplay/results when another client changes the authoritative room status.

## Website-equivalent Android UI/UX implementation

- [x] Frozen the website as the exact presentation authority under ADR-A-028, superseding the former crewmate-only/native-adaptation visual constraints while retaining server authority, privacy, accessibility, and existing feature behavior.
- [x] Bundled the website fonts (Public Sans Variable and Barlow Condensed 400/600/700/800) with OFL licenses; centralized audited palettes, mobile layout measurements, 10/18/30dp shapes, CSS-equivalent elevation roles, and 120/200/480ms motion roles.
- [x] Added website-path icons, exact signal brand geometry, code-native signal-scene artwork, journey cards, phase glyphs/swatches, trust rows, and branded loading primitives.
- [x] Rebuilt bootstrap/resume, the full mobile Home hierarchy, mobile menu/theme control, and Settings presentation. Home now includes the website hero copy, trust proof, meeting artwork, four-card journey, phase band, privacy callout, and footer. Existing Android-only settings and support diagnostics remain available in the website visual system.
- [x] Verified this screen group with `spotlessApply quality`, `connectedQuality`, a debug APK install, physical light-theme screenshots, navigation semantics, and reduced-motion handling on Acer One 8 T4-82L/API 33.

- [x] Replaced the former blue/cyan Material brand roles with semantic charcoal/amber light and dark schemes, phase colors, private surfaces, result colors, 10/18/30dp shape roles, and 120/200/480ms motion roles.
- [x] Added persistent System/Light/Dark, sound, haptics, reduced-motion, and high-contrast app settings; system bars track the resolved theme.
- [x] Added typed, deduplicated, rate-limited, foreground-only sound/haptic feedback for role, task, evidence, elimination, meeting, vote, result, and game lifecycle events without licensed-asset risk.
- [x] Completed the server-supported host settings editor for voting/evidence visibility, meeting behavior, cooldowns, imposter count, task distribution, and specialist roles with local validation and website-equivalent debounced Saving/Saved feedback through the existing authoritative settings operation.
- [x] Added branded lobby invitation/readiness treatment, phase-aware top bars, private role styling, bounded evidence zoom, and website-equivalent terminal-result hierarchy and metrics.
- [x] Verified core token contrast in unit tests and verified the current APK plus preference persistence in light and dark modes on the physical Acer device.
- [x] Added a reusable native signal-room layer (atmospheric canvas, brand mark/header, editorial eyebrow, signal cards/chips, pill controls, player accent rails, and phase-aware task/evidence/meeting/result surfaces) and applied it across home, settings, create/join, lobby, and gameplay without changing authoritative commands.
- [x] Added server-authoritative player-called meetings plus a functional compact Status / Evidence / Meeting action rail, meeting readiness explanations, and confirmation flow under ADR-A-026.
- [x] Refined lobby/meeting/task/result parity with paper-surface cards, phase watermarks, compact connection/header behavior, a meeting step tracker, compact vote targets, coherent vector action icons, responsive invite actions, and corrected single-node selection semantics.
- [x] Rebuilt Create/Join as the website's single mobile mode-card flow, including lookup-before-identity Join behavior, compact room options, a named three-column operative picker, combined consent presentation, and in-card primary action.
- [x] Restored the Create screen's Room options disclosure with animated minimum/maximum player controls, valid-range enforcement, state restoration, and propagation through the existing room-creation request.
- [x] Rebuilt the mobile host lobby from the supplied seven-state website reference: one continuous scrolling body beneath the fixed phase bar, compact map selector, independently collapsible 02–05 settings, website copy/order/colors, operative-presence roster rows, Ready Check card, and Start/Leave action dock.
- [x] Corrected the host-lobby command-bar height, amber invite gradient, 10dp readiness track, circular section numbers, segmented steppers, website SVG-path chevrons/check/lock/eye/timer controls, two-column meeting modes, and single sticky status message. Settings autosave is now ViewModel-owned, deduplicated, non-blocking, and exposes explicit clean/dirty/saving/saved/error presentation states. Existing realtime room/connectivity flows are now primary; HTTP refresh runs only as a foreground 15/30/60-second fallback while disconnected.
- [x] Replaced approximate phase/semantic colors with the exact frozen website CSS values, aligned task badge/proof geometry, and corrected the role page so only the briefing card uses the private surface.
- [x] Removed `FLAG_SECURE`, overlay hiding, the unused secure-surface API, and the stale all-gameplay-sensitive model contract from debug, staging, and release. Private roles still reseal on pause/focus loss.
- [x] Added server-authoritative same-room replay from results through `POST /api/v1/rooms/current/replay`; the returned room snapshot resets gameplay state and restores lobby polling/settings under ADR-A-027.
- [x] Corrected the compact Imposter task dashboard against the frozen mobile website: the elimination ability now follows the assignment list, remains visible while recharging, uses the website danger card and cooldown treatment, opens the website-equivalent two-line target list with privacy/cooldown guidance, and submits from the target dialog without an extra Android-only confirmation screen. Entering Tasks now refreshes evidence so the bottom-rail count is current.
- [ ] Native account/dashboard/history remains intentionally absent pending ADR-A-009 because the current account API is cookie-only and has no approved native OAuth/token exchange.

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
- 2026-09-29 `gradlew spotlessApply quality :app:installDebug connectedQuality --no-parallel --max-workers=1` — signal-room refinement passed all 235 tasks on Acer One 8 T4-82L/API 33; the APK was reinstalled with the localhost reverse route and the home/create-join layouts were visually inspected at the device's native 800x1280 resolution.
- 2026-09-29 physical Acer/API 33 navigation check — the Join screen exposed `← Home`; the device Back button returned to the rendered Home screen while `MainActivity` remained the resumed activity.
- 2026-09-29 `gradlew spotlessApply quality connectedQuality --no-parallel --max-workers=1` — passed all 234 tasks with the new device-Back and labeled-button regression suite; a follow-up app connected test passed after migrating to the non-deprecated Compose test API, and the final debug APK was reinstalled on Acer/API 33.
- 2026-09-29 parity follow-up — `gradlew spotlessApply quality` passed 145 tasks; `gradlew connectedQuality` passed 143 tasks; the targeted app connected suite passed after adding the unmerged-tree color-choice semantics regression. The current debug APK was installed and the light paper-surface hierarchy was visually checked on Acer/API 33.
- 2026-10-01 lobby/gameplay website-parity pass — imported the website operative artwork and palette, rebuilt the lobby phase/invite/readiness/roster/settings/action hierarchy, compact role/task/vote/result surfaces, website motion timings, and deterministic PCM feedback recipes under ADR-A-029.
- 2026-10-01 `gradlew spotlessApply quality` passed after the parity pass; `gradlew spotlessCheck connectedQuality :app:installDebug -PDEBUG_API_BASE_URL=http://127.0.0.1:3000` then passed all app/design-system connected tests and installed the APK on Acer One 8 T4-82L/API 33.
- 2026-10-01 physical backend-connected path — created a host room, joined two independent participants, selected/applied a published task pack, started the authoritative game, revealed and acknowledged the private role, and reached the task command center. Lobby was captured at 800×1280; gameplay capture is intentionally blocked by the active secure-window privacy policy and was verified through rendered semantics and interaction.
- 2026-10-02 parity correction — replaced the remaining approximate lobby/gameplay chrome with the exact website base palette, responsive 70dp command bar, amber invite hierarchy, single readiness block, 78dp roster rows, numbered settings sections with debounced save presentation, dedicated ballot rows, evidence grid/empty state, website modal geometry, double-border role card, floating task rail, and terminal result card/case stamp. PCM output now applies a website-equivalent -14dB/18dB-knee/8:1 compressor envelope and transient Android audio focus.
- 2026-10-02 physical Acer/API 33 correction path — installed against the temporary local backend, replayed the existing terminal game into the corrected lobby, started it, revealed/acknowledged the private role, and reached the task command center. The lobby was visually captured at 800×1280; secure gameplay was verified through accessibility geometry and live actions.
- 2026-10-02 `gradlew spotlessCheck quality --no-parallel --max-workers=1` passed 142 tasks and `gradlew connectedQuality --no-parallel --max-workers=1 -PDEBUG_API_BASE_URL=http://127.0.0.1:3000` passed 143 tasks on Acer/API 33.
- 2026-10-02 capture-enabled parity correction — physical Acer/API 33 screenshots successfully captured Create, Lobby, sealed/revealed Role, and Tasks from one authoritative three-player local-backend game. Android no longer emitted protected/blank gameplay captures; lifecycle role resealing remained active.
- 2026-10-02 final capture-enabled gate — `gradlew spotlessCheck quality connectedQuality :app:installDebug -PDEBUG_API_BASE_URL=http://127.0.0.1:3000 --no-parallel --max-workers=1` passed all 232 tasks on Acer/API 33. The freshly installed app launched and produced an unrestricted screenshot; `npm run check` passed formatting, lint, typecheck, 21 files/120 tests, OpenAPI, and realtime fixture checks; `git diff --check` passed.
- 2026-10-02 supplied-reference host-lobby correction — compared seven website captures against the physical Android host lobby, corrected the pinned-body defect and host settings composition, exercised Meeting voting disclosure on Acer/API 33, and captured top/settings states. `gradlew spotlessCheck quality :app:installDebug -PDEBUG_API_BASE_URL=http://127.0.0.1:3000 --no-parallel --max-workers=1` passed 166 tasks; the final amber-role refinement compiled, installed, and passed `git diff --check`.
- 2026-10-02 host-lobby parity follow-up — corrected command-bar/content geometry, invite/readiness styling, setting controls/icons/disclosures, meeting-mode layout, and sticky status presentation. Added non-blocking deduplicated autosave plus realtime-primary room updates with foreground-only disconnected fallback. `gradlew spotlessCheck quality :app:assembleDebug` passed 165 tasks; `connectedQuality :app:installDebug` passed 144 tasks on Acer/API 33; `npm run check` passed 21 files/120 tests plus OpenAPI/realtime fixtures.
- 2026-10-03 Imposter-dashboard parity pass — exercised a real three-player local-backend round on Acer One 8 T4-82L/API 33, received the Imposter role, verified the assignment dashboard and target picker at the device's 800×1280 resolution, and completed a server-authoritative elimination through the website-equivalent single-confirm flow. `gradlew spotlessApply quality` passed; after clearing the manual game process, `gradlew connectedQuality :app:installDebug -PDEBUG_API_BASE_URL=http://127.0.0.1:3000 --no-parallel --max-workers=1` passed 144 tasks and installed the final APK.
- The temporary local backend used for the physical path was stopped after verification; port 3000 is not left running.
- The debug APK was installed, launched, and visually checked in both themes, including light-theme persistence after force-stop/relaunch; the final APK was reinstalled with the app returned to its default Follow device preference.
- `npm run check` — formatting, lint, typecheck, 21 files/120 unit tests, OpenAPI, and realtime fixtures passed; the database-backed `tests/integration/task-packs.test.ts` also passed (3 tests).

## Remaining release blockers

- Approved staging/production HTTPS origins, staging accounts, production signing secrets/recovery, Play Console protected environment, and final application ID are not supplied.
- The ten production-like E2E scenarios, API 26/31/36 lifecycle matrix, multi-client gameplay acceptance, feature goldens, full TalkBack/privacy reviews, performance measurements, dependency/license review, and moderated usability are not complete.
- The 6 GB development host can run one 2 GB emulator reliably, but the API 36 system image can briefly show a System UI ANR during first boot; run phone and tablet AVDs one at a time. This is an emulator/host-capacity condition, not an app crash.
- Crash/ANR vendor, retention/residency, dashboards, alert owners, and synthetic routing need explicit approval. The code provides privacy-safe seams, not a configured monitoring service.
- Privacy-policy URL, data-safety form, permission declaration, content rating, store listing/screenshots, countries/locales, support contact, and owner acceptance are external sign-offs.
- ADR-A-005, ADR-A-007, and ADR-A-009 remain unresolved. Same-room replay is resolved by ADR-A-027 and emergency meetings by ADR-A-026; native account history still requires a secure native account contract.

## Next action

Capture the corrected host lobby and Imposter task dashboard in both themes at 320dp, 390dp, and 430dp, then run the remaining independently controlled multi-client meeting, evidence, elimination, result, and replay acceptance path on approved staging.

## Session handoff — 2026-10-03

**Date/time:** 2026-10-03 Asia/Calcutta
**Agent/session:** Codex
**Active phase:** Phase 8 — end-to-end quality, release, and operations
**Milestone:** compact Imposter task-dashboard parity
**Status:** complete for the corrected screen and elimination flow; wider device/staging acceptance remains open

### Changed

- `app/gameplay`: removed the Android-only second elimination confirmation, refreshes evidence on entry to Tasks, and preserves server-authoritative eligibility/idempotency.
- `app/ui`: reordered and restyled the Imposter ability card, added its cooldown state, and matched the mobile website target picker, privacy copy, and action labels.
- `core/designsystem`: centralized the frozen mobile elimination-card measurements.

### Verified

- `gradlew spotlessApply quality --no-parallel --max-workers=1` — passed after resolving one pre-existing Compose modifier-order lint failure.
- `gradlew connectedQuality :app:installDebug -PDEBUG_API_BASE_URL=http://127.0.0.1:3000 --no-parallel --max-workers=1` — passed 144 tasks on Acer One 8 T4-82L/API 33 and installed the final APK.
- Manual device path — created a three-player room, started Avengers, received Imposter, inspected the 800×1280 dashboard/target picker, and completed an authoritative elimination.

### Decisions added

- ADR-A-032 — Website-exact Imposter elimination dashboard and confirmation flow.

### Remaining issues

- Compact 320dp/390dp/430dp and dark-theme capture comparison plus approved-staging multi-client acceptance remain part of the Phase 8 matrix.
- Native account/dashboard/history remains blocked by ADR-A-009 and is outside this gameplay-dashboard correction.

### Next action

Run the corrected Imposter dashboard at the remaining compact widths and dark theme, then execute APP-004 on approved staging.
