# Phase 1 Context — Backend Foundation

**Status:** Implemented; local PostgreSQL integration verification requires an available test database  
**Date:** 2026-09-20

## Runtime and versions

- Node.js 24.x, npm 11.x
- Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3
- PostgreSQL 18 CI target
- Kysely 0.29.6, pg 8.23.0, node-pg-migrate 9.0.0
- Socket.IO 4.8.3
- Zod 4.6.5, Pino 10.3.1
- Vitest 5.0.1, Supertest 7.1.4

The lockfile is the exact dependency source of truth.

## Implemented modules

- `src/server`: persistent composition root and bounded graceful shutdown.
- `src/api`: `/api/v1`, health routes, envelopes, request IDs, CORS/security headers, bounded JSON reader, and OpenAPI source.
- `src/realtime`: authenticated Socket.IO handshake skeleton at `/realtime`.
- `src/infrastructure/configuration`: startup environment validation.
- `src/infrastructure/database`: PostgreSQL pool, Kysely boundary, readiness check, and transaction helper.
- `src/infrastructure/observability`: redacted JSON logger and initial metrics hooks.
- `src/shared`: common contracts and safe error taxonomy.

## Database state

Migration `000001_foundation.cjs` creates only the application-owned `app` schema. node-pg-migrate owns migration metadata. No feature tables exist. The integration test creates a uniquely named probe table in the isolated test database, verifies `SELECT FOR UPDATE` contention, and removes it.

## Configuration names

`APP_ENV`, `HOST`, `PORT`, `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, `DATABASE_READY_TIMEOUT_MS`, `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS`, `MAX_JSON_BODY_BYTES`, `EXPOSE_API_DOCS`, and `SHUTDOWN_TIMEOUT_MS`.

## Commands

```text
npm ci
npm run migrate:up
npm run dev
npm run check
npm run test:integration
npm run build
npm start
npm run migrate:down
npm run migrate:verify
npm run contracts:generate
npm run contracts:check
```

## Decisions

- ADR-001: Kysely + pg + node-pg-migrate; explicit locks under `READ COMMITTED`.
- ADR-002: Socket.IO using WebSocket transport; HTTP retains all business commands.
- ADR-003: Secure HttpOnly SameSite web cookie plus native bearer transport.
- ADR-005: provider-neutral OCI image, single instance.
- ADR-006: Vitest/Supertest and generated OpenAPI 3.1 contract validation.
- ADR-004 remains a Phase 5 image-processing decision.

## Operational behavior

- `/health/live` proves only that the process can serve HTTP.
- `/health/ready` checks PostgreSQL with a strict timeout and returns a safe `503` when unavailable.
- Configuration failure prevents the process from listening.
- API documentation is available at `/api/openapi.json` only when explicitly enabled.
- SIGINT/SIGTERM stop realtime connections, drain HTTP, and close the database pool within a configured bound.

## Limitations

- The realtime authentication port intentionally rejects all sessions until Phase 3 adds participant-session persistence.
- Metrics are process-local hooks; exporting them to the chosen monitoring platform is a deployment task.
- No hosting provider is selected; the OCI artifact is provider-neutral.
- No game, room, evidence, meeting, task-pack, or administrator tables/endpoints exist.

## Phase 2 starting point

Implement administrator provisioning/authentication and task-pack lifecycle using the accepted database, HTTP, credential, error, and contract boundaries. Add Phase 2 migrations and typed table interfaces without widening the realtime surface.
