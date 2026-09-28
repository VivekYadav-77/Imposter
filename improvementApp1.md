# Android app QA report and repair plan

**Test date:** 2026-09-28

**Device:** Acer One 8 T4-82L, Android 13, 800 x 1280 at 240 dpi

**Package:** `com.impostergame.android.debug`

**Backend:** local API through `adb reverse tcp:3000 tcp:3000`

**Tester identity:** AcerTest initially; AcerFlow2 for the clean create/leave regression pass

## Implementation update

**Updated 2026-09-28:** APP-001, APP-002, APP-003, APP-005 through APP-011 are implemented in the current worktree. A follow-up physical run found that valid image preparation was fixed but the relative signed-upload instruction still failed at transfer; Android now resolves same-origin relative upload instructions against the validated API origin. The Acer run reached object upload, submission confirmation, `Evidence accepted`, and a completed assignment. Non-host lobby refreshes now also route authoritative active/completed rooms into gameplay/results. The physical connected suites and the final full multi-client APP-004 acceptance matrix remain required before release approval.

## Release verdict

**Release acceptance is still pending APP-004 and the external Phase 8 sign-offs.** The code-level blocker and high-priority recovery/test-gate defects in this report are repaired; do not treat that as a substitute for the required full multi-client acceptance run.

## What was tested

- Fresh launch, create-room form, empty-field validation, color selection, all three consent rows, successful room creation, host leave cancel/confirm, and session clearing after leave.
- Join-room format validation and unknown/expired-room response.
- Room code copy and Android share sheet (no external recipient was selected).
- Host lobby with two additional API-driven participants; realtime roster and minimum-player checklist updated without restarting.
- Task-pack selection, applying settings, start eligibility, and starting a three-player game.
- Private role seal, press-and-hold reveal, accessibility fallback reveal, reseal/hide, and secure screenshot blocking during gameplay.
- Crew task list, evidence action sheet, Android photo picker, valid PNG selection, evidence tab, and empty-evidence state.
- Portrait and landscape layouts, including the landscape split/status layout.
- 200% font scale; content remained reachable by scrolling.
- Offline cold resume, connectivity restoration, force-stop/relaunch recovery.
- Support-diagnostics confirmation copy (cancelled before opening the share sheet).
- Crash/ANR scan of logcat during the run; no app fatal exception or ANR was observed.
- Final `gradlew quality connectedQuality --no-parallel --max-workers=1`: passed (234 tasks).
- Final app connected suite on the Acer/API 33 device: 6/6 passed.
- Final design-system connected suite on the Acer/API 33 device: 4/4 passed.

## Priority summary

| ID      | Priority   | Area                     | Result                                                                                                 |
| ------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| APP-001 | P0 blocker | Evidence upload          | Fixed through accepted submission on the physical Acer plus network and image-source tests             |
| APP-002 | P1 high    | Test/release gate        | Fixed; `connectedQuality` passes and is required by CI                                                 |
| APP-003 | P1 high    | Offline/session recovery | Fixed with manual Retry and bounded automatic backoff                                                  |
| APP-004 | P1 high    | End-to-end acceptance    | Pending production-like three-client acceptance                                                        |
| APP-005 | P2 medium  | Lobby UX                 | Fixed; pending settings and Apply are now beside Start                                                 |
| APP-006 | P2 medium  | Form UX                  | Fixed; the first invalid target is focused/scrolled into view and announced                            |
| APP-007 | P2 medium  | Lobby UI                 | Fixed; host identity renders once                                                                      |
| APP-008 | P2 medium  | Home UX                  | Fixed; dead-link styling was replaced with explanatory copy                                            |
| APP-009 | P2 medium  | Accessibility            | Fixed; color, consent, and task-pack controls expose one owned semantic node                           |
| APP-010 | P2 medium  | Content quality          | Guard fixed; existing published placeholder data still requires administrative archival or replacement |
| APP-011 | P3 low     | Android integration      | Fixed; predictive back is enabled for API 33+                                                          |

## Detailed findings

### APP-001 — P0 — Valid gallery evidence always fails

