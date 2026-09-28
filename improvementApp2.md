# Android physical-device QA and website-parity improvement plan

**Audit date:** 2026-09-28  
**Device:** Acer One 8 T4-82L, Android 13 / API 33, 800 x 1280 at 240 dpi  
**Package:** `com.impostergame.android.debug`  
**Backend:** local application API through `adb reverse tcp:3000 tcp:3000`  
**App transport:** real connected Acer tablet only; no emulator or simulator was used  
**Website comparison:** current web client, public API contracts, and shared backend behavior in this repository

## Release verdict

**Not ready for release or feature-parity acceptance.** The entry flow, lobby basics, private role reveal, task rendering, photo selection/preview, meeting alert, meeting result, terminal result, and secure session resume all work on the physical tablet. However, Android evidence submission is blocked, a non-host Android client does not enter a game started by another client until the app is relaunched, players cannot call an emergency meeting from Android, and most website host settings are read-only or absent. Same-room replay, account/history surfaces, and several website presentation utilities are also missing.

Do not mark the Android game loop as accepted until APP2-001 through APP2-005 are fixed and a complete three-client run passes through UI-controlled clients.

## What was tested

- Installed and launched the debug APK on the connected Acer tablet with the local API routed through ADB.
- Home, Create, Join, nickname validation, room-code validation, color selection, all consent rows, and validation scroll/focus.
- Room creation and room joining with real Android UI actions.
- Three-player lobby using the tablet plus two API-controlled peers.
- Live roster updates, minimum-player gating, task-pack selection, dirty-settings warning, Apply settings, and Start.
- Private role seal, press-and-hold reveal, accessibility reveal fallback, and role acknowledgement.
- Crew task list, Android system photo picker, a valid image fixture, processed preview, and evidence submission.
- A second three-player room hosted by another client to test non-host start behavior.
- API-triggered player meeting while the Android client was connected, meeting alert, meeting result, and return to task phase.
- Impostor-parity terminal result, result details, player roles, task totals, and Return home.
- Temporary backend loss and process relaunch/resume.
- UIAutomator accessibility hierarchy for color, consent, task-pack, role reveal, task, meeting, and result screens.
- Source-level comparison against the website lobby settings, mobile game controls, audio/theme controls, replay endpoint, and user dashboard/history.

## Priority summary

| ID       | Priority   | Area                    | Finding                                                                                                    |
| -------- | ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| APP2-001 | P0 blocker | Evidence                | A valid selected image previews but every Android upload fails because the signed upload URL is relative   |
| APP2-002 | P1 high    | Multiplayer transition  | A non-host Android client remains in the lobby after another client starts the game                        |
| APP2-003 | P1 high    | Game flow               | Android exposes no player action for calling an emergency meeting                                          |
| APP2-004 | P1 high    | Website settings parity | Android can edit only map, task time, and meeting duration; website balance/task/role settings are missing |
| APP2-005 | P1 high    | Replay                  | Results provide Return home only; same-room replay is missing                                              |
| APP2-006 | P2 medium  | Compact gameplay UX     | The portrait `Status` button has an empty callback and does nothing                                        |
| APP2-007 | P2 medium  | Accessibility           | Color, consent, and task-pack controls still expose split/unlabelled semantic nodes                        |
| APP2-008 | P2 medium  | Account parity          | Website sign-in, profile, game history, and game detail history have no Android surface                    |
| APP2-009 | P2 medium  | Feedback/preferences    | Website game sounds and explicit theme controls are absent on Android                                      |
| APP2-010 | P2 medium  | Content quality         | Existing published placeholder task content remains available                                              |
| APP2-011 | P3 low     | Developer setup         | A normal debug install has no API base URL and fails with a generic connection message                     |

## Detailed findings and required changes

### APP2-001 — P0 — Relative signed-upload URL blocks all Android evidence submissions

**Reproduction on Acer:**

1. Start a three-player game and reveal/hide the role.
2. Tap `Add evidence` on a task.
3. Choose a valid image through Android's system photo picker.
4. The app successfully converts and previews it as `Evidence: Ready to submit`.
5. Tap `Submit evidence`.

**Actual:** The sheet changes to `Evidence: Rejected or unavailable` and shows `The server returned an unexpected response.` The server records a successful `POST /api/v1/task-assignments/:id/upload-intents`, but no object `PUT` and no submission confirmation occur.

**Verified root cause:** The API returns an upload intent such as:

```text
method=PUT
url=/api/v1/evidence-objects/<capability>
```

