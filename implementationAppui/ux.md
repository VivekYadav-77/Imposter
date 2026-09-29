# Android Website-Parity UI/UX Implementation Plan

**Document status:** implementation-ready plan; no application code is changed by this document
**Prepared:** 2026-09-28
**Target:** `android app/` native Kotlin/Jetpack Compose client
**Reference experience:** the current website in `app/` and `src/client/`
**Goal:** bring Android to the same product flow, visual language, feedback quality, settings coverage, game behavior, results experience, and—after native account contracts are approved—player dashboard experience as the website.

## 1. Instructions to the implementing AI agent

Treat this file as an execution specification, not as permission to invent missing product behavior.

Before changing Android code:

1. Read `android app/AGENTS.md`, `android app/plan/master-plan.md`, `android app/context/current-state.md`, `android app/context/decision-log.md`, the active phase file, and `android app/context/requirements-traceability.md` completely.
2. Inspect `git status` and preserve all unrelated or user-owned changes. Generated `android app/**/bin/` files are not source files and must not be committed.
3. Re-audit the current website source because it remains the reference:
   - `app/signal-room.css`
   - `app/game-command-center.css`
   - relevant dashboard styles in `app/globals.css`
   - `src/client/components/play-form.tsx`
   - `src/client/components/room-client.tsx`
   - `src/client/components/user-dashboard.tsx`
   - `src/client/audio/game-sounds.ts`
   - `src/client/components/theme-toggle.tsx`
4. Verify every request/response, capability, role, phase, setting, replay action, and account operation against `openapi/openapi.json`, `contracts/realtime-v1.schema.json`, and the corresponding server implementation. The server remains authoritative.
5. Work in the milestones below, one vertically complete and testable milestone at a time. Do not perform a single monolithic rewrite.
6. For every milestone, add failure-state tests and accessibility coverage in the same change, run the required gates, and update the Android context/decision/traceability files with verified facts only.
7. Do not mark a parity item complete because a similar-looking composable exists. Demonstrate the complete user outcome on a real device and compare it against the website flow.

## 2. Meaning of “same as the website”

Parity means the Android client must provide:

- the same brand mood, semantic colors, light/dark behavior, phase identity, information hierarchy, copy intent, and feedback;
- the same server-supported choices and game settings;
- the same authoritative state transitions, permissions, privacy rules, error recovery, results details, and account outcomes;
- equivalent sounds, haptics, animations, loading states, empty states, confirmations, and success/error feedback;
- equivalent ease of use, with native Android navigation, back behavior, system insets, touch targets, accessibility, and adaptive layouts.

Parity does **not** mean copying CSS pixels into Compose. Per the approved Android plan:

- do not copy website layout measurements verbatim;
- do not copy, trace, name, or ship the website animal avatars;
- keep the Android canonical crewmate vector and the approved stable 18-color transport-ID mapping;
- do not embed the website in a WebView;
- do not weaken Android privacy/security behavior to mimic a browser;
- do not expose a website feature whose native authentication or product decision is still unresolved.

The acceptance target is “recognizably the same product and flow, expressed correctly as a native Android app.”

## 3. Current-state gap summary

The implementing agent must confirm this table before editing because the worktree may evolve.