**Impact:** This blocks evidence submission and therefore blocks crew task completion through the intended app flow. The match cannot be fully played as designed.

**Reproduction:**

1. Create a room, add at least two players, choose/apply a published task pack, and start.
2. Reveal and hide the private role.
3. Tap `Add evidence` on an assigned task.
4. Tap `Choose from device`.
5. Select a valid PNG from Android's system photo picker.
6. The app returns to the evidence sheet with `Evidence: Rejected or unavailable` and `The selected image could not be opened.`

**Expected:** The image is decoded, metadata-stripped/re-encoded, previewed, uploaded, submitted, and the assignment completes or exposes the next valid state.

**Actual:** Processing fails before upload. No crash occurs.

**Root cause:** In `android app/app/src/main/java/com/impostergame/android/gameplay/EvidenceProcessor.kt`, the bounds probe uses `BitmapFactory.Options.inJustDecodeBounds = true`, but then treats the return value from `BitmapFactory.decodeStream` as required. Android intentionally returns `null` for a bounds-only decode. The Elvis branch therefore throws `The selected image could not be opened.` for valid images.

**Required fix:**

- Open the stream and invoke `decodeStream` only for its side effect of populating `outWidth/outHeight`; do not require a non-null bitmap when `inJustDecodeBounds` is true.
- Keep the existing null-stream, MIME, byte-size, dimension, pixel-count, orientation, and final encoded-size checks.
- Add instrumentation tests using valid JPEG, PNG, and WebP content URIs plus corrupt, unsupported, oversized, and revoked-URI cases.
- Add one end-to-end UI test that selects a fixture through a `PickVisualMedia` test seam and verifies upload intent -> object upload -> submission -> completed assignment.

**Acceptance:** A valid picked image reaches the backend, its task state updates in the UI, progress updates through realtime/snapshot refresh, and a complete crew path can finish the game.

### APP-002 — P1 — Connected app/design-system tests fail and are absent from the passing quality gate

**Evidence:** `connectedDebugAndroidTest` failed on the physical Acer device:

```text
com.impostergame.android.LaunchTest.bootstrapShellLaunches
Expected displayed text: "Design system"
Actual launch UI: "Ready to play?"
```

The stale assertion is in `android app/app/src/androidTest/java/com/impostergame/android/LaunchTest.kt:17`. `gradlew quality` passed immediately beforehand, which means the main quality gate does not protect against this failure.

The design-system device suite also failed 2 of 4 tests. Both accessibility tests passed, but both `DesignSystemScreenshotTest` cases compare only the top-left pixel with the center pixel. On this device both sample points are the same background color (`-15657956`), so a legitimately non-empty catalog fails the test. This is not a useful screenshot regression and does not verify the rendered composition.

**Required fix:**

- Replace the obsolete `Design system` assertion with stable landing/bootstrap semantics, not fragile presentation copy.
- Replace two-pixel screenshot checks with deterministic golden-image comparison (with an explicit tolerance and stored baselines), or assert meaningful component semantics/layout if golden testing is not yet available.
- Add tests for successful resume into lobby/game/results and failed bootstrap with a visible Retry action.
- Make the protected release gate run app and design-system connected tests on the supported API matrix, or create a clearly named release-acceptance task that CI must require.
- Do not allow `quality` to be described as the full release gate while device tests are excluded.

**Acceptance:** `connectedDebugAndroidTest` passes on API 26, 31, and 36 targets plus the physical Acer/API 33 device, and CI cannot turn green when this suite fails.

### APP-003 — P1 — Offline cold resume has no recovery path

**Reproduction:**

1. Enter an active game and force-stop the app.
2. Remove backend connectivity and relaunch.
3. The app opens Home with `Connection lost. Check your network and try again.`
4. Restore connectivity and wait.
5. Nothing changes; there is no Retry control and the active game is not automatically resumed.
6. Force-stop and relaunch again while online; the game resumes and role privacy is correctly resealed.

**Root cause:** `EntryLobbyViewModel.bootstrap()` maps `ResumeTarget.Failed` to `EntryDestination.HOME` and `ConnectionState.Offline`, but Home has no action wired back to `bootstrap()` and there is no connectivity-driven retry.

