# Phase 3 context — Rooms, sessions, and lobby

## Delivered scope

Phase 3 adds persisted rooms, participants, participant sessions, room-command idempotency, host-controlled lobby settings, deterministic host transfer, inactivity expiry, and authenticated room realtime. Phase 4 remains responsible for creating games, assigning roles/tasks, and enabling start.

## Credential flow

- Room creation and join atomically create a participant and an opaque, room-scoped session.
- Native clients receive `sessionToken` and use `Authorization: Bearer`.
- Web clients send `X-Session-Transport: cookie`; the server sets `__Host-participant_session` (`Secure`, `HttpOnly`, `SameSite=Strict`) and omits the token from JSON.
- Cookie-authenticated mutations require an allowed `Origin`.
- Only HMAC hashes are stored. Idempotent issuance derives the token from a server secret, session UUID, and idempotency key, so replay works without storing a raw credential.
- Rotation creates a replacement session and gives the old session a 30-second overlap. Sign-out and leave revoke immediately.

## Room schema and API

Migration `000003_rooms_sessions.cjs` creates `rooms`, `participants`, `participant_sessions`, and `room_idempotency_records`, including partial indexes for active room codes and joined nickname uniqueness. Capacity is fixed to 12. Nicknames use NFKC, trimmed/collapsed whitespace, and case-folded uniqueness.

Implemented endpoints:

- `POST /api/v1/rooms`
- `POST /api/v1/rooms/{code}/participants`
- `GET /api/v1/rooms/current`
- `PATCH /api/v1/rooms/current/settings`
- `POST /api/v1/rooms/current/leave`
- `POST /api/v1/participant-sessions/current/rotate`
- `DELETE /api/v1/participant-sessions/current`
- authenticated published task-pack reads

Room codes use six characters from an ambiguity-free 32-character alphabet. Allocation retries collisions and refuses reuse for 24 hours after room creation; the active-code partial unique index closes concurrent races.

## Realtime protocol

The Socket.IO handshake accepts the same bearer/cookie credential. Each socket joins exactly one authenticated room. It receives an initial `room.snapshot`; lobby changes send fresh per-socket snapshots. `presence.changed`, `session.revoked`, heartbeat/backoff guidance, `room.resync`, and `server.resync_required` are documented in `docs/REALTIME_CONTRACT.md`.

## Timers and restart behavior

Lobby expiry is a persisted `expires_at` value (default two hours), not an in-memory timeout. Participant `disconnected_at` is persisted and drives host transfer after a 30-second default grace. The maintenance loop runs on startup and periodically, so expiry and transfers recover after restart. Host selection is earliest join time, then participant UUID, with connected participants preferred after disconnect grace.

Default lobby timers are task 900 seconds, discussion 90, review 60, and voting 60. Bounds are enforced in Zod and PostgreSQL. Phase 4 will consume these persisted values.

## Known limitations and Phase 4 starting point

- Presence is a hint and may briefly lag an abrupt network failure until Socket.IO detects disconnect.
- Public create/join requests have a conservative in-process per-IP burst limit. Production ingress should add a shared edge limit before horizontal scaling.
- The initial topology is one application instance. Realtime fan-out needs a shared adapter before horizontal scaling.
- Phase 4 should lock the room row, validate 4–12 joined participants and a viable published pack, derive imposter/task counts, snapshot tasks, create the game, and only then transition the room to `active`.