| Area              | Website reference                                                                  | Current Android state                  | Required outcome                                                                |
| ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Core palette      | charcoal/olive surfaces, warm paper, amber accent                                  | blue/cyan space palette                | replace Android theme tokens with website-equivalent semantic tokens            |
| Theme selection   | light/dark toggle with persisted choice                                            | follows system only                    | add System, Light, Dark; persist and apply without restart                      |
| Phase colors      | lobby cyan, tasks amber, meeting coral, voting violet, result green                | mostly generic Material primary/error  | introduce phase tokens and use them consistently                                |
| Typography        | Public Sans-style body + condensed display hierarchy                               | generic sans-serif only                | add licensed bundled fonts or approved native fallbacks with matching hierarchy |
| Surface language  | tactical command panels, soft borders, phase glow, paper/private surfaces          | generic Material cards                 | introduce native branded surfaces and restrained texture/gradient treatment     |
| Motion            | 120/200/480 ms system, phase/card/selection transitions                            | minimal/default motion                 | implement centralized motion specs and reduced-motion behavior                  |
| Sound             | 20 event cues plus meeting vibration                                               | absent                                 | implement privacy-safe event sound/haptic controller and user preferences       |
| Entry             | focused create/join funnel with clear selection and feedback                       | functional basic form                  | preserve behavior and redesign for parity/ease                                  |
| Lobby             | invite card, readiness, roster, full host settings, saved feedback                 | basic roster and partial settings      | reach setting and feedback parity                                               |
| Tasks/evidence    | phase dashboard, progress, clear upload state machine, gallery                     | functional but visually basic          | reach hierarchy, feedback, and interaction parity                               |
| Meetings          | discussion/review/vote/result, progress, public/private ballot behavior            | core phases implemented                | reach visual/copy/state parity; do not expose unapproved call-meeting behavior  |
| Final results     | outcome narrative, metrics, roster/roles/tasks, vote/evidence details, replay/home | basic final result/details             | implement complete result presentation; replay remains gated by ADR-A-008       |
| Dashboard/account | overview, stats, rooms, history, game detail, profile, sessions, account actions   | absent                                 | implement only after ADR-A-009 and native OAuth/session contracts are approved  |
| Accessibility     | responsive web semantics and reduced motion                                        | good baseline, incomplete parity proof | validate TalkBack, font scaling, focus, non-color cues, sound alternatives      |

## 4. Target design system

### 4.1 Semantic color tokens

Create semantic tokens in `core:designsystem`; composables must not scatter raw hex values. Translate the website values into Compose `Color` definitions and Material roles while retaining Android contrast requirements.

Core dark reference:

| Token          |     Value | Android use                    |
| -------------- | --------: | ------------------------------ |
| canvas         | `#0D0F0E` | app background                 |
| canvasSoft     | `#141714` | secondary background           |
| surface1       | `#171A17` | cards/sheets                   |
| surface2       | `#20241F` | controls/supporting panes      |
| surface3       | `#2A2F29` | pressed/raised state           |
| textPrimary    | `#F5F2E9` | main text                      |
| textSecondary  | `#C0BCAE` | supporting text                |
| textTertiary   | `#8D8B80` | nonessential metadata only     |
| border         | `#343931` | standard dividers/outlines     |
| borderStrong   | `#4D5548` | emphasized outline             |
| accent         | `#EF9C3D` | primary action/focus/brand     |
| accentStrong   | `#FFB45D` | emphasized accent              |
| accentInk      | `#211307` | text/icon on accent            |
| privateCanvas  | `#0B0C0B` | private role/reveal background |
| privateSurface | `#171411` | private content surface        |

Core light reference:

| Token         |     Value | Android use                |
| ------------- | --------: | -------------------------- |
| canvas        | `#F5F2EB` | app background             |
| canvasSoft    | `#EDE9DF` | secondary background       |
| surface1      | `#FFFDF8` | cards/sheets               |
| surface2      | `#EEE9DF` | controls/supporting panes  |
| surface3      | `#E2DDD2` | pressed/raised state       |
| textPrimary   | `#1D211E` | main text                  |
| textSecondary | `#5F625B` | supporting text            |
| textTertiary  | `#777A72` | nonessential metadata only |
| border        | `#D5D0C5` | standard dividers/outlines |
| borderStrong  | `#AEA99E` | emphasized outline         |
| accent        | `#AE550B` | primary action/focus/brand |
| accentStrong  | `#8F4207` | emphasized accent          |
| accentInk     | `#FFFAF1` | text/icon on accent        |

Phase tokens:

| Phase         |      Dark |     Light | Required usage                          |
| ------------- | --------: | --------: | --------------------------------------- |
| Lobby         | `#27B8C8` | `#087F91` | phase bar, readiness, lobby icon/accent |
| Tasks         | `#F0B63F` | `#A86100` | task phase identity and progress        |
| Meeting       | `#FF6A5D` | `#BF3D35` | alerts and discussion/review identity   |
| Voting        | `#8C7CFF` | `#5B4BC4` | selection and ballot-lock identity      |
| Results       | `#36C889` | `#14794E` | outcome/results identity                |
| Danger        | `#FF6555` | `#B73229` | destructive/error state only            |
| Ready/success | `#39C77F` | `#14794E` | success/completion                      |
| Pending       | `#F0B63F` | `#9A5B00` | waiting/processing                      |

Requirements:

- Map these into both `MaterialTheme.colorScheme` and a richer immutable `GameBrandColors` composition local for roles Material does not express.
- Keep `GameSemanticColors` for success/warning/danger/focus and extend it rather than deriving status from arbitrary Material colors.
- Add high-contrast light and dark variants; automated contrast tests must validate normal text at 4.5:1 and large text/icons at 3:1 minimum.
- Status and phase meaning must always include text, icon, shape, or semantics—not color alone.
- Keep the existing approved player-color palette independent of the brand palette.

### 4.2 Theme preferences

Implement a small preferences repository with:

- `ThemeMode.SYSTEM`, `ThemeMode.LIGHT`, and `ThemeMode.DARK`;
- `soundEnabled` (default true), `hapticsEnabled` (default true), `reduceMotion` (default follows relevant system accessibility state where detectable), and `highContrast` (default false);
- process-safe persistence using DataStore Preferences or another approved non-sensitive store;
- observable state injected above `ImposterGameTheme` so changes apply immediately without activity recreation;
- no room code, participant token, role, vote, evidence identifier, or other sensitive state in this store.

Add a theme control on Home and in the app Settings destination. During gameplay it may be a compact overflow/settings action; it must not obscure the primary action or reveal private state.

### 4.3 Type, shape, spacing, elevation, and iconography

- Use an approved, licensed condensed display face comparable to Barlow Condensed for phase labels/outcomes and a readable sans-serif comparable to Public Sans for body text. Bundle licenses when fonts are shipped. If licensing is not approved, use documented Android fallbacks; do not download fonts at runtime.
- Preserve font scaling through at least 200%; avoid fixed-height text containers.
- Translate the website rhythm into native tokens, not literal CSS values. Keep a compact spacing scale and use 10/18/30 dp-equivalent shape roles only where they remain usable on Android.
- Replace decorative elevation with subtle border plus tonal elevation. Avoid excessive shadows on low-end devices.
- Use one coherent Android vector icon set plus the canonical crewmate vector. Content descriptions belong on actionable icons; decorative icons are hidden from accessibility.
- Optional noise/texture must be a lightweight local vector/shader treatment, have no semantic purpose, and be disabled when it harms performance/high contrast.

### 4.4 Required reusable Compose components

Build or update components in `core:designsystem` before reskinning screens:

- `GamePhaseScaffold` and `PhaseTopBar` with phase token, identity, connection state, timer, and overflow;
- `BrandCard`, `TacticalPanel`, `PrivateRoleSurface`, and `ResultPanel`;
- primary, secondary, ghost, destructive, and compact icon buttons with 48 dp minimum targets;
- `GameChoiceCard`, radio-card group, segmented control, numeric stepper, dropdown/select sheet, and disclosure section;
- `IdentityToken`/`PlayerCard` using canonical crewmate, neutral color label, nickname, host/presence/life status;
- `ProgressTrack`, `ProgressDonut` or an accessible native equivalent, countdown, status chip, readiness meter;
- loading skeleton/state panel, inline validation, persistent banner, snackbar/toast, empty state, retry state;
- sticky compact-screen action area and adaptive supporting pane;
- confirmation dialog and modal sheet variants;
- result metric tile, result player row, vote feed row, and evidence row.

Every component needs light/dark/high-contrast previews and tests for semantics, 48 dp targets, disabled/loading state, long text, and large font.

## 5. Motion, sound, haptics, and effects

### 5.1 Motion system

Centralize the website timing language:

- quick: 120 ms for press, selection, icon rotation;
- standard: 200 ms for surface/color/content change;
- slow/emphasis: 480 ms for phase entry and major outcome reveal;
- easing: Compose `CubicBezierEasing(0.16f, 1f, 0.3f, 1f)` for emphasized entrances.

Use motion only to explain state:

- fade/slide phase content when the authoritative destination changes;
- stagger task/result cards slightly, capped so the screen becomes interactive immediately;
- animate selection border/check state, disclosure expansion, progress, upload state, and countdown urgency;
- use a restrained pulse/glow for newly ready actions, never continuously for ordinary content;
- meeting alert and final result may have one emphasized reveal;
- never animate private role content into a visible recent-app frame.

Reduced motion:

- when enabled, replace translation, scale, stagger, rotation, and pulsing with instant state changes or a short crossfade;
- respect Android animator-duration scale where practical;
- tests must verify the reduced-motion branch, not only the default branch.