**Required fix:**

- Preserve an explicit `ResumeFailed`/offline bootstrap state instead of presenting it as a normal Home state.
- Add a prominent `Retry` button wired to the same resume request and guard it against duplicate requests.
- Automatically retry on a real offline -> online transition with bounded backoff.
- Keep the encrypted credential until the server explicitly returns an authentication/session-revoked response; transport failure must never clear it.
- When recovery succeeds, route to lobby/game/results and keep the role sealed.

**Acceptance:** Restoring connectivity resumes the active session without killing the app, and the user has a working manual Retry fallback.

### APP-004 — P1 — Full gameplay acceptance is blocked/unverified

The app successfully reached a three-player active task phase, but the normal flow could not proceed past evidence because APP-001 blocks submissions. Therefore do not claim the following as accepted: task completion/progress aggregation, impostor kill, meeting eligibility/cooldown, evidence review, review vote, ejection vote, result reveal, winner/end reason, replay, host transfer during an active game, or abandonment behavior.

**Required acceptance run after APP-001:**

- Use three independently controlled authenticated clients, not two API-only roster entries.
- Exercise both crew and impostor screens and verify private fields never leak between snapshots/UI/logs.
- Complete tasks with and without retryable upload failures.
- Exercise manual meeting, kill-triggered meeting, timed voting, all-voted mode, tie/no-ejection, ejection, each winner condition, leave/host transfer, replay, and expiry.
- Repeat with rotation, background/foreground, process death, network loss, stale state version, duplicate idempotency key, and websocket reconnect at each authoritative phase.

### APP-005 — P2 — Task-pack selection has misleading two-step feedback

**Observed:** Tapping `Avengers` immediately checks the radio button, but the checklist still says `Choose a published task pack`, the sticky footer still says `Select a published task pack`, and Start remains disabled. The user must scroll past every task pack and timing field to discover `Apply settings`.

This is technically consistent with a local dirty draft, but visually looks broken and caused repeated selection attempts during testing.

**Required fix:** Prefer auto-saving a task-pack selection. If batching settings is intentional, show a sticky `Unsaved settings` state and place `Apply settings` beside/above Start, or auto-scroll/focus it after the first draft change. Change the checklist/footer language to `Apply pending settings` rather than claiming no pack is selected.

### APP-006 — P2 — Validation can fail outside the visible viewport

The Join/Create primary action remains enabled even with blank nickname, no color, or missing consents. On the long Create form, tapping the fixed bottom action while scrolled to consents can set a nickname error far above the viewport without moving focus or scrolling. The action appears to do nothing.

**Required fix:**

- On submit, focus and bring the first invalid field into view.
- Announce a concise validation summary using a polite/assertive live region.
- Disable submit only when the reason is immediately understandable, or keep it enabled but guarantee visible feedback.
- Add Compose UI tests for blank nickname, missing color, missing each consent, and invalid room code from both top and bottom scroll positions.

### APP-007 — P2 — Host status is duplicated

The host player card visibly renders three labels: `You`, `Host`, `Host`.

**Root cause:** `ParticipantRow` passes both `isHost = true` and `status = PlayerStatus.Host`; `PlayerCard` renders the explicit host label and the status label independently.

**Required fix:** Use `status` only for transient presence/connection state and render host/self identity badges exactly once. Add a screenshot/semantics assertion for self-host, other-host, self-nonhost, away-host, and regular participant.

### APP-008 — P2 — Home footer presents dead controls

`How to play • Privacy • Accessibility • Settings` is a single static `Text` element with no click actions. It looks like four navigation links.

**Required fix:** Implement real accessible buttons/routes for each destination or replace the text with non-interactive explanatory copy. Each link needs a minimum 48 dp target and its own semantics.

### APP-009 — P2 — Accessibility semantics contain duplicate/weak labels

Observed UIAutomator semantics include `Coral, Coral`, `Gold, Gold`, etc.; the selected item becomes `Violet, Violet, Selected`. The selectable container and `PlayerAvatar` both contribute the same color name. Consent checkbox nodes also appear as NAF while the surrounding row carries the visual label.

