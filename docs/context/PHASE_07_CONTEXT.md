# Phase 7 context — Production readiness and contract freeze

## Delivered backend baseline

The backend is ready for independent web and Android client implementation against `/api/v1` and realtime schema v1. OpenAPI reports version `1.0.0`; the realtime JSON Schema and deterministic fixtures live under `contracts/`. CI rejects generated OpenAPI drift and fixture/schema identity drift. A database-backed integration test drives four bearer-token clients over HTTP through room creation, joining, setup, game start, an anonymous kill, voting, and a terminal crew win without React or internal domain calls for client actions.

## Runtime and deployment

The supported initial topology remains exactly one persistent Node 24 container behind a TLS/WebSocket-capable ingress, managed PostgreSQL, private S3-compatible storage, centralized JSON logs, and Prometheus scraping. Multi-replica deployment remains unsupported because realtime delivery and abuse/login limiting are process-local. The OCI image has a liveness health check, runs as the unprivileged `node` user, handles SIGTERM, stops readiness while draining, closes workers/sockets/HTTP/database within the configured bound, and publishes immutable service-version metadata in logs.

Production startup validates distinct non-placeholder session peppers, exact HTTPS CORS and image CSP origins, a protected metrics token, HTTPS custom storage endpoints, and an immutable service version. PostgreSQL connection/idle/statement timeouts, HTTP request/header/keepalive timeouts, bounded S3 attempts, realtime heartbeat timing, request body limits, and a general per-process API abuse limit are configurable and bounded.

The protected `/internal/metrics` endpoint exports request counts/latency samples, rate limiting, realtime connections/auth failures/disconnects, database pool state, process uptime, and worker successes/failures. Labels use normalized resource paths, never room/game IDs. `npm run ops:status` emits only aggregate operational counts.

The manual `Release` workflow is serialized, reruns CI, publishes an immutable GHCR image, runs forward-only migrations once from the protected environment, calls the deployment hook, checks readiness, and invokes an application rollback hook on failure. Schema reversal is intentionally never automatic.

## Stable credentials and contracts

Participant credentials remain opaque room-scoped sessions: bearer tokens for native clients and Secure/HttpOnly/SameSite cookies for the web adapter. Admin credentials are a separate server-side session realm. No secrets are stored in this context or any fixture. Client retry, resync, compatibility, and credential rules are in `CLIENT_INTEGRATION.md`; exact routes and DTOs are in `openapi/openapi.json`; realtime messages are in `contracts/realtime-v1.schema.json` and `REALTIME_CONTRACT.md`.

## Operations and recovery

`PRODUCTION_OPERATIONS.md` is the source for proxy/TLS settings, environment separation, secret injection and rotation, release/rollback, backup restore drills, monitoring thresholds, incident response, admin recovery links, storage deletion verification, and the launch checklist. Restart safety continues to rely on PostgreSQL deadlines, game-row locks, idempotency rows, and durable evidence jobs. Readiness fails safely on PostgreSQL outage; storage failures cannot confirm evidence; a restarted worker catches overdue deadlines/jobs.

## Security posture

CORS uses exact origins and now permits the documented Authorization and session-transport headers. Cookie mutations require an approved Origin. CSP denies objects/framing, limits forms and connections, and permits evidence images only from configured origins; production emits HSTS and restrictive referrer, opener, frame, content-type, and permissions policies. Logs redact authorization/cookies/tokens/passwords/signed URLs. The DTO and meeting tests assert that role internals, killer identity, vote rows, object keys, and progress flags are not serialized to unauthorized players.

## External launch gates and limitations

Repository work cannot activate a cloud provider, domain, TLS certificate, paid monitoring account, alert destination, legal/privacy approval, or managed backup policy. Those remain explicit unchecked launch-owner items in the operations checklist. The prerequisite hosting/privacy decisions were not present in the repository, so no provider was invented and no claim is made that alerts or backups are currently active. Capacity thresholds must be selected from the actual provider budget and verified in staging; changing the replica count is not an acceptable shortcut.

No Redis, broker, Kubernetes, microservices, public evidence URLs, moderator tooling, emergency meeting, persistent player account, or cross-region topology was added. These are outside the MVP and are not needed for client implementation.

## Exact client-team starting point

1. Generate HTTP client types from `openapi/openapi.json` and consume realtime v1 with unknown-field/event tolerance.
2. Implement the credential, idempotency, retry, `Retry-After`, snapshot, and version-gap rules in `CLIENT_INTEGRATION.md`.
3. Build the web client as presentation over the public contract; do not import backend services or database types.
4. Run `npm run check`, `npm run test:integration`, and `npm run build` before any contract change. Treat incompatible v1 changes as blocked unless a versioned migration plan is approved.
