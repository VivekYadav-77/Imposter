# API Contract

**Status:** Proposed human-readable contract. Phase 1 will encode approved HTTP schemas in OpenAPI 3.1 and realtime schemas in a versioned catalog.

## 1. Conventions

### Base and media types

- Base path: `/api/v1`
- Request/response media type: `application/json`
- Timestamps: UTC RFC 3339 strings.
- IDs: opaque UUID strings; clients must not infer ordering or type from them.
- Optional fields are documented explicitly; omission is preferred over secret/null placeholders.
- Unknown request properties are rejected for command bodies.

### Authentication

- Participant API: `Authorization: Bearer <opaque-participant-token>` or equivalent same-origin Secure HttpOnly web cookie.
- Admin API: Secure HttpOnly admin session cookie.
- Public endpoints: health checks, room creation/join, and admin login only.
- A room code never authorizes access.

### Command headers

| Header                   |                    Required | Purpose                                         |
| ------------------------ | --------------------------: | ----------------------------------------------- |
| `Idempotency-Key`        | Yes for retryable mutations | Bounded client-generated unique key             |
| `If-Match-State-Version` | Yes for game-state commands | Reject stale commands with current version hint |
| `X-Request-ID`           |                    Optional | Accepted if valid; otherwise server creates one |

### Success envelope

```json
{
  "data": {},
  "meta": {
    "requestId": "req_opaque",
    "serverTime": "2026-09-20T12:00:00Z"
  }
}
```

List responses add a cursor:

```json
{
  "data": [],
  "meta": {
    "requestId": "req_opaque",
    "nextCursor": null
  }
}
```

### Error envelope

```json
{
  "error": {
    "code": "GAME_STATE_CONFLICT",
    "message": "The game changed. Refresh and try again.",
    "details": {
      "currentStateVersion": 18
    },
    "requestId": "req_opaque"
  }
}
```

Stable status usage:

| Status | Meaning                                                     |
| -----: | ----------------------------------------------------------- |
|  `200` | Successful query/update                                     |
|  `201` | Resource created                                            |
|  `202` | Accepted for asynchronous processing                        |
|  `204` | Successful action with no body                              |
|  `400` | Malformed JSON/protocol input                               |
|  `401` | Missing, expired, revoked, or invalid session               |
|  `403` | Authenticated but not permitted                             |
|  `404` | Resource absent or intentionally concealed                  |
|  `409` | State, uniqueness, capacity, or idempotency conflict        |
|  `413` | Request/file too large                                      |
|  `422` | Well-formed input violates validation/business precondition |
|  `429` | Rate limit exceeded; includes `Retry-After`                 |
|  `500` | Unexpected server failure with no internal detail           |
|  `503` | Required dependency unavailable; retryable when stated      |

Important error codes include `VALIDATION_FAILED`, `SESSION_INVALID`, `ROOM_NOT_FOUND`, `ROOM_NOT_JOINABLE`, `ROOM_FULL`, `NICKNAME_TAKEN`, `FORBIDDEN`, `GAME_STATE_CONFLICT`, `ACTION_NOT_ALLOWED_IN_PHASE`, `PLAYER_NOT_ELIGIBLE`, `UPLOAD_INVALID`, `IDEMPOTENCY_KEY_REUSED`, and `RATE_LIMITED`.

## 2. Core DTOs

### Participant self

```json
{
  "id": "uuid",
  "nickname": "Asha",
  "isHost": true,
  "connectionStatus": "connected",
  "lifeStatus": "alive"
}
```

`lifeStatus` is omitted before a game exists. Another participant's DTO contains only fields allowed by the current phase and never contains a session, role, or task-assignment secrecy field.

### Player-specific game snapshot

```json
{
  "gameId": "uuid",
  "stateVersion": 18,
  "phase": "task",
  "phaseDeadlineAt": "2026-09-20T12:10:00Z",
  "winner": null,
  "self": {
    "participantId": "uuid",
    "role": "crew",
    "lifeStatus": "alive",
    "canAct": true
  },
  "participants": [],
  "tasks": [],
  "teamProgress": {
    "completed": 7,
    "required": 15
  },
  "meeting": null,
  "capabilities": ["submit_evidence", "flag_evidence"]
}
```

The same snapshot route returns a differently projected `self`, task list, capabilities, and meeting data for each actor. The API never sends hidden fields and asks the client to conceal them.

## 3. Public and participant session endpoints

### `POST /api/v1/rooms`

Creates a room and its host participant atomically.

- Authentication: none.
- Authorization: public, rate-limited by IP/device signal.
- Idempotency: required.
- Body:

```json
{
  "nickname": "Asha"
}
```

