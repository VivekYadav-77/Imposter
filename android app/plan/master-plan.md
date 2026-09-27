# Imposter Game Android master plan

**Document status:** implementation-ready planning baseline
**Implementation status:** not started
**Target:** native Android application written in Kotlin with Jetpack Compose
**Backend:** the existing versioned HTTP and realtime contracts in this repository

## 1. Product mission

Build a fast, private, reliable companion for an in-person social-deduction game. The phone supports the game; it must not become the game. A player should normally be able to look down, understand the next action within two seconds, act, and return attention to the room.

The Android v1 product includes:

- guest-first create and join flows;
- optional supported account flow only after its native contract is confirmed;
- session restoration after process death, backgrounding, rotation, and transport loss;
- lobby roster and host setup;
- private role reveal;
- task assignments and photo evidence;
- evidence gallery and flagging where authorized;
- imposter elimination controls where authorized;
- player-called meetings where the final product rules permit them;
- discussion, evidence review, private/public voting behavior, meeting outcome, and final results;
- portrait and landscape phone layouts, plus sensible foldable/tablet behavior;
- TalkBack, large text, reduced motion, high contrast, and non-color status cues.

Not in Android v1 unless separately approved:

- administrator and task-pack authoring screens;
- in-app chat;
- speculative game rules not returned by the server;
- offline gameplay or client-side winner calculation;
- visual reuse of the website's animal avatars.

## 2. Non-negotiable product principles

1. **The server is authoritative.** Never infer roles, winners, hidden totals, eligibility, deadlines, or phase changes locally.
2. **Snapshots replace state.** A room/game snapshot replaces the corresponding local in-memory model. Realtime messages are hints and delivery mechanisms, not a separate truth.
3. **Privacy by default.** Role, ballot, kill, and private evidence information must never leak through notifications, logs, analytics, screenshots, recent-app previews, accessibility text on unrelated screens, or cached previews.
4. **No accidental departure.** Back, rotation, backgrounding, socket loss, or activity destruction is a soft disconnect. Only an explicit eligible leave command removes a lobby seat.
5. **One obvious primary action.** Each screen communicates what is happening, what the player should do, and how much time remains.
6. **Accessibility is functional correctness.** Color, animation, sound, and gesture-only cues always have semantic alternatives.
7. **Adaptive, not duplicated.** Portrait and landscape share state and components; only composition changes.
8. **Dangerous actions are deliberate.** Leaving, ending a game, eliminating a player, calling a meeting, and submitting a ballot use clear selection and confirmation rules.

## 3. Canonical player avatar system

Android must not use, trace, imitate, or depend on the website animal avatars. All players use the same crewmate silhouette supplied by the product owner. The only visual variation is a unique color within the room.

Canonical geometry:

```xml
<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none">
  <path
    fill="currentColor"
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M55.087 40H83c13.807 0 25 11.193 25 25S96.807 90 83 90H52c-.335 0-.668-.007-1-.02V158a6 6 0 0 0 6 6h9a6 6 0 0 0 6-6v-18a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v18a6 6 0 0 0 6 6h9a6 6 0 0 0 6-6V54c0-14.36-11.641-26-26-26H77c-9.205 0-17.292 4.783-21.913 12ZM39 86.358C31.804 81.97 27 74.046 27 65c0-9.746 5.576-18.189 13.712-22.313C45.528 27.225 59.952 16 77 16h26c16.043 0 29.764 9.942 35.338 24H147c9.941 0 18 8.059 18 18v65c0 9.941-8.059 18-18 18h-6v17c0 9.941-8.059 18-18 18h-9c-9.941 0-18-8.059-18-18v-12H84v12c0 9.941-8.059 18-18 18h-9c-9.941 0-18-8.059-18-18V86.358ZM141 129h6a6 6 0 0 0 6-6V58a6 6 0 0 0-6-6h-6.052c.035.662.052 1.33.052 2v75ZM52 52c-7.18 0-13 5.82-13 13s5.82 13 13 13h31c7.18 0 13-5.82 13-13s-5.82-13-13-13H52Z"
  />
</svg>
```

Implementation rules:

- Convert this geometry into a vector resource or Compose `ImageVector`; do not ship the 800px SVG as a bitmap.
- Tint at runtime from one centralized `PlayerColor` palette.
- The backend's existing `avatarId` values are transport identifiers/color slots only. Android must map them deterministically to colors and must not display their animal names or artwork.
- A color is unique among current room participants. The server's available-ID response remains authoritative for selection conflicts.
- Always pair color with nickname and, where density allows, a stable text label such as “Blue”; never identify a player by color alone.
- Verify every palette color against both light and dark surfaces. Add an outline or contrasting container when a fill cannot reach required contrast.
- Preserve the same ID-to-color mapping across lobby, meetings, votes, results, reconnects, and history.
- Phase 0 must decide whether the server contract will be renamed to a neutral `playerColorId` in a future API or whether Android will keep the compatibility mapping for v1.

## 4. Primary user journey

```text
Cold start
  -> bootstrap/configuration
  -> restore secure participant session
  -> fetch current room
  -> resume lobby, game, or result when present
  -> otherwise Home

Home
  -> Join room -> validate code -> nickname -> available color -> consent -> lobby
  -> Create room -> nickname -> color -> consent -> lobby host setup

Lobby
  -> roster/presence + room sharing
  -> host completes required settings
  -> server says ready
  -> host starts

Role
  -> sealed privacy screen -> hold to reveal -> acknowledge -> automatically reseal

Task phase
  -> view assignments -> capture/select photo -> preview -> upload/processing -> completion
  -> optional evidence gallery/flag
  -> authorized imposter elimination
  -> authorized emergency meeting

Meeting
  -> discussion -> evidence review items -> ejection vote -> result
  -> return to tasks or terminal result

Game over
  -> winner/reason -> details/evidence/vote history as permitted -> replay/new room/home
```

## 5. Navigation and state model

Use a single-activity Compose application. Navigation represents destinations, but authoritative room/game phase controls which gameplay destination is valid.

Suggested top-level routes:

- bootstrap
- home
- enter-room/create
- enter-room/join
- lobby
- role
- tasks
- meeting/discussion
- meeting/review
- meeting/voting
- meeting/result
- game-result
- how-to-play
- privacy
- settings

Rules:

- Never place role, target, vote, or token data in route arguments or saved-state strings.
- On every authoritative snapshot, reconcile the current destination with the server phase.
- A stale deep link may navigate only after session and server validation.
- Back closes transient UI first. During an active game it never sends leave; it may background the app after a clear message.
- Dialogs, sheets, selected-but-unsubmitted choices, upload progress, and scroll positions survive configuration change where safe.
- Selected actions must be revalidated against the newest state version immediately before submission.

## 6. Adaptive layout policy

Use window size classes and actual available bounds, not device labels or orientation checks alone.

- **Compact width:** one content column, compact top app bar, bottom action bar, full-width sheets.
- **Medium width:** one main column with wider gutters or a supporting pane when it materially helps.
- **Expanded width:** list/detail or content/status two-pane layout with bounded content widths.
- **Compact height landscape:** short top bar, two-pane composition, scrollable content, confirmation controls kept visible without obscuring content.

Portrait is optimized for one-handed use. Landscape uses available width instead of merely stretching portrait cards. Folding features and display cutouts must not split primary controls. Camera UI follows sensor orientation while the rest of the activity retains state.

## 7. Recommended technical architecture

Use a pragmatic unidirectional architecture:

```text
Compose screen
  -> immutable UiState + one-shot UiEffect
  -> feature ViewModel
  -> use case (only when coordination adds value)
  -> repository
  -> HTTP / realtime / secure session / local preferences
```

Recommended modules; keep the initial project simpler if build overhead outweighs isolation:

```text
app
core:model
core:network
core:realtime
core:session
core:designsystem
core:testing
feature:entry
feature:lobby
feature:role
feature:tasks
feature:evidence
feature:meeting
feature:results
```

Architecture constraints:

- DTOs never enter composables.
- Domain/UI models expose only player-authorized fields.
- Repositories own transport coordination and snapshot replacement.
- ViewModels own screen state and cancellation; composables do not launch business requests directly.
- Use structured concurrency and observable immutable state.
- Model expected failures as typed results; do not parse display strings.
- Inject clocks, UUID/idempotency-key generation, dispatchers, transports, and repositories for deterministic tests.
- Avoid premature generic base classes and unnecessary use-case wrappers.

Exact dependency versions must be selected from currently supported stable releases at implementation time and recorded in `../context/decision-log.md`; do not copy stale versions into the build.

## 8. Data and realtime rules

