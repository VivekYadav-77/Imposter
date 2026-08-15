# Phase 0 Context — Architecture Planning

## Completed

- Product brief analyzed.
- Proposed master plan, architecture, database, API, security, and seven dependency-ordered implementation phases documented.
- Architecture, ER, and game-state diagrams included as Mermaid source.

## Current Architecture

- Proposed modular monolith in one persistent Node process.
- Next.js HTTP application with a custom server for realtime transport.
- REST commands/queries plus player-specific WebSocket snapshots.
- PostgreSQL source of truth; private S3-compatible object storage.
- In-process scheduler/worker initially; no Redis or external queue.

## Database State

- No database, migrations, ORM, schema, or seed data exists.
- `DATABASE_DESIGN.md` is a proposal, not implementation evidence.

## API State

- No endpoints or realtime server exist.
- `API_CONTRACT.md` is a proposed human-readable contract; OpenAPI has not been generated.

## Important Decisions

- Server-authoritative state machine and player-specific DTO projection.
- Opaque room-scoped participant sessions; separate administrator authentication.
- One initial deployment instance; durable deadlines stored in PostgreSQL.
- Task-pack snapshot at start; evidence in private object storage.

The seven gameplay/privacy choices that were open in the original plan are resolved: immediate anonymous meeting after kill, crew ghost tasks, separate evidence vote with valid-on-tie, in-person voice discussion, fixed player/imposter/task bands, no emergency meetings, 18+ participation, and 24-hour terminal-game photo retention. Remaining unchecked architecture items still require approval before Phase 1 implementation.

## Security State

- Threats and controls are documented only.
- No credentials, secrets, security middleware, or infrastructure have been created.

## Known Issues

- Realtime library, query layer, image processor, hosting provider, and exact supported versions require Phase 1/5 ADRs.

## Intentionally Deferred

- All executable implementation.
- Web and Android client UI.
- Accounts, remote chat, GPS, emergency meetings (post-MVP only if deliberately redesigned), and distributed scaling infrastructure.

## Next Phase Dependencies

- Resolve the remaining architecture approval checklist items.
- Authorize Phase 1.
- Select supported runtime/database targets and execute focused library/deployment spikes.

## Next Phase Starting Point

Read `MASTER_PLAN.md`, `phases/PHASE_01_FOUNDATION.md`, this context, and the current repository. Do not create feature tables or game logic in Phase 1.