### 5.2 Sound event parity

Create an injected `GameFeedbackController`/`GameSoundPlayer`; ViewModels or a UI-effect collector emit typed events, while composables never infer events by comparing display strings. Provide these website-equivalent event categories:

`ui`, `role-crew`, `role-imposter`, `player-join`, `game-start`, `meeting`, `vote`, `vote-select`, `vote-lock`, `upload-start`, `upload-failure`, `upload`, `task-complete`, `kill`, `eliminated`, `cooldown-ready`, `result`, `victory`, `defeat`, `easter-egg`.

Implementation requirements:

- use short, original/licensed local assets through `SoundPool` for low latency, or an approved native synthesis implementation; never scrape audio from a third party;
- normalize perceived loudness, avoid startling peaks, allow rapid UI clicks to be rate-limited, and do not overlap repeated authoritative events;
- play an event only once per stable event identity/state version so reconnect or recomposition does not replay it;
- pause/release audio correctly with lifecycle changes and never play private/outcome cues while the app is backgrounded;
- default sound on, expose a persistent mute toggle, and honor audio focus and device silent/DND expectations;
- pair important cues with visual text and optional haptic feedback.

Haptics:

- light tick for valid selection; confirmation for locked vote/completed task; warning pattern for meeting; stronger but restrained result/error pattern;
- use Android haptic APIs without adding unnecessary vibration permission where standard view haptics suffice;
- `hapticsEnabled` is independent from sound;
- never make sound or vibration the only notification of a phase/action.

## 6. User-flow and screen implementation

### Milestone 0 — parity contract and blockers

Before visual implementation:

1. Produce a checked parity inventory from the current website and Android screens.
2. Add/approve any design-system and preference architecture decisions in `decision-log.md`.
3. Resolve or explicitly keep blocked:
   - **ADR-A-006:** player-called emergency meetings;
   - **ADR-A-008:** same-room replay;
   - **ADR-A-009:** native account/Google sign-in and dashboard scope.
4. Do not treat the website cookie session as an Android bearer-token contract. Define native OAuth/deep-link/PKCE or another approved exchange, secure account credential storage, participant/account linking, logout/revocation, and reauthentication before dashboard implementation.
5. Add no placeholder button for a blocked behavior. A button that cannot complete its outcome is a defect.

Acceptance: the agent can state which parity requirements are implementable now, which exact API/capability enables them, and which remain blocked with an owner/decision.

### Milestone 1 — theme foundation and app settings

Likely files/modules:

- `core/designsystem/.../theme/Color.kt`, `Tokens.kt`, `Theme.kt`
- new theme/motion/brand token files as needed
- new non-sensitive preferences repository in an appropriate core module
- `MainActivity.kt` and app root composition
- new app Settings screen and reusable settings rows

Tasks:

- replace the blue/cyan Material scheme with the charcoal/amber light/dark system above;
- add phase and private/result semantic colors;
- wire System/Light/Dark selection and sound/haptics/reduced-motion/high-contrast preferences;
- apply correct system bar colors/icon appearance and edge-to-edge in all modes;
- add theme transition that respects reduced motion;
- ensure sensitive role surfaces remain intentionally dark/private even if the public theme is light, while preserving contrast.

Acceptance:

- changing theme updates all visible screens immediately and persists across process death;
- system theme changes update the app when System is selected;
- no old electric-blue/cyan brand roles remain except approved player colors;
- screenshot tests cover all theme/high-contrast combinations at compact and expanded widths.

### Milestone 2 — component, feedback, and navigation shell

Tasks:

- implement the reusable branded components in section 4.4;
- add typed one-shot UI effects for snackbar, announcement, sound, and haptic events;
- add the feedback controller and lifecycle handling;
- establish phase-aware animated navigation driven by authoritative state;
- make Android back close a dialog/sheet/disclosure first, then navigate safely; during an active game it must never send leave implicitly;
- keep one obvious primary action on every destination.

Acceptance:

- component catalog/previews show light, dark, large font, loading, error, selected, disabled, and reduced-motion cases;
- repeated recomposition/reconnect does not repeat sound/haptic events;
- TalkBack focus order and keyboard/switch focus are deterministic.

### Milestone 3 — Home, create/join, and lobby parity

