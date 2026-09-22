# Realtime contract v1

This contract is frozen at schema version 1. The machine-readable catalog is `contracts/realtime-v1.schema.json`, with examples in `contracts/fixtures/realtime-v1.json`. The additive/backward-compatibility policy is documented in `CLIENT_INTEGRATION.md`.

Socket.IO is served at `/realtime` with WebSocket transport only. Authentication uses `auth.token`, an `Authorization: Bearer` header, or the `__Host-participant_session` cookie; credentials are never accepted in a query string. A valid socket is subscribed only to its authenticated room, participant, and session channels.

Every typed server message contains `schemaVersion: 1`, `type`, `occurredAt`, and (when room-scoped) `roomId`.

Room and game snapshots carry the participant's stable `avatarId`. This is an additive v1 field:
replace the entire local snapshot as usual, retain the avatar across reconnects, and use the same
identity in lobby, meeting, voting, and result views.

| Message                  | Data                                                                         | Recovery behavior                                                      |
| ------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `room.snapshot`          | Complete participant-specific lobby snapshot                                 | Replaces local lobby state; sent on connect and lobby changes.         |
| `game.snapshot`          | Complete participant-specific game snapshot plus `gameId` and `stateVersion` | Replaces local game state; sent on connect and committed game changes. |
| `presence.changed`       | `participantId`, `presence` (`connected` or `away`)                          | Ephemeral hint; a later snapshot is authoritative.                     |
| `session.revoked`        | Stable `reason`                                                              | Clear the credential and stop reconnecting.                            |
| `server.resync_required` | Stable `reason`                                                              | Fetch `GET /api/v1/rooms/current` or emit `room.resync`.               |
| `server.ready`           | Schema version and timestamp                                                 | Connection acknowledgement.                                            |

Clients may emit `heartbeat` with an acknowledgement callback. The acknowledgement includes the server time and the recommended reconnect policy: exponential backoff from 500 ms to 10 seconds with jitter. Clients may emit `room.resync` to request a new snapshot. Business commands remain HTTP-only.

Clients may emit `game.resync` to request their current authorized game snapshot. A client that observes a version gap must use `game.resync` or `GET /api/v1/games/current/snapshot`; realtime delivery is only a committed-state hint.

Presence is intentionally approximate. The final socket disconnect for a participant starts a short, configurable grace window; reconnecting during that window cancels the transition to `away`. After the window, `disconnected_at` is recorded, while any concurrent reconnect is reasserted last to avoid stale presence. After the host grace period, durable maintenance deterministically transfers a disconnected lobby host to the earliest joined participant, preferring a connected participant.

For `all_voted` meetings, the server uses a dynamic quorum: every connected eligible voter plus any away voter whose ballot is already locked. A brief transport loss remains covered by the presence grace window. Once a player is durably `away`, their missing ballot no longer blocks evidence review or ejection voting. At least one ballot is required, and the persisted phase deadline remains a last-resort recovery mechanism.
