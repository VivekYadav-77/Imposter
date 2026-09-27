# Phase 4 — entry, create/join, resume, and lobby

## Goal

Deliver the first complete user journey: open the app, safely resume or create/join a room, share it, configure it as host, and wait/start with clear feedback.

## Entry experience

- Home prioritizes **Join room**, then **Create room**.
- Keep How to play, privacy, accessibility, and settings secondary.
- If an existing session exists, bootstrap routes directly to Resume/Return/View results instead of showing an unsafe duplicate-entry form.
- Guest play is the shortest path. Account sign-in is included only if approved and fully contracted in Phase 0.

## Join flow

1. Enter or paste six-character code; normalize permitted characters without hiding validation.
2. Fetch join options and spots remaining.
3. Enter nickname with server length/character validation.
4. Choose one available player color represented by the canonical silhouette.
5. Accept age/photo/privacy terms.
6. Join exactly once with a stable idempotency key.

Behavior requirements:

- Preserve room code and nickname across recoverable errors.
- If a chosen slot is taken concurrently, refresh choices, preserve other input, announce the conflict, and focus the picker.
- Support a future verified deep link/QR path without weakening room validation.
- Do not put participant credentials in links or QR codes.
- Keyboard next/done actions and focus order must work without touch.

## Create flow

- Collect nickname, unique color slot, and consent before creation.
- Put advanced room configuration in the lobby, not on the first screen.
- If min/max capacity remains user-configurable after Phase 0, expose it with clear policy bounds and test validation.
- A successful create routes to the same lobby implementation with host capability enabled.

## Lobby participant experience

- Make room code large, readable, copyable, and shareable.
- Roster shows canonical avatar color, nickname, self, host, and connected/away state.
- Regular players see “Waiting for host” and any server-provided readiness issue relevant to them.
- Provide explicit eligible Leave room; Back/background never calls it.
- Announce host transfer and material roster changes without excessive TalkBack interruption.

## Lobby host experience

- Show a setup checklist derived from authoritative settings/readiness:
  - required player count;
  - published task pack;
  - duration/task distribution where configurable;
  - meeting mode and duration;
  - vote/evidence visibility;
  - cooldowns, meeting limits, and approved advanced rules.
- Keep advanced settings collapsed by default.
- Save settings with debouncing or explicit Apply behavior chosen per control; prevent out-of-order responses.
- A sticky Start game action explains exactly why it is disabled.
- Start is confirmed only when accidental activation would materially harm the room; never add redundant confirmations.
- Host End/Leave behavior follows server state and receives destructive confirmation.

## Portrait/landscape

- Compact portrait: code/share, roster, then settings; sticky bottom host action.
- Compact landscape: roster pane left, scrollable settings pane right, bounded action area.
- Expanded: persistent roster and settings panes with no duplicated state owners.
- IME must not cover the active nickname/code fields or submit action.

## Required tests

- New guest create and join happy paths.
- Invalid, missing, full, expired room and rate-limited errors.
- Color-slot concurrency conflict.
- Duplicate submit prevention/idempotent retry.
- Resume lobby after process recreation and network loss.
- Host transfer and presence changes.
- Settings conflict/newer snapshot handling.
- Start-disabled explanations for every readiness cause.
- Portrait/landscape and large-font screenshots.
- TalkBack traversal from code entry through join.

## Exit criteria

- Two or more devices can create/join the same room and see consistent roster/presence.
- Rotation, backgrounding, and reconnect lose no seat or form state unexpectedly.
- Host settings and start behavior match the approved server contract.
- No animal avatar art or label appears in Android.
