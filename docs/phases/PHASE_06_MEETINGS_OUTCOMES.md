# Phase 6 — Eliminations, Meetings, Voting, and Outcomes

## Required reading and source of truth

1. [Master architecture plan](../MASTER_PLAN.md) — final kill, ghost, review, tie, discussion, trigger, and win rules.
2. [Database design](../DATABASE_DESIGN.md) — meetings, votes, reviews, eliminations, events, and locks.
3. [API contract](../API_CONTRACT.md) — kill, meeting, review vote, ejection vote, and realtime contracts.
4. [Security design](../SECURITY.md) — killer secrecy, ballot secrecy, and dead-player restrictions.
5. [System architecture](../ARCHITECTURE.md) — durable deadlines and race behavior.
6. Previous handoff: `../context/PHASE_05_CONTEXT.md`.

## Objective

Complete the authoritative gameplay loop with kill validation, durable timed meetings, evidence review, ejection voting, life-state transitions, and final win resolution.

## Prerequisites

- Phase 5 complete.
- Immediate anonymous kill meeting, voice-only discussion, validity vote, valid-on-review-tie, no-ejection-on-tie, and no emergency meeting are approved. Exact cooldown/timers and whether pre-deadline vote changes/early advance are allowed must be finalized before coding this phase.

## Features

- Kill/cooldown and anonymous public transition.
- Discussion, evidence-review, voting, and result subphases.
- Durable deadlines and restart catch-up.
- Review resolution/reopened tasks, ejection tally, ghost restrictions, win/end state.

## Database changes

- `meetings`, review items/votes, ejection votes, eliminations, due-phase indexes and any required job records.

## Backend changes

- Meeting state policies, eligibility snapshots or deterministic eligibility rules, tally services, timer handlers, complete win checks and safe result projection.

## Implementation work packages

1. Add meeting, evidence-review item/vote, ejection-vote, elimination, and due-deadline migrations/constraints.
2. Implement kill authorization, cooldown, target eligibility, elimination, immediate anonymous meeting creation, state versioning, and post-kill win check in one transaction.
3. Implement spoken-discussion timer state; no text/voice messaging endpoints or storage.
4. Materialize unresolved flagged submissions as meeting review items and expose one authorized review view at a time.
5. Implement living-player validity voting and deterministic resolution: strict invalid majority reopens the task; tie/no-majority remains valid.
6. Implement secret ejection ballots and deterministic resolution: one unique highest target is ejected; any top tie or skip outcome ejects nobody according to the documented tally policy.
7. Implement durable deadline workers for discussion, review, voting, and result transitions using the same services as synchronous completion.
8. Re-run winner checks after kill, evidence invalidation/task change, and ejection; emit terminal state once.
9. Enforce ghost capabilities: eliminated crew may submit their remaining tasks but cannot flag/review/vote; eliminated imposters cannot kill.
10. Execute full-game multi-client matrices, race/restart tests, and publish final gameplay contracts.

Do not add emergency-meeting or chat endpoints in this phase.

## API changes

- Kill, current meeting, review vote, ejection vote, optional advance endpoint, terminal snapshot/events.

## Security considerations

- Killer identity never broadcast; secret ballots until resolution; dead-player restrictions; target/game scoping; replay/race resistance.

## Tests

- Kill/deadline race; duplicate kill/vote; every tie/majority/no-vote case; invalidated task effect; simultaneous win candidates; all role/life projection matrices; restart at each deadline.

## Completion criteria

- A multi-client API/realtime test completes full games for crew-task, crew-ejection, and imposter-parity victories.
- Every transition is deterministic, transactional, idempotent, and recoverable.
- Approved rules and API documentation agree.

## Context summary

Create `PHASE_06_CONTEXT.md` with complete gameplay behavior, schema/API/events, timer and tally semantics, test scenarios, limitations, and Phase 7 starting point.