`SignedUploadClient.upload()` calls `intent.url.toHttpUrlOrNull()`, which rejects the relative URL before making the upload request. The website resolves the same relative URL against its current origin, but Android does not resolve it against `BuildConfig.API_BASE_URL`.

**Required change:**

- Resolve same-origin relative upload URLs against the validated API base URL before applying upload-host policy.
- Keep fail-closed HTTPS/allowlist behavior for absolute third-party URLs. Never accept protocol-relative URLs, user-info, fragments, unexpected schemes, or an absolute host outside the approved upload-host set.
- Treat a same-origin local HTTP URL as allowed only in an explicitly debuggable local build.
- Make the upload client receive a validated base URL rather than duplicating environment parsing.
- Preserve the same idempotency key and upload intent across a retry.
- Map malformed/forbidden upload URLs to a specific safe message instead of `unexpected response`.
- Cleanly recover from an intent created before transfer failure; retry must not strand the player behind `A different photo upload is already in progress` until TTL expiry.

**Likely files:**

- `android app/core/data/src/main/java/com/impostergame/data/network/SignedUploadClient.kt`
- `android app/app/src/main/java/com/impostergame/android/MainActivity.kt`
- `android app/app/src/main/java/com/impostergame/android/gameplay/GameplayGateway.kt`
- upload/network policy tests in `android app/core/data/src/test`

**Acceptance criteria:** Valid JPEG/PNG/WebP picker inputs reach upload intent -> object PUT -> confirmation -> accepted submission -> completed task -> updated crew progress on a physical device. Cover relative same-origin, approved absolute HTTPS, malformed, protocol-relative, cross-origin, expired, reused, 4xx, 5xx, cancellation, and retry cases.

### APP2-002 — P1 — Non-host Android client does not enter a remotely started game

**Reproduction on Acer:**

1. Create a room from another client and join it from Android as a non-host.
2. Select settings and start the game from the remote host.
3. Wait through multiple Android lobby refresh intervals.

**Actual:** Android stays on `Waiting for host to start` for more than 10 seconds even though the server is already in task/meeting state. Force-stop and relaunch immediately resumes into the active game with the role sealed.

**Verified root cause:** `EntryLobbyViewModel.refreshLobby()` updates the room and draft settings but never routes when the refreshed room becomes `active` or `completed`. Only the local `startGame()` success path and cold `resume()` path call `setDestination(GAME/RESULTS)`.

**Required change:**

- In every authoritative lobby snapshot/realtime refresh, route `active` to `EntryDestination.GAME` and `completed` to `EntryDestination.RESULTS`.
- Cancel the lobby refresh job before transitioning.
- Preserve the private-role seal for the new game destination.
- Make the transition idempotent so polling and realtime events cannot open duplicate screens or duplicate gameplay collectors.
- Add non-host start tests using two independently controlled clients, including start while Android is foregrounded, backgrounded, briefly offline, and reconnecting.

**Acceptance criteria:** A non-host Android client enters the sealed role screen within the realtime/polling SLA without process restart whenever another client starts the match.

### APP2-003 — P1 — Android players cannot call an emergency meeting

**Evidence:** The website has a `Call emergency meeting` control and calls `POST /api/v1/games/current/meetings` when `call_meeting` is present. Android has meeting display/voting code, but no call-meeting gateway method, ViewModel action, or task/status UI control. On the physical portrait layout the bottom bar contains only `Status` and `Evidence`.

This is not merely an untested edge case. With the default rules, crew members need a completed task before calling; APP2-001 prevents task completion, and even when the server grants `call_meeting`, Android provides no button to use it.

**Required change:**

- Add the meeting command to the Android API/gateway with `expectedStateVersion` and a stable idempotency key.
- Show a `Meeting` action in compact and expanded layouts.
- Derive enabled/disabled state only from the authoritative `call_meeting` capability and show the server-provided rule context: remaining calls, cooldown, and completed-task requirement.
- Require a confirmation dialog and explain that the caller identity is not shown.
- On 409/stale state, refresh the snapshot without consuming another idempotency identity.
- Add tests for eligible, cooldown-blocked, task-required, exhausted-limit, dead player, offline, duplicate tap, and successful transition cases.

**Acceptance criteria:** An eligible Android player can call a meeting, all clients receive the meeting, and the caller cannot bypass server rules.

### APP2-004 — P1 — Android host settings are not feature-equivalent to the website

On Android, the host can edit only:

- task pack/map;
- task phase duration;
- meeting duration.

`Show advanced settings` displays a read-only summary. The website additionally allows the host to edit:

