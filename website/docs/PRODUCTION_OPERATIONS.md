# Production operations

## Supported single-server topology

Run one Node.js 24 application process, one PostgreSQL 16+ database, and one private evidence directory on the same server. Put a TLS-terminating reverse proxy in front of the application when it is reachable from the internet. Run exactly one application instance: realtime fan-out, rate limits, job ownership, and evidence files are intentionally local to that instance.

Use a dedicated non-administrator operating-system account for the app. That account needs read access to the release directory and read/write access only to `EVIDENCE_LOCAL_DIRECTORY`. Do not expose the evidence directory through the reverse proxy or any static-file server.

### Reverse-proxy requirements

- Redirect HTTP to HTTPS and use TLS 1.2 or newer.
- Forward WebSocket upgrades for `/realtime`, without buffering, with an idle timeout of at least 75 seconds.
- Preserve the original `Host` and request ID.
- Set `TRUST_PROXY=true` only when the proxy replaces client-supplied forwarding headers with its canonical client address chain.
- Route `/health/live` to process liveness and `/health/ready` to readiness checks.
- Never expose `/internal/metrics` publicly. If it is routed internally, require `Authorization: Bearer $METRICS_BEARER_TOKEN`.
- Limit JSON request bodies to 64 KiB. Evidence uploads pass through the application and remain subject to the configured evidence limits.

### Evidence capacity controls

Evidence request bodies are streamed to private temporary files rather than buffered in the Node.js heap. Keep `EVIDENCE_UPLOAD_MAX_CONCURRENT` aligned with the sustained write capacity of the evidence disk; `8` is the default. Up to `EVIDENCE_UPLOAD_MAX_QUEUED` requests wait with socket backpressure for at most `EVIDENCE_UPLOAD_QUEUE_TIMEOUT_MS`. Excess traffic receives a retryable `503` and `Retry-After`, and the browser retries with bounded exponential backoff.

`EVIDENCE_PROCESSING_CONCURRENCY` controls CPU- and memory-intensive Sharp normalization independently of upload concurrency. The default of `2` bounds worst-case decoded-image memory while draining the durable job queue without the former per-image polling delay. Reduce it to `1` on small instances. Increase it only after observing process RSS, CPU saturation, job age, and disk latency under representative load.

## Server preparation

1. Install Node.js 24, npm 11+, and PostgreSQL 16 or newer.
2. Create a PostgreSQL database and a restricted runtime user.
3. Create the application directory and a private writable evidence directory.
4. Copy `.env.example` to a server-only environment file and fill in production values.
5. Set `EVIDENCE_LOCAL_DIRECTORY` to an absolute path owned by the application account.
6. Install dependencies with `npm ci`, run `npm run migrate:up`, and build with `npm run build`.
7. Start `npm start` under the operating system service manager and configure automatic restart.
8. Verify `/health/live`, `/health/ready`, login, room creation, one image upload, image viewing, and deletion.

Production startup rejects placeholder session peppers, an absent metrics token or version, empty CORS/CSP allowlists, non-HTTPS allowlists, or a shared participant/admin pepper. Set `SERVICE_VERSION` to the commit SHA or release identifier. Set `CORS_ALLOWED_ORIGINS` to the exact HTTPS site origin. If images are only served by this application, `CSP_IMAGE_SOURCES` can contain the application's own HTTPS origin.

## Release and rollback

Before each release:

1. Back up PostgreSQL and, when current evidence must be recoverable, `EVIDENCE_LOCAL_DIRECTORY`.
2. Run `npm run check`, `npm run test:integration`, and `npm run build`.
3. Review migration SQL for locks, table rewrites, and destructive changes.
4. Record the current release path or commit so the application files can be restored.

For deployment, stop new traffic or briefly stop the service, install the new release, run forward migrations once, build, start the service, and verify readiness. Keep migrations backward-compatible with the previous application release. If application behavior regresses, restore the previous application files and restart. Do not automatically reverse a schema migration against live data; roll forward with a corrective migration when the schema changed.

## Backups

PostgreSQL contains durable game and account state. Use encrypted daily backups and test a restore at least quarterly.

Evidence files are temporary by design and are deleted according to the configured retention policy. If losing in-retention evidence during a disk or server failure is unacceptable, back up the evidence directory together with PostgreSQL. A consistent restore must preserve both database metadata and its corresponding evidence files.

Monitor disk capacity for the PostgreSQL data directory, application logs, releases, and `EVIDENCE_LOCAL_DIRECTORY`. Keep backups outside the server's failure boundary.

## Monitoring

Collect structured stdout logs and protect the Prometheus metrics endpoint. Alert on:

- readiness failures;
- HTTP 5xx rate and latency;
- PostgreSQL connection-pool waiting;
- sudden realtime connection drops;
- deadline or background-job failures;
- evidence processing failures and retention lag;
- low disk space;
- authentication or rate-limit spikes.

Run `npm run ops:status` from a trusted operations shell to inspect active rooms, overdue deadlines, due or failed jobs, and retention lag. It does not emit nicknames, tokens, roles, or evidence keys.

## Incident procedures

1. Record the start time and deployed version, then preserve redacted logs.
2. Never paste credentials, capability URLs, photos, or raw database exports into chat or tickets.
3. If data integrity is uncertain, stop new traffic; do not delete evidence or reverse migrations ad hoc.
4. For a PostgreSQL outage, keep the app unready until the database recovers.
5. For evidence-directory errors, check ownership, permissions, free disk space, and filesystem health.
6. For credential exposure, rotate the affected secret and revoke related sessions when applicable.
7. Confirm recovery through readiness, a fresh authorized snapshot, worker status, and an upload/view/delete canary.

Administrator recovery remains the out-of-band procedure in `ADMIN_OPERATIONS.md`.

## Launch checklist

- [ ] Node.js, PostgreSQL, the service manager, TLS, and WebSocket proxying are configured.
- [ ] The application runs as a dedicated non-administrator user.
- [ ] The evidence directory is private, writable by the app, and not publicly served.
- [ ] One application instance is enforced.
- [ ] Production configuration validation passes.
- [ ] PostgreSQL backup and restore have been tested.
- [ ] Evidence backup requirements and disk-capacity alerts are defined.
- [ ] Health checks, logs, metrics, and alerts are active.
- [ ] Upload normalization, retention deletion, restart recovery, and rollback have been tested.