Home and entry:

- use a branded hero with canonical crewmate art, concise promise, Join as primary, Create as secondary;
- keep “No account needed” and privacy messaging clear;
- use a mode-aware entry scaffold, immediate field validation, keyboard Next/Done actions, and actionable error copy;
- keep room-code normalization, nickname constraints, available-color authority, all consent rows, and photo/privacy links;
- show selected crewmate/color clearly; never show legacy animal names;
- provide loading, offline, expired/revoked session, resume retry, room full, and conflict states.

Lobby:

- phase top bar with Lobby identity and connection status;
- prominent share/copy room-code card with transient copied confirmation and sensitive clipboard expiry;
- readiness summary with joined/minimum/capacity and accessible progress;
- roster cards with crewmate, nickname, neutral color label, connected/away, host badge, and non-color status;
- player view focuses on roster and “waiting for host”; host view adds an adaptive settings pane;
- compact screens use disclosures/sheets and a sticky Start/Apply area; expanded screens use roster + settings two-pane layout.

Host settings must reach website/API parity:

- task pack/map;
- task-phase duration;
- meeting voting mode (`timed` / `all_voted`) and timed duration where relevant;
- vote visibility (`private` / `public`);
- evidence visibility (`private` / `public`);
- imposter cooldown base;
- meeting cooldown;
- meetings per player;
- imposter meeting task requirement (`one` / `none`);
- imposter count constrained by `allowedImposterCounts`;
- easy/medium/hard task counts constrained by selected pack and total limits;
- per-role counts constrained by selected pack/server rules.

Use the Android explicit Apply model already approved by ADR-A-016 unless that ADR is superseded. Do not silently copy the website debounce-save behavior. Make dirty/saving/saved/error status unmistakable and ensure Start flushes/applies valid settings or explains exactly what blocks it.

Tests/acceptance:

- host and non-host flows; long roster; disconnected participant; room capacity; task-pack load failure;
- every setting round-trips to the server snapshot and remote clients observe the same value;
- invalid combinations focus/announce the first bad control;
- a non-host transitions to role/game when the host starts without manual refresh;
- compact portrait, compact-height landscape, and expanded tablet remain usable at 200% font.

### Milestone 4 — private role, tasks, evidence, and authorized actions

Private role:

- full private surface, sealed by default, press-and-hold reveal plus an accessible alternative, explicit acknowledgement, and immediate reseal on background/focus loss;
- distinct crew/imposter sound and restrained visual reveal, both disabled/reduced according to preferences;
- show only server-authorized role/specialization/ability data; never cache or expose it through navigation, logs, screenshots, recents, or unrelated semantics.

Task phase:

- phase top bar with identity, connection, accessible countdown, and progress;
- clear crew progress summary and incomplete-first task list;
- completed, pending, processing, rejected, and unavailable states use text/icon/shape plus color;
- compact bottom actions for Status and Evidence; expanded layout uses task list + status/actions pane;
- show kill/elimination controls only from server capabilities and eligible target IDs;
- add player-called meeting UI only after ADR-A-006 approval and only when capability/cooldown/task requirement permit it.

Evidence flow:

- source chooser, system photo picker/camera, preparation, preview, upload intent, upload, confirm, processing, completion, retryable failure, terminal failure;
- one clear action at each stage, visible privacy/retention notice, cancel/retry behavior, and no false completion;
- gallery respects evidence visibility and authorization; flagging uses selection + confirmation and handles conflicts by refresh;
- image zoom/pan is accessible and bounded; no evidence bytes/URLs/filenames enter logs, analytics, saved state, or snapshots.

Acceptance:

- website-equivalent feedback events occur once for upload start/failure/success, task completion, cooldown ready, kill, and elimination;
- rotation/background/reconnect preserve only safe state and recover from the authoritative snapshot;
- the full evidence path succeeds on a real physical device for supported JPEG/PNG/WebP inputs.

### Milestone 5 — meeting, voting, and result parity

Meeting shell:

- meeting alert with visible assertive announcement, optional warning haptic, and sound;
- show anonymous/authorized meeting reason exactly as allowed by the snapshot;
- phase-specific discussion, evidence review, voting, and decision result panels;
- accessible countdown and participation/progress metrics.

Review:

