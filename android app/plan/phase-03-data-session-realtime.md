# Phase 3 — networking, secure session, snapshots, and realtime

## Goal

Provide a tested, UI-independent client core that safely communicates with the existing backend and recovers from normal mobile failures.

## HTTP client

- Generate or hand-model only after assessing the OpenAPI output; do not let generated DTOs become domain models.
- Enforce HTTPS outside explicitly isolated local debug configuration.
- Add bearer authentication, content negotiation, request/correlation ID support, bounded timeouts, and cancellation.
- Add idempotency and expected-state-version metadata per command, not as an unsafe global retry interceptor.
- Decode the server error envelope into typed codes and safe details.
- Respect `Retry-After`; retry only documented transient failures with jitter and a strict bound.
- Never retry user decisions blindly after a `409` state conflict.

## Session storage

- Store participant credential with an approved encrypted/keystore-backed design.
- Keep credentials out of saved state, navigation, backups where inappropriate, logs, screenshots, clipboard, and analytics.
- Implement session bootstrap, rotation, expiry, revocation, explicit logout/leave distinctions, and secure clearing.
- If secure storage is unavailable or invalidated, fail closed and guide the user safely.

## Repository state

- Maintain one observable current-room state and one current-game state.
- Replace state on complete snapshots; never merge secrets from an older snapshot.
- Track load freshness, connection state, and last successful synchronization separately from game state.
- Ensure only one coordinated refresh/resync runs at a time.
- Protect against late responses overwriting newer state versions.

## Realtime

- Connect Socket.IO to `/realtime` using WebSocket only and `auth.token`.
- Handle `server.ready`, `room.snapshot`, `game.snapshot`, `presence.changed`, `server.resync_required`, and `session.revoked`.
- Implement heartbeat acknowledgement and documented reconnect backoff.
- Treat presence as approximate.
- On a state-version gap, resync instead of calculating the missing state.
- Stop reconnection permanently after revocation until a new session exists.
- Tie socket lifecycle to authenticated application session, not to one composable.

## Bootstrap state machine

```text
starting
  -> no credential -> entry
  -> credential -> fetch current room
      -> lobby -> lobby route
      -> active -> fetch game/snapshot -> authoritative phase route
      -> complete/abandoned -> result route
      -> invalid/revoked -> clear -> entry
      -> retryable failure -> recoverable offline screen
```

## Required tests

- Contract/fixture deserialization for every phase.
- Authorization header present and fully redacted from logs.
- Duplicate retry reuses idempotency key and identical body.
- Changed command creates a new idempotency key.
- Old response cannot replace a newer snapshot.
- Version gap triggers one resync.
- Reconnect backoff is bounded and cancellable.
- Session revocation clears sensitive state and stops reconnection.
- Process recreation returns to bootstrap and restores from server, not stale UI guesses.

## Exit criteria

- A non-UI integration test can authenticate, receive snapshots, reconnect, resync, and revoke safely.
- Every documented error category has a deterministic client policy.
- Sensitive-data logging tests pass.
