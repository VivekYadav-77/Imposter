# Phase 1 — Backend Foundation

## Required reading and source of truth

1. [Project entry point](../../README.md)
2. [Master architecture plan](../MASTER_PLAN.md)
3. [System architecture](../ARCHITECTURE.md)
4. [Database design](../DATABASE_DESIGN.md)
5. [API and realtime contract](../API_CONTRACT.md)
6. [Security design](../SECURITY.md)
7. [Phase 0 handoff](../context/PHASE_00_CONTEXT.md)

If documents conflict, the approved decisions in the master plan win; update all affected documents in the same change.

## Objective

Create the smallest runnable, testable backend foundation that proves deployment, database, transaction, configuration, observability, HTTP contract, and realtime composition choices without implementing game features.

## Prerequisites

- Architecture approval checklist resolved.
- Supported Node/Next/PostgreSQL targets selected.
- ADR decisions or spikes for query layer, realtime library, credential transport, and hosting artifact.

## Features

- Custom persistent server composition root.
- Versioned `/api/v1` routing and common response/error envelope.
- Liveness/readiness endpoints.
- Configuration validation and structured logging.
- Empty authenticated realtime handshake skeleton, without game rules.

## Database changes

- Migration framework and test database harness.
- Initial extension/config decisions and migration metadata only.
- Transaction and row-lock integration spike.

## Backend changes

- Module boundaries, dependency direction, error taxonomy, request IDs, graceful shutdown.
- Database pool, repository conventions, test fixtures.
- OpenAPI generation/validation workflow.

## Implementation work packages

1. **Decision records:** run focused spikes and record the query layer, migration tool, realtime library, web credential transport, test stack, and deployment artifact strategy.
2. **Project bootstrap:** initialize the supported TypeScript/Next.js project and package scripts without feature UI.
3. **Composition root:** create the custom persistent Node server, attach Next request handling and an authenticated-but-featureless realtime endpoint.
4. **Configuration:** validate environment variables at startup and separate local, test, and production configuration.
5. **Persistence:** configure the pool, migrations, transaction helper, repository boundary, and isolated integration database.
6. **HTTP foundation:** implement `/api/v1`, validation, common envelopes, request IDs, error mapping, body limits, and health endpoints.
7. **Observability and shutdown:** add structured redacted logs, basic metrics hooks, signal handling, pool/socket draining, and fatal-startup behavior.
8. **Contract pipeline:** generate/validate OpenAPI and fail CI when checked-in contracts drift.
9. **CI baseline:** run formatting/linting, type checking, unit tests, database integration tests, build, and contract validation.

Do not create game, room, evidence, meeting, or admin feature tables in this phase.

## API changes

- `GET /health/live`, `GET /health/ready`.
- Common envelopes, header conventions, and generated API documentation in non-production or protected form.

## Security considerations

- Secrets/config validation, safe logs, baseline headers, body limits, CORS policy, dependency scanning.
- No sample secret committed to source control.

## Tests

- Unit test harness, database integration test, migration up/down policy test where safe, health/API envelope tests, graceful startup failure test.

## Completion criteria

- Production-like build runs through the custom entry point.
- CI runs lint/type/tests/contract validation.
- A transaction/lock test passes against PostgreSQL.
- Readiness distinguishes process health from dependency health.
- Architecture docs and ADRs reflect chosen libraries/versions.
- A clean checkout can be configured, migrated, tested, built, started, health-checked, and stopped using documented commands.

## Context summary

Create `docs/context/PHASE_01_CONTEXT.md` with exact commands, versions, modules, migrations, configuration names, decisions, limitations, and Phase 2 starting point.