- timed vs all-voted meeting mode;
- private vs public ballots;
- private vs shared evidence;
- impostor cooldown base;
- meeting cooldown;
- meetings per player;
- impostor task requirement for calling a meeting;
- impostor count within the server-provided safe range;
- easy/medium/hard tasks per player;
- optional crew-role allocation per role.

**Required change:**

- Replace the Android advanced summary with real accessible controls for every authoritative room setting supported by `RoomSettingsInput`.
- Keep a single draft model, dirty-state indicator, Apply action, server validation, conflict refresh, and unsaved-change protection.
- Use server-provided ranges/allowed counts where available; do not hard-code assumptions that can drift from the web client.
- Show role specialization/ability information before allocation.
- Ensure task-count totals remain 1–15 and do not exceed the selected pack's available difficulty counts.
- Add parity contract tests that apply the same settings from web and Android and compare resulting room snapshots.

**Acceptance criteria:** Any valid game configuration available to a website host can be created from Android, produces the same authoritative snapshot, and survives rotation/process recreation.

### APP2-005 — P1 — Same-room replay is missing from Android results

**Observed:** The Android result screen shows winner, end reason, player/task details, `Return home`, and a details toggle. The website/API support `POST /api/v1/rooms/current/replay`, but Android exposes no replay action.

**Required change:**

- Add host `Play again in this room` and non-host `Waiting for host` result actions.
- Reuse the current room and participants according to the same server replay contract as the website.
- Route the returned room snapshot back to Lobby, reset all per-game role/evidence/meeting state, and keep room settings intentionally according to product policy.
- Handle removed players, host transfer, replay conflict, expired room, duplicate tap, and offline retry.

**Acceptance criteria:** The host can start a second round without asking everyone to re-enter a code, and no private state from the first round leaks into the next.

### APP2-006 — P2 — Portrait `Status` control is a dead button

`TaskPhaseScreen` renders `GameOutlinedButton("Status", {}, ...)` on compact layouts. Tapping it performs no action. The expanded two-pane layout shows `StatusAndActions`, but portrait users cannot open an equivalent status panel.

**Required change:** Add a real Status destination/sheet containing life status, task pack, progress, meeting eligibility/rules, cooldowns, and authorized actions. Use the same control as the home for the meeting action from APP2-003. Add compact portrait, landscape, tablet, and back-navigation tests.

### APP2-007 — P2 — Accessibility nodes remain split after the prior semantics repair

Physical UIAutomator evidence still shows two same-bounds nodes for color choices and consent rows: an unlabelled checkable parent plus a separately labelled descendant. The same pattern appears in task-pack radio rows. This can create extra or blank TalkBack stops instead of one labelled radio/checkbox.

**Required change:**

- Build each selectable/toggleable control as exactly one merged semantic node with role, accessible name, state, and click action.
- Check modifier order: apply ownership semantics on the same node as `selectable`/`toggleable`, and fully clear descendant semantics before merging.
- Avoid `contentDescription` for visible text when semantic text can provide the accessible name without double announcement.
- Add unmerged-tree Compose assertions that each option has exactly one actionable node and no blank actionable sibling.
- Perform a real TalkBack traversal, not only UIAutomator/Compose assertions.

### APP2-008 — P2 — Website account and history features are absent

The website provides account sign-in/registration, profile/settings, game history, player/role outcomes, meeting/vote history, and game detail views. Android is guest-only and has no account or history destination.

**Required decision and change:** Decide explicitly whether Android is intended to be gameplay-only or website-feature-equivalent. If parity is required, implement the existing user-auth/session contracts, account recovery/security flows, profile/settings, paginated history, and history detail without storing evidence photos. If gameplay-only is intentional, document that scope in product requirements and release notes rather than claiming full website parity.

### APP2-009 — P2 — Website feedback and preference utilities are absent

The website has event sounds with a mute control and an explicit light/dark theme toggle. Android provides meeting haptics and follows its Compose theme, but no equivalent game audio feedback, mute preference, or in-app theme choice was found.

**Required decision:** Define cross-platform parity for sound and appearance. If required, add privacy-safe local sound effects, a persistent mute control, audio-focus handling, and System/Light/Dark preference. Never play a sound that leaks private evidence or role activity; follow the website's public/private event rules.

### APP2-010 — P2 — Existing placeholder task content is still published

The prior publish-time validation prevents new obvious placeholders but does not clean existing records. `Avengers` remains selectable alongside user-ready packs. Archive or replace all previously published placeholder packs through an audited administrative operation, then add a staging content-quality fixture and release checklist.

### APP2-011 — P3 — Default debug APK is not immediately testable

A standard `:app:installDebug` produced an empty `BuildConfig.API_BASE_URL`, and create/join displayed a generic connection error until the APK was rebuilt with `-PDEBUG_API_BASE_URL=http://127.0.0.1:3000`.