- Validation: nickname 1–24 display characters after trim/normalization; no control characters.
- Response `201`: room summary, host participant summary, `sessionToken` for non-browser/native flow, and token expiry. The web adapter sets the equivalent HttpOnly cookie and omits the raw token from browser-visible DTOs.
- Errors: `409 NICKNAME_TAKEN` only in an idempotent replay anomaly; `422 VALIDATION_FAILED`; `429 RATE_LIMITED`.

### `POST /api/v1/rooms/{code}/participants`

Joins an open lobby.

- Authentication: none.
- Authorization: room must be in `lobby`, below capacity, and unexpired.
- Idempotency: required.
- Body: `{ "nickname": "Ravi" }`.
- Response `201`: room summary, participant self, session credential/expiry as above.
- Errors: `404 ROOM_NOT_FOUND`; `409 ROOM_FULL`, `NICKNAME_TAKEN`, or `ROOM_NOT_JOINABLE`; `429`.

### `POST /api/v1/participant-sessions/rotate`

- Authentication: participant.
- Authorization: own active session only.
- Idempotency: required; issuance response needs a design that does not persist raw tokens in idempotency storage.
- Body: `{}`.
- Response `200`: replacement token/expiry for native flow or rotated cookie for web; old token receives a short bounded overlap or is revoked immediately per final ADR.
- Errors: `401 SESSION_INVALID`; `409 SESSION_ROTATION_CONFLICT`.

### `DELETE /api/v1/participant-sessions/current`

- Authentication: participant.
- Authorization: current session.
- Response `204`; operation is naturally idempotent.

## 4. Lobby and room endpoints

### `GET /api/v1/rooms/current`

- Authentication: participant.
- Authorization: current session's room only.
- Response `200`: room status/settings, public participant roster, self capabilities, selected pack summary, and game ID if started.
- Errors: `401`; `404` if room was purged.

### `PATCH /api/v1/rooms/current/settings`

- Authentication: participant.
- Authorization: current host; lobby only.
- Idempotency: required.
- Body may contain selected pack ID and the approved configurable timers. At least one field is required; unknown fields are rejected.
- Player capacity is fixed at 12. Imposter and task counts are computed from the participant count when the game starts and are not host-editable in the MVP.
- Validation: timer values must be within server policy and the selected pack must be published.
- Response `200`: updated room/settings.
- Errors: `403 FORBIDDEN`; `409 ROOM_NOT_IN_LOBBY`; `422 VALIDATION_FAILED`.

### `POST /api/v1/rooms/current/leave`

- Authentication: participant.
- Authorization: own membership; lobby only for permanent leave in MVP.
- Idempotency: required.
- Body: `{}`.
- Response `200`: `{ "left": true }`. If host leaves, server transfers host or expires an empty room.
- Errors: `409 CANNOT_LEAVE_ACTIVE_GAME`.

### `POST /api/v1/rooms/current/start`

- Authentication: participant.
- Authorization: host; lobby only.
- Idempotency: required.
- Body: `{}`; server uses persisted settings.
- Validation: 4–12 joined players and a published viable pack. The server derives one imposter/three tasks for 4–7 players and two imposters/four tasks for 8–12 players.
- Response `201`: caller's player-specific game snapshot.
- Errors: `403`; `409 GAME_ALREADY_STARTED`; `422 ROOM_NOT_READY` with safe field-level reasons.

### `POST /api/v1/rooms/current/end`

- Authentication: participant.
- Authorization: host; intended for abandonment, not choosing a winner.
- Idempotency and expected state version: required once active.
- Body: `{ "reason": "host_ended" }`.
- Response `200`: terminal room/game summary.
- Errors: `403`; `409 GAME_STATE_CONFLICT`.

## 5. Game and task endpoints

### `GET /api/v1/games/current/snapshot`

- Authentication: participant.
- Authorization: participant belongs to current game.
- Query: optional `knownStateVersion` non-negative integer.
- Response `200`: complete player-specific snapshot, or `204` if the supplied version is current and no refresh is needed.
- Headers: `ETag` may mirror the game state version.
- Errors: `404 GAME_NOT_FOUND`.

### `POST /api/v1/task-assignments/{assignmentId}/upload-intents`

- Authentication: participant.
- Authorization: owns assignment; role/life rules allow task completion; task phase; no current accepted submission.
- Idempotency and expected state version: required.
- Body:

```json
{
  "contentType": "image/jpeg",
  "byteSize": 1240021,
  "checksum": "provider-supported-checksum"
}
```

- Validation: allowlisted type, positive size at or below limit, checksum syntax.
- Response `201`: opaque upload ID, expiry, method, signed URL/form fields, exact required headers, and server-generated object key omitted unless the client transport needs it.
- Errors: `403`; `409 ASSIGNMENT_ALREADY_COMPLETED`; `413`; `422 UPLOAD_INVALID`; `503 STORAGE_UNAVAILABLE`.

### `POST /api/v1/task-assignments/{assignmentId}/submissions`