- show the server-selected evidence item and allowed metadata only;
- accepted/rejected/flagged/processing/deleted image states have useful fallbacks;
- selection remains reversible until explicit confirmation; accepted submission locks according to ADR-A-018;
- conflict/expiry closes confirmation, refreshes, and explains what changed.

Ejection voting:

- canonical crewmate + nickname + life status for eligible choices, plus Skip;
- selection feedback, explicit review/confirm, locked state, votes-cast/required progress;
- private mode shows counts only; public mode shows server-returned voter-to-target rows;
- never derive or reveal a ballot absent from the authorized response.

Meeting result:

- decision stamp/phase treatment, ejected or no-ejection message, totals, skip count, and public vote feed only when allowed;
- use assertive semantics once, not on every recomposition;
- transition back to tasks or final result only from authoritative state.

Acceptance:

- timed and all-voted modes; private/public visibility; alive/eliminated user; review/no-review; skip/tie/ejection; expiry/conflict/reconnect are verified with independent clients;
- sound, haptics, animation, copy, and semantics reinforce the same state and never leak private ballots.

### Milestone 6 — terminal results, replay, and exit

Implement website-equivalent result hierarchy:

1. winner/outcome headline and reason-specific narrative;
2. at-a-glance players, completed/total tasks, and duration;
3. expandable full roster with crewmate, nickname, final role/crew role, life status, completed/total tasks;
4. vote details honoring public/private configuration;
5. final evidence section only where API authorization permits;
6. clear next actions.

Rules:

- victory/defeat/result feedback plays once based on the current participant’s authoritative role and winner;
- do not calculate winner, duration, task totals, or role revelation locally when the server has not supplied them;
- show “Play again” only after ADR-A-008 approval and implement `/api/v1/rooms/current/replay` with idempotency, loading, error, remote-client transition, and lobby restoration;
- until replay is approved, provide only explicit Leave/Go home behavior and never label it replay;
- leaving/end-session clears sensitive in-memory state and routes safely.

Acceptance:

- each end reason (`tasks_completed`, `imposters_ejected`, `imposter_parity`, `time_expired`, `abandoned`) has accurate copy;
- public/private vote result behavior matches the website contract;
- results survive rotation/reconnect and exit without exposing prior role data on Home.

### Milestone 7 — account, dashboard, history, and account settings (blocked until ADR-A-009)

Do not begin this milestone until native account authentication and credential ownership are approved and documented. Once approved, implement the same server-backed outcomes as the website, not a local imitation.

Navigation:

- signed-in root with Overview, History, Settings;
- compact bottom navigation, expanded navigation rail/sidebar, correct back stack and deep-link validation;
- signed-out and expired-session states route to an approved native sign-in flow.

Overview:

- player identity/profile summary;
- website-equivalent statistics including games/outcomes and task completion rate using `/api/v1/me/dashboard`;
- linked/current room cards with valid rejoin action using the authoritative participation endpoint;
- recent results and view-all history;
- loading skeleton, empty history, partial failure, retry, and expired auth states.

History:

- cursor-paginated game list from `/api/v1/me/games`;
- won/lost/abandoned state, task-pack name, date, and role;
- detail from `/api/v1/me/games/{gameId}` with roster, role/life/task records, eliminations, and public/private ballot rules;
- no evidence photos in account history unless a separately approved contract explicitly permits them.

Settings:

- App tab: System/Light/Dark, sound, haptics, reduced motion, high contrast;
- Profile tab: display name and approved color/avatar transport ID;
- Devices tab: sessions, current-device labeling, revoke one, revoke all others, expiry information;
- Account tab: sign out and destructive account deletion with recent Google reauthentication where required;
- destructive actions need explicit confirmation and must clear account and participant credentials according to the approved linking rules.

Post-game upgrade:

- only after the native auth/linking contract is approved, offer a dismissible “save this result” sign-in prompt for guests;
- guest users must still be able to see results, leave, or replay (if approved) without creating an account.

Acceptance:

- tests cover auth success/cancel/failure, token expiry, account/participant linking, history privacy, session revocation, logout, deletion/re-authentication, process death, and deep-link spoof rejection;
- dashboard data is server-derived and consistent with the website for the same account.

## 7. Recommended source organization

Do not reorganize working code merely for aesthetics. Extract feature modules only when the milestone benefits from ownership/test isolation. A reasonable destination is:

