# Phase 6 — meetings, evidence review, voting, outcomes, and final results

## Goal

Implement the complete authoritative meeting and terminal-game journey without exposing hidden ballots or roles early.

## Meeting interruption

- A new meeting ID interrupts task UI with a clear, non-secret alert.
- Use visual state plus optional sound and haptic; never rely on only one channel.
- Alert exactly once per meeting across recompositions and reconnects.
- Route based on authoritative meeting/game phase, not a local timer.

## Discussion

- Show meeting number, trigger wording permitted by the contract, deadline/wait condition, and face-to-face discussion guidance.
- For a reported elimination, show only the victim information authorized by the snapshot.
- Show connection/quorum status without implying exact private choices.
- Dead/ejected players receive observer wording and no unauthorized controls.

## Evidence review

- Present one authoritative review item at a time.
- Show image, assignment text, progress position, and uploader only when permitted.
- Valid/Invalid selection has text, icon, selected state, and explicit confirmation.
- If Phase 0 approves replaceable decisions, allow changing until server lock; otherwise lock after accepted submission.
- Participation count never exposes choices before permitted resolution.
- Handle image expiry by refreshing the authorized item, not by retaining a stale permanent URL.

## Ejection voting

- Render eligible players as avatar + nickname + life/eligibility state where allowed.
- Provide a visually distinct Skip option.
- Selection is local and reversible until confirmation.
- Confirmation displays the chosen nickname/color or Skip.
- Post-submission behavior follows the Phase 0 mutability decision exactly.
- Private mode shows only aggregate participation count.
- Public mode shows only the ballot information returned by the server and only at the authorized time.
- Client countdown reaching zero disables stale submission and requests fresh state; it never computes a result.

## Meeting result

- Show ejected player or “No one was ejected,” plus safe totals/ballots according to visibility.
- Do not reveal role unless the terminal snapshot explicitly permits it.
- Automatically follow the next authoritative snapshot to tasks or final result.
- Accessibility announcement is concise and does not repeat continuously.

## Final result

Initial summary:

- winning side;
- end reason in plain language;
- own outcome/status;
- primary next action.

Expandable details where authorized:

- final roster using canonical color avatars;
- roles and crew specializations;
- completed/total tasks;
- vote record according to visibility;
- accepted final evidence;
- duration and task-pack name.

Replay/new-room behavior must follow the approved Phase 0 decision and server endpoint. Guests may be offered an account/save-result prompt only if the account contract is approved; it must not obstruct viewing results.

## Required tests

- Kill-, deadline-, and user-triggered meetings.
- Timed and all-voted quorum modes, including away participants.
- Evidence item sequence, replace/lock policy, expired image, and invalidation.
- Private/public voting, skip, tie, no ejection, disconnect, and lock races.
- Dead/ejected observer behavior.
- Meeting-to-tasks and meeting-to-terminal transitions.
- Every winner/end reason and abandoned game.
- Reconnect directly into each meeting subphase and terminal result.
- Vote/role privacy in logs, saved state, notifications, and accessibility semantics.
- Portrait/landscape and large-font screenshot tests.

## Exit criteria

- A multi-device scripted game can traverse every supported meeting path.
- Android output matches server snapshots under ties, skips, disconnects, and races.
- No hidden ballot/role is inferred or leaked.
- Terminal results can be restored after process death.
