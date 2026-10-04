# Android API and realtime contract map

This is a navigation aid, not a replacement for `../../website/openapi/openapi.json` or `../../website/contracts/realtime-v1.schema.json`. Verify exact paths, bodies, status codes, and schemas before implementation.

## Entry/session

| Capability | Contract area | Client rule |
|---|---|---|
| Create room | `POST /api/v1/rooms` | Idempotent; store returned participant credential securely. |
| Join options | `GET /api/v1/rooms/{code}/join-options` | Use available legacy avatar IDs as Android color slots. |
| Join room | `POST /api/v1/rooms/{code}/participants` | Handle slot race without clearing other form fields. |
| Current room | `GET /api/v1/rooms/current` | Bootstrap/resume authority. |
| Rotate session | `/api/v1/participant-sessions/current/rotate` | Replace token safely; never expose old/new values. |
| End session | `DELETE /api/v1/participant-sessions/current` | Distinguish credential logout from eligible room leave. |

## Native account/session

| Capability | Contract area | Client rule |
|---|---|---|
| Google challenge | `POST /api/v1/auth/google/mobile/challenges` | Pass `login`, `play`, `post_game`, or `delete`; keep the transaction token and nonce in memory only. |
| Google completion | `POST /api/v1/auth/google/mobile/complete` | Return the nonce-bound Google ID token; store an issued account credential in the account Keystore only. |
| Profile/dashboard | `GET/PATCH /api/v1/me`, `GET /api/v1/me/dashboard` | Account bearer only; clear account state on authoritative `401`, never the participant session. |
| History/detail | `GET /api/v1/me/games`, `GET /api/v1/me/games/{id}` | Keep pages/details in memory; respect the response cursor and server visibility. |
| Devices | `GET/DELETE /api/v1/me/sessions...`, `DELETE /api/v1/account-sessions/current` | Account bearer; sign-out never implicitly leaves a participant seat. |
| Account rejoin | `POST /api/v1/me/participations/{id}/rejoin` | Send `X-Session-Transport: bearer`; secure the returned participant token before routing. |
| Delete account | `DELETE /api/v1/me` | Complete same-identity Google reauthentication first; server enforces the five-minute window. |

Account and participant bearers are independent. The route selects which credential type is valid;
never inspect a token to guess its type. Cookie Origin/CSRF enforcement remains for web mutations,
while native bearer requests use HTTPS, bounded bodies, rate limits, token validation, and no-store.

## Lobby

| Capability | Contract area | Client rule |
|---|---|---|
| Update settings | `PATCH /api/v1/rooms/current/settings` | Host/lobby capability; prevent stale responses. |
| Leave | `POST /api/v1/rooms/current/leave` | Explicit action only; active games reject permanent leave. |
| Start | `POST /api/v1/rooms/current/start` | Host only; server readiness is authoritative. |
| Replay | `POST /api/v1/rooms/current/replay` | ADR-A-027 approved; terminal phase only, idempotent, and route exclusively from the returned authoritative room snapshot. |
| Task packs | `/api/v1/task-packs...` | Published packs only. |

## Active game

| Capability | Contract area | Client rule |
|---|---|---|
| Snapshot | `GET /api/v1/games/current/snapshot` | Replace state; optional known version may return no change. |
| Kill | `POST /api/v1/games/current/kills` | Capability/cooldown/current-version controlled. |
| Call meeting | `POST /api/v1/games/current/meetings` | ADR-A-026 approved; require `call_meeting`, alive status, allowance/task/cooldown readiness, current state version, confirmation, and an idempotency key. |
| Upload intent | `/api/v1/task-assignments/{id}/upload-intents` | Follow returned upload instructions exactly. |
| Confirm submission | `/api/v1/task-assignments/{id}/submissions` | Task remains provisional until server accepts/processes. |
| Submissions | `GET /api/v1/games/current/submissions` | Visibility and short-lived media authorization apply. |
| Flag | `POST /api/v1/submissions/{id}/flags` | Capability, ownership, phase, and conflict controlled. |

## Meetings/results

| Capability | Contract area | Client rule |
|---|---|---|
| Current meeting | `GET /api/v1/meetings/current` | Participant-specific source for subphase/actions. |
| Review vote | `PUT /api/v1/evidence-review-items/{id}/vote` | Current-version/idempotency controlled; Android locks after the first accepted response. |
| Ejection vote | `PUT /api/v1/meetings/{id}/ejection-vote` | Null target means Skip; never calculate result locally. |
| Result | Game snapshot/result summary | Reveal only returned terminal fields. |

## Realtime

- Endpoint: `/realtime`
- Transport: WebSocket only
- Native authentication: `auth.token`
- Server messages: `server.ready`, `room.snapshot`, `game.snapshot`, `presence.changed`, `session.revoked`, `server.resync_required`
- Client messages: `heartbeat`, `room.resync`, `game.resync`
- Every typed message uses `schemaVersion: 1`.
- Full snapshots replace state. Version gaps require resync.
- Presence is approximate and never a durable leave signal.

## Mutation checklist

Before implementing any mutation, record:

- endpoint and method;
- authentication/capability;
- idempotency requirement;
- expected state version requirement;
- exact body and content type;
- success response and snapshot implications;
- validation, authorization, conflict, rate-limit, and retryable errors;
- whether user intent may be automatically retried;
- safe UI feedback and refresh behavior.