Confirms that the direct object upload completed.

- Authentication: participant.
- Authorization: assignment owner and original upload-intent owner.
- Idempotency and expected state version: required.
- Body: `{ "uploadId": "opaque" }`.
- Server verifies object identity and metadata before accepting.
- Response `201`: submission DTO, assignment status, team progress, state version, and processing status.
- Errors: `409 UPLOAD_NOT_COMPLETE` or state conflict; `422 UPLOAD_INVALID`; `503 STORAGE_UNAVAILABLE`.

### `GET /api/v1/games/current/submissions`

- Authentication: participant.
- Authorization: current game; visibility determined by phase and approved rules.
- Query: `cursor`, `limit` (bounded), optional `flagged=true`.
- Response `200`: safe submission summaries with short-lived authorized image access, uploader display identity only where permitted, flag status, and next cursor.
- Sorting: stable by creation time then ID.

### `POST /api/v1/submissions/{submissionId}/flags`

- Authentication: participant.
- Authorization: living participant; current game; not own submission; submission eligible and unresolved.
- Idempotency and expected state version: required.
- Body: `{ "reason": "optional bounded text" }`.
- Response `201`: flag acknowledgement and safe submission status.
- Errors: `403 PLAYER_NOT_ELIGIBLE`; `409 ALREADY_FLAGGED` or `SUBMISSION_ALREADY_RESOLVED`; `422`.

## 6. Kill, meeting, and voting endpoints

### `POST /api/v1/games/current/kills`

- Authentication: participant.
- Authorization: living imposter; task phase; cooldown elapsed.
- Idempotency and expected state version: required.
- Body: `{ "targetParticipantId": "uuid" }`.
- Validation: target is another living participant in the same game.
- Response `201`: actor's new player-specific snapshot. Public state identifies the eliminated target and meeting, never the killer.
- Errors: `403 ROLE_NOT_ALLOWED`; `409 KILL_COOLDOWN`, `TARGET_NOT_ELIGIBLE`, `ACTION_NOT_ALLOWED_IN_PHASE`, or state conflict.

### `GET /api/v1/meetings/current`

- Authentication: participant.
- Authorization: current game participant.
- Response `200`: player-specific meeting DTO containing subphase, deadline, eligible roster, review item currently visible, own submitted decisions, and capability flags.
- Errors: `404 MEETING_NOT_FOUND`.

### `PUT /api/v1/evidence-review-items/{reviewItemId}/vote`

- Authentication: participant.
- Authorization: living eligible voter; review subphase.
- Idempotency and expected state version: required.
- Body: `{ "decision": "valid" }` where decision is `valid` or `invalid`.
- Semantics: replaces the caller's prior decision until the review item locks.
- Response `200`: own vote acknowledgement, aggregate participation count without revealing choices before resolution, and state version.
- Errors: `403`; `409 REVIEW_LOCKED`, wrong phase, or state conflict.

### `PUT /api/v1/meetings/{meetingId}/ejection-vote`

- Authentication: participant.
- Authorization: living eligible voter; voting subphase.
- Idempotency and expected state version: required.
- Body: `{ "targetParticipantId": "uuid" }` or `{ "targetParticipantId": null }` for skip.
- Semantics: replaces own vote until voting locks.
- Response `200`: own vote acknowledgement and aggregate number of votes cast, not live totals.
- Errors: `403`; `409 VOTING_LOCKED`, `TARGET_NOT_ELIGIBLE`, wrong phase, or state conflict.

### `POST /api/v1/meetings/current/advance`

- Authentication: participant.
- Authorization: host only; optional feature and only if policy permits early advance after all eligible actions are complete.
- Idempotency and expected state version: required.
- Body: `{}`.
- Response `200`: caller's new snapshot.
- This endpoint should be omitted from implementation if approval chooses server deadlines only.

Clients do not call a public “resolve vote” endpoint. The server resolves when all eligible votes arrive or the deadline job fires.

## 7. Task-pack discovery

### `GET /api/v1/task-packs`

- Authentication: participant.
- Authorization: published packs only.
- Query: `cursor`, `limit` (max 50), optional bounded `search`; sort fixed by name for MVP.
- Response `200`: ID, name, description, active task count, revision; never draft data.

### `GET /api/v1/task-packs/{packId}`

- Authentication: participant.
- Authorization: published pack only.
- Response `200`: pack summary and optionally task descriptions if product design permits preview. Proposed default: hosts may preview before selection.
- Errors: `404` for absent or non-published pack.

## 8. Administrator endpoints

### `POST /api/v1/admin/sessions`

- Authentication: none.
- Authorization: active pre-provisioned administrator.
- Body: `{ "email": "admin@example.com", "password": "..." }`.
- Response `204` with Secure HttpOnly cookie.
- Errors: generic `401 INVALID_CREDENTIALS`; `429` with `Retry-After`.

