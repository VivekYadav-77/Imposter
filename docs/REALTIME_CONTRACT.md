# Realtime contract v1

Socket.IO is served at `/realtime` with WebSocket transport only. Authentication uses `auth.token`, an `Authorization: Bearer` header, or the `__Host-participant_session` cookie; credentials are never accepted in a query string. A valid socket is subscribed only to its authenticated room, participant, and session channels.

Every typed server message contains `schemaVersion: 1`, `type`, `occurredAt`, and (when room-scoped) `roomId`.

| Message                  | Data                                                | Recovery behavior                                              |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------- |
| `room.snapshot`          | Complete participant-specific lobby snapshot        | Replaces local lobby state; sent on connect and lobby changes. |
| `presence.changed`       | `participantId`, `presence` (`connected` or `away`) | Ephemeral hint; a later snapshot is authoritative.             |
| `session.revoked`        | Stable `reason`                                     | Clear the credential and stop reconnecting.                    |
| `server.resync_required` | Stable `reason`                                     | Fetch `GET /api/v1/rooms/current` or emit `room.resync`.       |
| `server.ready`           | Schema version and timestamp                        | Connection acknowledgement.                                    |

Clients may emit `heartbeat` with an acknowledgement callback. The acknowledgement includes the server time and the recommended reconnect policy: exponential backoff from 500 ms to 10 seconds with jitter. Clients may emit `room.resync` to request a new snapshot. Business commands remain HTTP-only.

Presence is intentionally approximate. The final socket disconnect for a participant records `disconnected_at`; reconnection clears it. After the configured grace period, durable maintenance deterministically transfers a disconnected lobby host to the earliest joined participant, preferring a connected participant.
