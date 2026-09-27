# Phase 5 — private role, tasks, evidence, kills, and meeting calls

## Goal

Implement the high-frequency gameplay loop with strong privacy, safe media handling, and authorization-driven controls.

## Private role reveal

- Enter on an opaque sealed screen; the role is never visible during navigation transition.
- Ask the player to check their surroundings.
- Use an accessible press-and-hold reveal with a clearly available alternative for users unable to hold.
- Show role, optional crew specialization, objective, and one acknowledgement action.
- Reseal immediately on background, loss of window focus, screen lock, screen capture attempt where supported, and return from system UI.
- Use secure-window behavior for role and other approved sensitive screens.
- Do not persist revealed state across process death.

## Task screen

- Header shows authoritative phase, deadline countdown, self identity, connection state, and crew progress.
- Incomplete tasks appear before complete tasks unless the product decision specifies fixed order.
- Each card shows sequence, description, difficulty text/icon, and evidence state.
- Evidence states: no photo, preparing, uploading, confirming, processing, complete, rejected/retry.
- One tap opens task detail/capture choices; do not start camera without explicit intent.
- Bottom action bar/supporting rail provides Status, Evidence, and Meeting according to layout.
- Eliminated/ejected state explains exactly which actions remain available.

## Camera and upload pipeline

1. Player chooses Camera or system Photo Picker.
2. Request only the permission required at that moment.
3. Capture/select and show a safe preview.
4. Allow Retake/Choose another or Submit.
5. Normalize image according to approved policy off the main thread.
6. Request upload intent with exact metadata/checksum/state version.
7. Upload using returned method, URL/form fields, and required headers.
8. Confirm submission.
9. Show server processing until an authoritative snapshot/submission status completes or rejects it.

Pipeline requirements:

- Cancellation and retry are explicit and do not duplicate submissions.
- Temporary files have scoped ownership and deterministic cleanup.
- EXIF/location and unsupported metadata are removed as required.
- Memory usage is bounded; never decode full-resolution images unnecessarily.
- Backgrounding must not lie about success. Choose foreground-only continuation or an approved constrained worker and document it.
- Signed URLs and evidence files never enter general logs or unbounded caches.

## Evidence gallery and flagging

- Fetch only evidence permitted by current phase/visibility.
- Use paginated, lifecycle-aware loading and short-lived image access.
- Full-screen preview supports zoom without exposing unrelated private metadata.
- Flag action appears only with server capability and never on own evidence.
- Confirm flag with plain consequences; handle already-flagged/resolved conflict by refreshing.
- Empty, processing, expired-image, retry, and forbidden states are designed.

## Imposter elimination

- Render only when the snapshot capability authorizes it.
- Keep it visually separated from normal task completion.
- Show cooldown and eligibility without revealing hidden server information.
- Flow: open control -> choose eligible player -> review nickname/color -> confirm -> submit with current version.
- On conflict or phase change, close stale confirmation, refresh, and explain that the opportunity changed.
- Never show killer identity in public meeting state or notifications.

## Player-called meeting

- Render only when approved in Phase 0 and allowed by capability/rules.
- Explain cooldown, prerequisite task, remaining calls, and current unavailability.
- Flow: tap -> concise rule/consequence confirmation -> submit once -> server routes all clients from snapshot.
- Sound/haptic/visual meeting alert is preference-aware and non-secret.

## Required tests

- Role never appears in recent-app preview/screenshot where platform policy allows protection.
- Role reseals on all lifecycle/privacy events and orientation changes.
- Crew, imposter, alive, killed, and ejected variants.
- Every upload state and failure, including process/background transitions.
- Oversize/unsupported/corrupt images and permission denial.
- Evidence visibility and flag authorization.
- Kill cooldown, target conflict, phase race, and duplicate-command protection.
- Meeting prerequisites/limits/cooldowns.
- Low-memory image test and slow/offline upload behavior.
- Portrait/landscape/large-font/Screen Reader scenarios.

## Exit criteria

- Full task/evidence loop succeeds on a physical device against staging.
- Private role/kill information does not leak through UI lifecycle, logs, notifications, or caches.
- Client never marks a task complete before authoritative confirmation.
- All controls are driven by server capabilities, not role-name guesses.
