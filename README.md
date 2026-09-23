# Imposter Game

Foundation repository for a real-life, room-based social deduction game. Players complete physical tasks, submit photo evidence, and use the app for game state, meetings, evidence review, and voting.

The backend gameplay loop and production-readiness baseline are complete. HTTP `/api/v1` and realtime schema v1 are frozen for independent web and Android client implementation.

## Requirements

- Node.js 24
- PostgreSQL 18 (PostgreSQL 16+ is expected to work; CI targets 18)
- npm 11+

## Local setup

1. Copy `.env.example` to `.env` and set a local `DATABASE_URL`. Do not commit it.
2. Install PostgreSQL 16 or newer locally, start it, and create the database named in `DATABASE_URL`.
3. Run `npm ci`.
4. Run `npm run migrate:up`.
5. Provision the initial owner using [the administrator runbook](docs/ADMIN_OPERATIONS.md).
6. Run `npm run dev`.
7. Check `GET http://127.0.0.1:3000/health/live` and `/health/ready`.

Uploaded evidence is stored under `EVIDENCE_LOCAL_DIRECTORY` (default: `.data/evidence`). Keep that directory writable by the application and include it in your server backup policy if the files must survive a server loss.

The application deliberately fails startup when required configuration is absent. Production API documentation is disabled unless `EXPOSE_API_DOCS=true` is explicitly set.

## Verification

```text
npm run check
npm run test:integration
npm run build
```

`TEST_DATABASE_URL` must point to an isolated disposable database for integration tests.
`migrate:verify` intentionally reverses every current migration and must only target an isolated disposable database, never staging or production.

## Technical documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API contract](docs/API_CONTRACT.md)
- [Realtime contract](docs/REALTIME_CONTRACT.md)
- [Client integration](docs/CLIENT_INTEGRATION.md)
- [Security design](docs/SECURITY.md)
- [Administrator operations](docs/ADMIN_OPERATIONS.md)
- [Production operations](docs/PRODUCTION_OPERATIONS.md)
- [AWS EC2 deployment](docs/AWS_EC2_DEPLOYMENT.md)

## Current boundary

The launch topology is deliberately simple: one persistent Node.js application process, one PostgreSQL database, and one private local evidence directory on the same server. A TLS/WebSocket reverse proxy is recommended for internet-facing use. Multiple application replicas are unsupported because realtime coordination and local evidence files are single-server resources.