```text
app/
  navigation/
  ui/home/
  ui/settings/
  feedback/
core/designsystem/
  theme/
  motion/
  component/
  avatar/
core/preferences/
feature/entry/
feature/lobby/
feature/role/
feature/tasks/
feature/evidence/
feature/meeting/
feature/results/
feature/account/       # only after ADR-A-009
feature/dashboard/     # only after ADR-A-009
```

Maintain immutable UI state and typed UI effects. DTOs remain in data/network; composables receive sanitized domain/UI models. Repositories own HTTP/realtime coordination and authoritative snapshot replacement.

## 8. Accessibility and ease-of-use definition of done

Every new or changed screen must pass all of the following:

- minimum 48 dp targets and adequate spacing between destructive/primary actions;
- TalkBack announces screen/phase title, timer meaning, progress, selected state, validation, loading, error, and completion;
- headings and focus traversal are logical; focus does not jump on realtime refresh;
- color is never the sole status cue; canonical color includes nickname and localized neutral color label;
- 200% font scaling does not clip essential text or hide the primary action;
- switch/keyboard navigation works for controls, dialogs, sheets, and vote choices;
- portrait, landscape, split-screen, and tablet layouts use available bounds rather than orientation assumptions;
- reduced motion, high contrast, light/dark, silent audio, and disabled haptics remain fully usable;
- time-sensitive actions expose readable countdown text and do not rely on rapid animation;
- loading prevents duplicate commands but does not freeze unrelated safe navigation;
- error messages state what failed and what the player can do next;
- dangerous actions name the consequence and require confirmation;
- privacy-sensitive screens remain protected from screenshots/recents/overlays as already designed.

## 9. Test and verification plan

### Automated tests

- theme token and contrast unit tests for light/dark/high-contrast;
- preference persistence/migration tests;
- sound/haptic event deduplication, mute, lifecycle, and background tests;
- ViewModel transition tests for every flow, error, retry, conflict, expiry, and blocked capability;
- repository/MockWebServer tests for every newly exposed setting, replay, and account operation;
- Compose UI tests for semantics, focus, selection, confirmation, loading, empty/error states, and 48 dp targets;
- screenshot/golden tests for compact portrait, compact-height landscape, and expanded tablet in light/dark plus representative large-font/high-contrast/reduced-motion cases;
- privacy tests ensuring no credential, room code where disallowed, role, ballot, evidence URL/bytes, or signed upload value enters logs/saved state/analytics/test snapshots.

### Physical-device parity matrix

Use the connected Acer device; do not substitute a simulator when the acceptance task explicitly requires the physical tablet. Also run supported API/device coverage later as required by Phase 8.

Compare website and Android side by side for:

1. cold start and failed/successful secure resume;
2. create room and join room;
3. host/non-host lobby and every setting;
4. remote player joins/leaves/reconnects and host starts;
5. crew and imposter role reveal/reseal;
6. task list, evidence select/camera/preview/upload/process/complete/retry;
7. authorized elimination and meeting trigger;
8. discussion, review, vote selection/confirmation, private/public results;
9. all final-game reasons and details;
10. replay when approved, otherwise leave/home;
11. theme/settings persistence;
12. account/dashboard/history/settings only after approved native auth is available.

For multiplayer acceptance, use at least three independently controlled clients against an approved production-like backend. One person rapidly switching identities on a single client is not sufficient evidence.

### Required gates per milestone

Run the narrowest tests during development, then at minimum:

```powershell
cd 'android app'
.\gradlew.bat spotlessCheck lintDebug testDebugUnitTest --no-parallel --max-workers=1
.\gradlew.bat quality connectedQuality --no-parallel --max-workers=1
```

Run repository web/contract gates whenever shared contracts or backend behavior change:

```powershell
npm run check
```

Also run `git diff --check`, inspect the release/privacy gates relevant to the milestone, and record device/build/backend details with the result. Never claim a manual or physical-device check that was not actually performed.

## 10. Delivery sequence and commit boundaries

Use small professional commits in this order:

1. `feat(android): align brand theme and appearance preferences`
2. `feat(android): add motion sound and haptic feedback system`
3. `feat(android): redesign entry and lobby for website parity`
4. `feat(android): complete host settings parity`
5. `feat(android): align role tasks and evidence experience`
6. `feat(android): align meeting voting and result experience`
7. `feat(android): complete terminal results and replay` (only after ADR-A-008)
8. `feat(android): add native account and dashboard experience` (only after ADR-A-009)
9. `test(android): add cross-theme accessibility and parity coverage`

