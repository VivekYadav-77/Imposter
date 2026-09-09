# Imposter Game

Foundation repository for a real-life, room-based social deduction game. Players complete physical tasks, submit photo evidence, and use the app for game state, meetings, evidence review, and voting.

The backend gameplay loop and production-readiness baseline are complete. HTTP `/api/v1` and realtime schema v1 are frozen for independent web and Android client implementation.

## Requirements

- Node.js 24
- PostgreSQL 18 (PostgreSQL 16+ is expected to work; CI targets 18)
- npm 11+

## Local setup

1. Copy `.env.example` to `.env` and set a local `DATABASE_URL`. Do not commit it.
2. Optionally start PostgreSQL with `POSTGRES_PASSWORD` set in your shell: `docker compose up -d postgres`.
3. Run `npm ci`.
4. Run `npm run migrate:up`.
5. Provision the initial owner using [the administrator runbook](docs/ADMIN_OPERATIONS.md).
6. Run `npm run dev`.
7. Check `GET http://127.0.0.1:3000/health/live` and `/health/ready`.

The application deliberately fails startup when required configuration is absent. Production API documentation is disabled unless `EXPOSE_API_DOCS=true` is explicitly set.

## Verification

```text
npm run check
npm run test:integration
npm run build
```

`TEST_DATABASE_URL` must point to an isolated disposable database for integration tests.
`migrate:verify` intentionally reverses every current migration and must only target an isolated disposable database, never staging or production.

## Planning documents

- [Master plan](docs/MASTER_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API contract](docs/API_CONTRACT.md)
- [Security design](docs/SECURITY.md)
- [Implementation phases](docs/phases/README.md)
- [Realtime contract](docs/REALTIME_CONTRACT.md)
- [Current handoff context](docs/context/PHASE_07_CONTEXT.md)
- [Production operations](docs/PRODUCTION_OPERATIONS.md)

The original concept is preserved in [imposter-game-agent-prompt.md](imposter-game-agent-prompt.md).

## Current boundary

The launch topology is deliberately one persistent application process behind a TLS/WebSocket proxy, backed by managed PostgreSQL and private S3-compatible storage. Multiple replicas are unsupported until shared realtime coordination is introduced. Provider account setup, public domain approval, privacy/legal approval, and a witnessed restore drill remain launch-owner actions rather than repository code.
