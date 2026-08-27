# Phase 4 context — Game start, roles, tasks, and progress

## Delivered scope

Phase 4 adds transactional game start, cryptographically shuffled fixed-band roles, immutable task-pack snapshots, real crew and fake imposter assignments, player-specific game projections, versioned events, realtime game snapshots, stale-state rejection, and crew/imposter win policy. The game survives process restarts because all authoritative state and deadlines are persisted in PostgreSQL.

## State machine and policy

`src/modules/games/domain.ts` owns the transport-independent phase graph, fixed player bands, capability policy, and winner precedence. Games start in `task` at state version 1. Every later committed gameplay change increments the version and writes exactly one matching `game_events` row.

The fixed bands are one imposter and three assignments per player for 4–7 players, and two imposters and four assignments per player for 8–12. Crew victory is checked first when no living imposters remain, then when all real assignments are complete. Imposters win only afterward when living imposters are at least the number of living crew.

## Projection and secrecy

`GET /api/v1/games/current/snapshot` and `game.snapshot` return only the requesting player's role and assignments. Roster life status, aggregate real-task progress, phase, deadline, and winner are public game data. Other roles, `counts_toward_progress`, kill availability, source item IDs, idempotency records, and internal event payloads are never serialized.

Alive players can act according to phase. Eliminated crew retain `complete_task` in task phase but cannot influence meetings. Eliminated imposters cannot complete tasks or kill. Host status adds only the explicit host capability and never reveals secrets.

## Schema, API, and realtime

Migration `000004_game_tasks.cjs` creates `games`, `game_participants`, `game_tasks`, `task_assignments`, `game_events`, and `game_idempotency_records`, with scoped foreign keys, progress indexes, phase/status checks, and one event per game version.

Implemented HTTP operations:

- `POST /api/v1/rooms/current/start`
- `GET /api/v1/games/current/snapshot` with optional `knownStateVersion` and `204` recovery optimization
- `POST /api/v1/development/task-assignments/{assignmentId}/complete`

Game mutations lock the room or game row, validate actor and expected version, write domain state/event/idempotency result atomically, commit, and only then publish player-specific `game.snapshot` messages. Reconnect and `game.resync` rebuild projections from PostgreSQL.

## Temporary path warning and Phase 5 dependencies

The development completion adapter is hard-disabled in production by `APP_ENV` and returns `404` there. It exists only to verify progress and wins before photo evidence is available. Phase 5 must replace it with upload-intent and confirmed-submission flows, reuse the same assignment ownership/version/win transaction, and remove the temporary route, schema, tests, and documentation before production release.
