# Phase 3 — Rooms, Participant Sessions, and Lobby

## Required reading and source of truth

1. [Master architecture plan](../MASTER_PLAN.md) — room/session rules and fixed 4–12-player policy.
2. [Database design](../DATABASE_DESIGN.md) — room, participant, and participant-session schema.
3. [API contract](../API_CONTRACT.md) — room, session, lobby, and realtime contracts.
4. [Security design](../SECURITY.md) — room-code threat model and participant credentials.
5. [System architecture](../ARCHITECTURE.md) — realtime and deadline behavior.
6. Previous handoff: `../context/PHASE_02_CONTEXT.md`.

## Objective

Implement temporary player identity, room creation/join, host controls, lobby roster, presence hints, and reliable reconnect without persistent accounts.

## Prerequisites

- Phase 2 complete.
- Room-code, nickname, expiry, host-transfer, and web credential-transport details approved. Capacity is fixed at 12.

## Features

- Create/join/leave room, select pack/settings, host transfer.
- Opaque scoped participant sessions and rotation.
- Authenticated realtime room subscription, presence, and snapshot recovery.
- Inactive lobby expiry.

## Database changes

- `rooms`, `participants`, `participant_sessions`, relevant idempotency/job support and partial indexes.

## Backend changes

- Room/session services, authentication principal, lobby authorization, code generation, nickname normalization, presence/deadline scheduler.

## Implementation work packages

1. Add room, participant, participant-session, and required idempotency migrations with partial uniqueness constraints.
2. Implement cryptographically random room codes with collision retry and an explicit reuse/cooling policy.
3. Implement transactional create-room and join-room use cases with normalized nickname uniqueness and capacity locking.
4. Implement opaque session issue, lookup, expiry, revocation, rotation, and web/native transport adapters.
5. Implement authenticated lobby snapshot and host-only pack/timer settings. Imposter and task counts remain server-derived.
6. Implement leave behavior, deterministic host transfer, disconnect grace, and inactive-room expiry.
7. Add realtime authentication, one-room subscription, initial snapshot, presence hints, reconnect backoff guidance, and forced resync.
8. Add cross-room, concurrency, restart, and token-redaction tests; update OpenAPI/realtime schema documentation.

Do not assign roles or allow games to start until Phase 4.

## API changes

- Room/session/lobby endpoints and `room.snapshot`, `presence.changed`, `session.revoked` messages.

## Security considerations

- Room enumeration limits, high-entropy session generation/hash, cross-room denial, cookie/Bearer handling, socket authorization, log redaction.

## Tests

- Concurrent joins at capacity; nickname normalization races; host leave/disconnect; session expiry/rotation/revocation; reconnect/version recovery; cross-room access.

## Completion criteria

- Multiple isolated clients can create, join, disconnect, and recover the same lobby.
- No important room state depends on process memory.
- Host transfer and expiry are deterministic and restart-safe.

## Context summary

Create `PHASE_03_CONTEXT.md` with credential flow, realtime protocol, room schema/API, timer behavior, known limitations, and Phase 4 starting point.