**Required change:** Provide a documented local-debug Gradle task/flavor with a safe localhost default, or fail at launch with a clear developer-only configuration screen/message. Release/staging variants must continue to fail closed and require approved HTTPS origins.

## Website parity matrix

| Flow or feature               | Website | Android result                                          | Status                                       |
| ----------------------------- | ------- | ------------------------------------------------------- | -------------------------------------------- |
| Guest create/join and consent | Yes     | Works on Acer                                           | Parity for tested path                       |
| Live lobby roster             | Yes     | Works for joins                                         | Partial; remote start transition fails       |
| Task pack and basic timers    | Yes     | Works with explicit Apply                               | Parity for basic subset                      |
| Advanced host settings        | Yes     | Read-only summary or absent                             | Missing                                      |
| Private role reveal           | Yes     | Hold reveal and fallback work                           | Parity                                       |
| Tasks and photo selection     | Yes     | List, picker, conversion, preview work                  | Partial                                      |
| Evidence upload/completion    | Yes     | Blocked by relative upload URL                          | Broken                                       |
| Impostor elimination          | Yes     | UI/source present; API-triggered parity result verified | Partial acceptance only                      |
| Player-called meeting         | Yes     | No Android call action                                  | Missing                                      |
| Meeting alert/result          | Yes     | Alert and resolved meeting render correctly             | Partial; full voting not accepted            |
| Evidence review/flagging      | Yes     | Source exists                                           | Not end-to-end accepted due evidence blocker |
| Ejection voting               | Yes     | Source exists                                           | Not end-to-end accepted in this run          |
| Terminal winner/details       | Yes     | Works on Acer                                           | Parity for tested imposter-parity result     |
| Same-room replay              | Yes     | No result action                                        | Missing                                      |
| Account/profile/history       | Yes     | No Android surface                                      | Missing or intentionally out of scope        |
| Game sounds/mute              | Yes     | No equivalent found                                     | Missing                                      |
| Explicit theme toggle         | Yes     | No in-app choice found                                  | Missing                                      |

## Confirmed working behavior

- Create and Join forms are usable, and invalid submission scrolls to visible corrective feedback.
- Consent gating, room-code lookup, available-color lookup, and server color assignment work.
- Realtime participant joins update the lobby without an app restart.
- Start remains disabled until the player minimum and an applied task pack are authoritative.
- Dirty lobby settings show `Settings changed` and an Apply action beside Start.
- Private role content remains sealed until deliberate reveal; the hold gesture and accessibility fallback work.
- Task cards, difficulty, progress, picker sheet, system photo picker, image conversion, and preview render correctly.
- An externally called meeting produces an immediate Android alert while gameplay is connected.
- Resolved meeting UI correctly hides private ballots when vote visibility is private.
- Terminal winner, end reason, self role/life status, game duration, task totals, player roles, and Return home render correctly.
- Force-stop/relaunch resumes the active session with the role resealed.
- No Android app fatal exception or ANR was observed during this audit.

## Required regression and acceptance run

1. Add deterministic Android integration coverage for relative signed-upload resolution and the complete evidence pipeline.
2. Add a two-client test where a remote host starts and Android must leave Lobby automatically.
3. Add meeting-call UI/gateway tests and complete discussion, evidence review, voting, tie, ejection, and return-to-task paths.
4. Add contract parity tests for every website room setting.
5. Run a minimum of three independently controlled UI clients; API-only peers may prepare state but do not count as full UX acceptance.
6. Complete crew-task and impostor paths, every winner/end reason, replay, host transfer, leave/abandon, expiry, stale version, duplicate idempotency key, websocket loss, process death, and offline recovery.
7. Repeat on compact portrait, compact landscape, tablet split layout, 200% font scale, and TalkBack.
8. Run `quality`, `connectedQuality`, backend checks, and the production-like multi-client suite twice from clean outputs.

## Definition of done

- APP2-001 through APP2-005 are implemented and demonstrated on a production-like backend.
- A valid Android photo completes a task and updates progress.
- A non-host client transitions to the sealed role screen without relaunch.
- Eligible Android players can call and complete meetings.
- Android can configure every in-scope website game setting, or product scope explicitly documents approved exceptions.
- Same-room replay works or is explicitly removed from parity requirements by an approved product decision.
- TalkBack exposes one correctly labelled actionable node per color, consent, and task-pack option.
- The three-client run reaches a terminal result and a second-round replay with no secret/token/role/ballot/evidence leakage and no P0/P1 defect.