Do not mix generated binaries, unrelated worktree edits, credentials, recordings containing private role data, or local environment settings into commits.

## 11. Final acceptance checklist

The overall project is complete only when all applicable items are checked with evidence:

- [ ] Android light/dark visuals use the approved website-equivalent charcoal/amber brand system.
- [ ] System/Light/Dark choice persists and all screens update correctly.
- [ ] Phase colors, private surfaces, results, status, and focus treatment are consistent.
- [ ] Typography, spacing, components, and adaptive layouts form one coherent native system.
- [ ] Motion matches the website’s intent and reduced motion removes nonessential movement.
- [ ] All listed sound events are mapped, deduplicated, lifecycle-safe, and user-controllable.
- [ ] Haptics are optional and never the only state signal.
- [ ] Create/join/lobby flows match website outcomes and recovery behavior.
- [ ] Every server-supported host setting is editable, validated, persisted, and reflected remotely.
- [ ] Role, tasks, evidence, authorized actions, meetings, voting, and results maintain server authority and privacy.
- [ ] Final results provide the same authorized outcome, metrics, roster, votes, and evidence details as the website.
- [ ] Replay is either fully implemented after approval or clearly documented as blocked with no dead UI.
- [ ] Native account/dashboard/history/settings are either fully implemented after approval or clearly documented as blocked with no fake/local substitute.
- [ ] TalkBack, 200% font, contrast, non-color cues, focus, touch targets, landscape, and tablet checks pass.
- [ ] Three-client production-like gameplay parity is verified end to end.
- [ ] Android `quality` and `connectedQuality`, web/contract checks, and privacy review pass.
- [ ] `current-state.md`, `decision-log.md`, and `requirements-traceability.md` accurately reflect verified completion and remaining blockers.

## 12. Explicit non-goals and prohibited shortcuts

- No WebView wrapper or shared browser session cookie workaround.
- No website animal avatars, names, traces, or copied assets in Android.
- No client-calculated phase, eligibility, winner, ballot visibility, role, or progress.
- No private data in routes, preferences, logs, analytics, screenshots, notifications, or saved state.
- No unlicensed fonts, sounds, icons, or visual assets.
- No placeholder dashboard, replay, emergency-meeting, or sign-in action.
- No visual-only rewrite that ignores error, reconnect, loading, empty, permission, and accessibility states.
- No claim of “same to same” based only on screenshots; behavior, privacy, recovery, and real multiplayer outcomes are part of parity.

## 13. Implementation record — 2026-09-29

Implemented and verified in the current worktree:

- charcoal/amber light, dark, high-contrast, phase, private, and result semantic tokens;
- persistent System/Light/Dark, sound, haptics, reduced-motion, and high-contrast preferences, including system reduced-motion detection for the initial default;
- phase-aware top bars, branded lobby invitation/readiness UI, adaptive host settings, private-role treatment, bounded evidence zoom, and expanded terminal results;
- all server-supported host settings with constrained task/role counts, local validation, explicit Apply, and authoritative snapshot payloads;
- typed native feedback mappings for all 20 categories, with authoritative transition emission for gameplay events, stable-identity deduplication, rate limiting, lifecycle gating, mute, and independent haptic control;
- unit coverage for brand tokens/contrast, preferences, feedback gating, and host-setting validation;
- passing `quality` and physical Acer/API 33 `connectedQuality` gates; debug APK installation, launch, dark/light visual inspection, and light-theme persistence after force-stop/relaunch.

Intentionally not implemented because the required decision or environment is absent:

- player-called meetings — blocked by ADR-A-006;
- same-room replay — blocked by ADR-A-008;
- native account, OAuth, dashboard, history, profile, and device/account settings — blocked by ADR-A-009;
- production-like three-client acceptance, full TalkBack/200% font phase traversal, and the complete API 26/31/36 device matrix — require approved staging and independent clients under Phase 8.

No placeholder control was added for any blocked feature. See `android app/context/current-state.md`, ADR-A-024 in `android app/context/decision-log.md`, and `android app/context/requirements-traceability.md` for the verified boundary.