- Native authentication uses `Authorization: Bearer <participant token>`.
- Store the participant credential only with an approved Android secure-storage approach; never in plain preferences, logs, crash reports, URLs, or analytics.
- HTTP business commands are authoritative.
- Connect Socket.IO using WebSocket transport at `/realtime` with `auth.token`.
- Accept only schema version 1 until a later version is deliberately supported.
- Replace local room/game state on complete snapshots.
- If state versions skip, emit `game.resync` or fetch the current snapshot.
- On `session.revoked`, clear the credential, stop reconnecting, clear sensitive memory, and return to a safe entry screen.
- Reuse one idempotency key and identical request body for retries of the same command.
- On state conflict, refresh; never silently repeat a user decision against changed state.
- Respect `Retry-After` for rate limits and use bounded exponential backoff with jitter for retryable failures.
- Store absolute deadlines and calculate remaining display time from a clock; the countdown never causes a phase transition.

## 9. Evidence and media rules

- Prefer the system photo picker for existing images and a controlled camera flow for new evidence.
- Request camera permission only at the moment the user chooses the camera.
- Do not request broad storage permission.
- Normalize orientation, enforce type/dimension/size limits, remove metadata according to server policy, and calculate the required checksum off the main thread.
- Follow the server upload-intent flow exactly: create intent, upload object using returned instructions, confirm submission.
- Upload UI is an explicit state machine: idle, preparing, requesting intent, uploading, confirming, processing, complete, retryable failure, terminal failure.
- A pending upload must not falsely mark a task complete.
- Never include evidence bytes, signed URLs, or filenames in logs/analytics.
- Short-lived evidence URLs must not be treated as permanent cache keys.

## 10. UI and interaction standard

- Minimum touch target: 48dp.
- Body text remains legible at supported font scaling; no essential text is clipped.
- Primary action is reachable near the lower thumb region on compact portrait screens.
- Every loading state explains what is happening and prevents duplicate commands without freezing unrelated navigation.
- Errors are specific, actionable, and retained long enough for assistive technology.
- Destructive or irreversible actions use confirmation; ordinary navigation does not.
- Sounds, haptics, animations, and color reinforce state but never carry meaning alone.
- Do not reveal private details in notification content. Prefer “The game needs your attention.”

## 11. Quality gates for every phase

A phase is complete only when all are true:

- stated deliverables and acceptance criteria pass;
- unit tests cover state transitions and failure paths;
- relevant integration/contract tests pass against representative fixtures;
- Compose previews or screenshot tests cover compact portrait, compact landscape, and at least one expanded width;
- TalkBack semantics and keyboard/switch focus were inspected for new interactive screens;
- large font, dark/light theme, system-bar insets, and process recreation were checked where relevant;
- no credentials, role data, evidence URLs, or private ballots appear in logs;
- no unresolved TODO is hidden in code—record it in `../context/current-state.md`;
- context and decision records are updated.

## 12. Execution protocol for AI agents

At the beginning of every implementation session:

1. Read this file, `../context/current-state.md`, and the active phase file.
2. Inspect `git status` and preserve unrelated user changes.
3. Verify every API assumption against the frozen contracts.
4. Select one milestone small enough to implement and verify completely.
5. State the milestone before editing.

During work:

- Prefer vertical slices that end in a testable user outcome.
- Do not implement later-phase screens as placeholders unless the active phase explicitly requires a seam.
- Do not redesign the backend silently. Record a blocker when the contract cannot express the approved behavior.
- Do not copy UI code, avatar assets, or layout measurements from the website.
- Treat compiler warnings, lint failures, flaky tests, accessibility regressions, and leaked sensitive data as defects, not cleanup.

At the end of every implementation session:

1. Run the narrowest relevant tests, then the phase gate if the milestone is complete.
2. Update `../context/current-state.md` with verified facts only.
3. Add durable decisions to `../context/decision-log.md`.
4. Update `../context/requirements-traceability.md` for completed requirements.
5. Leave one explicit next action and any blockers.

## 13. Definition of done for Android v1

Android v1 is done only when:

- the approved user journey works against a production-like backend;
- all authoritative phases recover correctly after rotation, process death, backgrounding, and reconnection;
- portrait and landscape are usable on the supported phone range;
- the single canonical avatar renders with unique, stable room colors everywhere;
- privacy, security, accessibility, and media-retention behaviors pass review;
- automated test suites and release checks pass from a clean checkout;
- crash-free and performance targets have been measured on representative low/mid/high devices;
- release signing, environment configuration, monitoring, rollback, and incident documentation exist;
- no Phase 0 contradiction remains unresolved.
