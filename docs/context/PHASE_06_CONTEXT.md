# Phase 6 context — Meetings and outcomes

## Delivered scope

Phase 6 completes the authoritative gameplay loop. `GameService` now owns kills, meeting creation, sequential evidence review, ejection voting, life-state changes, all winner checks, and durable phase advancement. Every command locks the game row, validates the expected state version, writes one audit event for the new version, and publishes realtime state-change hints only after commit.

## Final gameplay policy

- A living imposter may kill another living participant only during task play and after cooldown. A successful kill records the secret actor internally, publicly identifies only the eliminated target, snapshots the remaining living voters, and immediately begins discussion unless the kill itself produces a terminal winner.
- Discussion is spoken in person. The server stores only the phase and deadline; there are no chat or emergency-meeting APIs.
- Meeting eligibility is snapshotted after a kill (or at the task deadline). Eliminated players cannot review or vote. Crew ghosts can continue their remaining assignments during later task phases; eliminated imposters cannot kill.
- Flagged accepted submissions are snapshotted once into ordered review items. Exactly one unresolved item is exposed at a time. Votes are replaceable until that item locks. A strict invalid majority reopens the assignment; a tie or no votes keeps it valid. Flags are permanently resolved with the item.
- Ejection votes are secret and replaceable until voting locks. A unique non-skip highest target is ejected. A tie, a skip lead/tie, or no votes ejects nobody. Only aggregate totals are exposed after resolution.
- A subphase advances early only when every eligible voter has acted. Otherwise its durable deadline controls advancement. There is no host advance endpoint.
- After a non-terminal vote, results are displayed for 10 seconds. Returning to task play gives each living imposter a 30-second cooldown and starts a fresh configured task deadline.

## Schema and persistence

Migration `000006_meetings_outcomes.cjs` adds `meetings`, `meeting_eligible_voters`, `evidence_review_items`, `evidence_review_votes`, `ejection_votes`, and `eliminations`. Constraints enforce one unresolved meeting per game, one immutable review occurrence per submission, one vote per voter/subject, ordered review items, and one elimination per target. Due meeting/game deadlines are indexed.

Killer identity is retained only in internal meeting/elimination actor columns. Public DTOs and events do not include a killer field. Ballot rows remain private; the meeting result projection derives totals only after resolution.

## API and realtime contract

The generated OpenAPI 3.1 contract is version 0.6.0 and adds:

- `POST /api/v1/games/current/kills`
- `GET /api/v1/meetings/current`
- `PUT /api/v1/evidence-review-items/{reviewItemId}/vote`
- `PUT /api/v1/meetings/{meetingId}/ejection-vote`

Game snapshots now include the authorized meeting projection. It contains the public trigger/target, eligible roster, only the currently open review item, the caller's own decisions, participation counts, capabilities, and post-lock result totals. Existing `game.state_changed` realtime hints carry the committed version; reconnecting clients fetch the player-specific snapshot.

## Timer and recovery behavior

`GameService.runDueTransitions()` polls persisted `games.phase_deadline_at`, locks and rechecks the game, and uses the same resolution helpers as synchronous all-votes completion. It advances task deadline → discussion → review items → voting → result → task. The server runs the worker every second. A restart loses only the in-memory polling interval; overdue database state is caught up after startup. Game-row locking and state versions serialize deadline/command races.

## Winner semantics

Winner checks use the approved precedence after kills, invalidation-related task changes, evidence completion/rejection, and ejections:

1. Crew wins when no living imposters remain.
2. Crew wins when all real crew assignments are complete, including ghost assignments.
3. Imposters win when at least one imposter remains and living imposters are at least living crew.

Terminal updates set the game winner/end timestamp, clear the deadline, complete the room, and emit exactly one terminal version. Evidence retention scheduling remains owned by the Phase 5 worker.

## Verification

Domain tests cover review no-vote/tie/majority and ejection unique-winner/tie/skip/no-vote cases in addition to winner precedence and every role/life/phase capability combination. PostgreSQL integration coverage exercises an idempotent anonymous kill, dead-player vote rejection, durable deadline transition, secret ballots, ejection, and crew terminal projection. Existing evidence tests cover provisional task completion/reopening and ghost-safe authorization.

## Limitations and Phase 7 starting point

The current worker is intentionally single-process and PostgreSQL-coordinated. It is safe across restarts and duplicate local execution, but multiple application replicas still require the shared realtime/distributed-worker work reserved for Phase 7. Local integration verification requires `TEST_DATABASE_URL`; the project CI provisions PostgreSQL, applies the full up/down/up migration sequence, and runs the integration suite.

Phase 7 should begin with load/race testing of deadline lag and simultaneous commands, production rate limits, deployment recovery drills, full DTO leakage review, and the stable client contract freeze.