**Required fix:**

- Merge each color option into one radio-button semantic node with one label and selected state.
- Clear descendant semantics where the parent owns the announcement.
- Merge each consent row into one checkbox node with its full label and state; avoid two focus targets for row and checkbox.
- Run TalkBack traversal on Home, Join/Create, lobby, role reveal, task cards, evidence sheet, meeting, voting, and results.

### APP-010 — P2 — Published task content is not user-ready

The selected `Avengers` pack produced tasks named `sdfsdfds`, `dsfsdfsdf`, and `sdfsdfds`. The mobile UI renders them correctly, but the published backend/admin data is placeholder content and makes the experience look broken.

**Required fix:** Clean or unpublish placeholder packs, add publish-time content validation/review, and seed staging with meaningful tasks covering easy/medium/hard counts.

### APP-011 — P3 — Predictive-back integration warning

Logcat repeatedly reports:

```text
OnBackInvokedCallback is not enabled for the application.
Set android:enableOnBackInvokedCallback="true" in the application manifest.
```

Enable predictive back and test Back behavior for forms, lobby confirmation, evidence sheet, photo picker return, role reveal, and every gameplay phase.

## Confirmed working behavior

- Create-room request, encrypted session persistence, and successful lobby resume while online.
- Join lookup validation for malformed and unknown/expired room codes.
- Realtime lobby roster: two joined participants appeared without an app restart; the minimum-player checklist updated.
- Copy marks the room code as sensitive; Android masked the clipboard preview. Share opens a correctly populated chooser.
- Leave-as-host has an explicit confirmation; Cancel preserves the room and Confirm returns Home.
- Game starts only after minimum players and applied task-pack settings are authoritative.
- Gameplay uses secure-window behavior; ADB screenshot capture returned no image during private gameplay.
- Role reveal requires a hold and provides an accessibility alternative; focus/background reseals it.
- Portrait, landscape, and the expanded split layout remained navigable.
- At 200% font scale the task list remained scrollable and the third task/action could be reached.
- System photo picker correctly states that the app can access only selected photos.
- Support-diagnostics confirmation accurately states included/excluded fields.
- No fatal exception or app ANR occurred during the manual run.

## Required automated regression suite

1. **Evidence processor unit/instrumentation:** bounds decode, valid formats, EXIF rotation, transparency flattening, scaling, byte cap, corrupt stream, revoked URI, unsupported MIME, cancellation, retry, and cleanup.
2. **Entry/resume UI:** Home, Create, Join, validation focus/scroll, consent semantics, successful create/join, unknown/full/active/expired room, offline resume Retry, revoked session, and process death.
3. **Lobby UI:** realtime join/leave/away, host transfer, dirty/applied settings, invalid settings conflict, task-pack removal, min/max players, duplicate Start taps, and leave confirmation.
4. **Gameplay E2E:** crew and impostor tasks, evidence upload/submission, kill authorization, meetings, review votes, ejection votes, all end reasons, results, replay, expiry, reconnect, stale snapshots, and idempotent retries.
5. **Accessibility/visual:** TalkBack order and names, 200% text, dark/light, API 26/31/36, 320 dp compact portrait, compact landscape, 800 x 1280 tablet, expanded width, keyboard/IME, and color-contrast checks.
6. **Privacy/security:** `FLAG_SECURE`, role reseal, clipboard expiry, no secrets/private roles/ballots/evidence in logs or saved state, picker permission scope, signed-upload host allowlist, and diagnostics consent.

## Definition of done

- APP-001 through APP-004 are fixed and demonstrated on a production-like backend.
- `quality`, app connected tests, design-system connected tests, and the full multi-device E2E suite all pass twice from clean outputs.
- A recorded three-client game reaches every major phase and a terminal result through the UI.
- Offline -> online recovery works without force-stopping the app.
- TalkBack and 200% font sign-off has no blocker/major issue.
- No private role, room code, token, ballot, evidence data, signed URL, or request payload appears in logs, screenshots, analytics, diagnostics, navigation, or saved state.
- Release notes explicitly list any unresolved lower-priority issue; no P0/P1 issue remains open.
