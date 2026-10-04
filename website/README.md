# Imposter Game

Foundation repository for a real-life, room-based social deduction game. Players complete physical tasks, submit photo evidence, and use the app for game state, meetings, evidence review, and voting.

Run all commands in this document from the `website/` directory.

The backend gameplay loop and production-readiness baseline are complete. HTTP `/api/v1` and realtime schema v1 are frozen for independent web and Android client implementation.

## Requirements

- Node.js 24
- PostgreSQL 18 (PostgreSQL 16+ is expected to work; CI targets 18)
- npm 11+

## Local setup

1. Copy `.env.example` to `.env`, set a local `DATABASE_URL`, and add a Google OAuth Web client ID, client secret, and the exact local callback URI. Do not commit it.
2. Install PostgreSQL 16 or newer locally, start it, and create the database named in `DATABASE_URL`.
3. Run `npm ci`.
4. Run `npm run migrate:up`.
5. Run `npm run admin:bootstrap -- --email owner@example.com` to provision the initial owner.
6. Run `npm run dev`.
7. Check `GET http://127.0.0.1:3000/health/live` and `/health/ready`.

Uploaded evidence is stored under `EVIDENCE_LOCAL_DIRECTORY` (default: `.data/evidence`). Keep that directory writable by the application and include it in your server backup policy if the files must survive a server loss.

For local Google sign-in, register `http://localhost:3000/api/v1/auth/google/callback` (or the exact host and port you use) as an authorized redirect URI. Production must use the HTTPS callback configured by `GOOGLE_OAUTH_REDIRECT_URI`.

The application deliberately fails startup when required configuration is absent. Production API documentation is disabled unless `EXPOSE_API_DOCS=true` is explicitly set.

## Verification

```text
npm run check
npm run test:integration
npm run build
```

`TEST_DATABASE_URL` must point to an isolated disposable database for integration tests.
`migrate:verify` intentionally reverses every current migration and must only target an isolated disposable database, never staging or production.

## Current boundary

The launch topology is deliberately simple: one persistent Node.js application process, one PostgreSQL database, and one private local evidence directory on the same server. A TLS/WebSocket reverse proxy is recommended for internet-facing use. Multiple application replicas are unsupported because realtime coordination and local evidence files are single-server resources.
