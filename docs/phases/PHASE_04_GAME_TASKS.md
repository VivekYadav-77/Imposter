# Phase 4 — Game Start, Roles, Tasks, and Progress

## Required reading and source of truth

1. [Master architecture plan](../MASTER_PLAN.md) — final role, task, ghost, and win rules.
2. [Database design](../DATABASE_DESIGN.md) — game, participant, task snapshot, assignment, and event schema.
3. [API contract](../API_CONTRACT.md) — start, snapshot, version, and task contracts.
4. [Security design](../SECURITY.md) — secret-data projection and authorization matrix.
5. [System architecture](../ARCHITECTURE.md) — command transaction and realtime snapshot flow.
6. Previous handoff: `../context/PHASE_03_CONTEXT.md`.

## Objective

Turn a valid lobby into an authoritative game with secret roles, immutable task snapshots, real/fake assignments, safe player projections, and progress/win checks independent of photos.

## Prerequisites

- Phase 3 complete.
- Fixed balancing and ghost-task rules are approved. Only randomization implementation and exact task-phase timer bounds remain technical decisions.

## Features

- Transactional game start and secure role assignment.
- Pack snapshot and per-player task assignment.
- Temporary non-photo task completion endpoint used to validate the domain engine; remove or replace in Phase 5 before production.
- Player-specific game snapshot, progress, role secrecy, and initial win checks.

## Database changes

- `games`, `game_participants`, `game_tasks`, `task_assignments`, `game_events`; supporting constraints/indexes.

## Backend changes

- Pure state-machine/domain policies, random assignment service, game-row locking, DTO projection, versioning and state-change publication.

## Implementation work packages

1. Add game, game-participant, task-snapshot, assignment, and game-event migrations.
2. Implement pure policies for legal state transitions, fixed player bands, winner precedence, and capabilities.
3. Implement transactional start: lock lobby, verify 4–12 joined players and published pack, derive counts, securely shuffle roles/tasks, snapshot task text, create assignments, and activate room.
4. Generate three real crew assignments per crew member for 4–7 players and four for 8–12; generate equivalent-looking fake assignments for imposters.
5. Implement player-specific DTO projection and explicit serialization leakage tests for every role/life/phase combination.
6. Implement state version increments, idempotent commands, snapshot endpoint, and per-socket state notifications.
7. Add a test-only or explicitly development-only completion adapter to exercise progress/win behavior before evidence exists.
8. Verify restart/reconnect behavior and publish contract/schema changes.

The temporary completion adapter must be impossible to enable in production and must be removed when Phase 5 completes.

## API changes

- Start game, game snapshot, development-only task completion contract, game realtime messages.

## Security considerations

- Cryptographic randomness, role and real/fake assignment redaction, hydration/log leak tests, stale-state rejection.

## Tests

- Distribution invariants over many seeds; concurrent start; insufficient pack/player cases; snapshot matrices for every role/life state; task progress and win precedence.

## Completion criteria

- A lobby can become a recoverable game and clients see only their authorized role/tasks.
- Domain logic is transport-independent and concurrency-tested.
- No production client contract depends on the temporary completion path.

## Context summary

Create `PHASE_04_CONTEXT.md` with state machine, projection rules, schema/API/events, temporary path warning, and Phase 5 dependencies.