### `DELETE /api/v1/admin/sessions/current`

- Authentication/authorization: admin session.
- Response `204`; revokes server-side session and clears cookie.

### `GET /api/v1/admin/task-packs`

- Authentication/authorization: active admin.
- Query: cursor, bounded limit, status, search, sort allowlist.
- Response `200`: draft/published/archived summaries and next cursor.

### `POST /api/v1/admin/task-packs`

- Authentication/authorization: active admin.
- Idempotency: required.
- Body: name, optional description, and ordered 0–15 initial task descriptions.
- Response `201`: complete draft pack with revision.
- Errors: `409 PACK_SLUG_CONFLICT`; `422`.

### `GET /api/v1/admin/task-packs/{packId}`

- Authentication/authorization: active admin.
- Response `200`: complete pack, ordered items, status, revision, and timestamps.

### `PATCH /api/v1/admin/task-packs/{packId}`

- Authentication/authorization: active admin.
- Idempotency required; optimistic revision required in body or `If-Match`.
- Body: any mutable metadata and/or complete ordered item set.
- Response `200`: updated pack and incremented revision.
- Errors: `409 PACK_REVISION_CONFLICT`; `422`; archived packs require explicit restore policy.

### `POST /api/v1/admin/task-packs/{packId}/publish`

- Authentication/authorization: active admin.
- Idempotency and expected revision: required.
- Body: `{ "expectedRevision": 4 }`.
- Validation: name and approved number of active valid tasks.
- Response `200`: published pack.
- Errors: `409`; `422 PACK_NOT_PUBLISHABLE`.

### `POST /api/v1/admin/task-packs/{packId}/archive`

- Authentication/authorization: active admin.
- Idempotency and expected revision: required.
- Response `200`: archived pack. Existing game snapshots remain unchanged.

## 9. Realtime contract

### Connection

- Endpoint: `/realtime` on the same origin/host.
- Client sends participant credential during handshake using a transport that does not place it in logged URLs.
- Server authenticates and joins only the session's room channel.
- Connection rejection uses stable safe codes.
- Client heartbeat/reconnect policy is transport-specific and bounded with jitter.

### Server messages

```json
{
  "schemaVersion": 1,
  "type": "game.state_changed",
  "roomId": "uuid",
  "gameId": "uuid",
  "stateVersion": 18,
  "occurredAt": "2026-09-20T12:00:00Z",
  "data": {
    "snapshot": {}
  }
}
```

Initial message types:

| Type                     | Data                              | Notes                                           |
| ------------------------ | --------------------------------- | ----------------------------------------------- |
| `room.snapshot`          | Player-specific room DTO          | On authenticated connect and lobby changes      |
| `game.snapshot`          | Player-specific game DTO          | On connect and important transitions            |
| `game.state_changed`     | Version plus optional snapshot    | Client fetches snapshot if absent/gapped        |
| `presence.changed`       | Safe participant presence summary | Ephemeral hint only                             |
| `session.revoked`        | Reason code                       | Client stops reconnecting and clears credential |
| `server.resync_required` | Current version                   | Forces HTTP snapshot                            |

No secret value may enter a room-wide broadcast payload. Either project per socket or send only a version hint.

Client-to-server realtime messages are limited to subscription acknowledgement and heartbeat in the MVP. All business commands use HTTP so retries, status codes, idempotency, logs, and Android behavior remain consistent.

## 10. Compatibility policy

- Additive optional response fields are backward compatible; clients ignore unknown response fields.
- Request schemas remain strict to catch client mistakes.
- Renaming/removing fields, changing meaning, tightening accepted values incompatibly, or changing authorization semantics requires a new API/schema version or a migration window.
- Server supports at least the currently released web client and the supported Android release once Android exists.
- Deprecation includes documentation, telemetry, a sunset date, and a stable replacement.
- The OpenAPI document and contract tests must match deployed behavior before a phase is complete.

## 11. Rate limiting and pagination

Exact rate numbers are deployment configuration, not permanent API contract. Every `429` returns `Retry-After`; clients use exponential backoff with jitter.

Cursor pagination is used for task packs, submissions, and admin lists. Cursors are opaque and tied to the filter/sort. Offset pagination is avoided for changing lists.

Room snapshots, participant rosters, meetings, and personal task lists are intentionally unpaginated because hard room-size limits keep them bounded.

## 12. Contract decisions still open

- Socket.IO versus a lower-level WebSocket protocol; message semantics above remain unchanged.
- Final web cookie bootstrap flow without exposing the raw token to browser JavaScript.
- Whether pack task descriptions are previewable to hosts.
- Whether voters may replace a vote before its deadline.
- Whether the host may advance a fully-completed meeting subphase early; this is not an emergency-meeting capability.
- Exact cooldown/timer bounds and rate-limit values.
