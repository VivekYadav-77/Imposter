# Production operations

## Supported launch topology

The supported launch topology is one persistent Node 24 container in one region behind a TLS-terminating reverse proxy, one managed PostgreSQL 16+ database with point-in-time recovery, one private S3-compatible evidence bucket, and a centralized JSON-log/metrics collector. Run exactly one application replica. Realtime fan-out and process-local abuse/login limits are intentionally single-instance; adding replicas requires a shared Socket.IO adapter and coordinated throttling first.

Use separate cloud projects/accounts, databases, buckets, credentials, domains, and monitoring destinations for development, staging, and production. Production credentials must never be copied into CI test jobs or developer `.env` files.

### Proxy requirements

- Redirect HTTP to HTTPS and use TLS 1.2 or newer. Enable HSTS only on the HTTPS production origin (the app also emits it in production).
- Forward WebSocket upgrades for `/realtime`, without buffering, with an idle timeout of at least 75 seconds. The default heartbeat is 25 seconds with a 20-second timeout.
- Preserve the original `Host` and request ID. Do not trust or use client-supplied forwarded addresses for authorization.
- Set `TRUST_PROXY=true` only when the ingress removes any client-supplied `X-Forwarded-For` value and writes the canonical client chain; abuse limiting uses its first address.
- Route `/health/live` to process liveness and `/health/ready` to rollout/readiness checks. Remove a container from service as soon as readiness returns `503` during drain.
- Never expose `/internal/metrics` through the public ingress. If routing it internally, require `Authorization: Bearer $METRICS_BEARER_TOKEN`.
- Limit request bodies to 64 KiB at the proxy for JSON routes. Evidence bytes travel directly to private object storage through short-lived signed capabilities.

Object storage must block all public access and ACL grants, encrypt at rest and in transit, enable provider access/audit logs, and grant the runtime identity only read/write/delete access to the evidence prefix. Configure a provider lifecycle backstop after 48 hours; the application target remains deletion within 24 hours of terminal room state and one hour for orphans.

## Required production configuration

Start from `.env.example`, inject values from the hosting secret manager, and do not bake them into the image. Production startup rejects placeholder peppers, an absent metrics token or version, empty CORS/CSP allowlists, non-HTTPS allowlists, a non-HTTPS custom storage endpoint, or a shared participant/admin pepper.

`SERVICE_VERSION` must be the immutable commit SHA or release identifier. Set `CORS_ALLOWED_ORIGINS` to exact web origins (no wildcard) and `CSP_IMAGE_SOURCES` to exact HTTPS origins that serve signed evidence images. Database TLS certificate verification is enabled with `DATABASE_SSL=true`. Runtime database and object-store identities must be distinct from the migration and backup identities.

Rotate participant or administrator peppers only as a planned global logout: deploy the new secret, revoke/delete the corresponding active session rows, verify login/join behavior, and securely retire the old value. Rotate storage/database credentials using the provider's overlap procedure, verify readiness and an upload/delete canary, then revoke the old identity.

## Release and rollback

The `Release` workflow is manually dispatched with an immutable image tag and is serialized by the `production-release` concurrency group. The protected `production` GitHub environment must require approval and provide `DATABASE_URL`, `DEPLOY_HOOK_URL`, `ROLLBACK_HOOK_URL`, `PUBLIC_BASE_URL`, and a non-empty `BACKUP_RESTORE_TESTED_AT` variable.

The workflow reruns CI, builds and publishes an immutable OCI image, applies forward-only migrations once, asks the platform to deploy that exact image, and polls readiness. A failed readiness check invokes the application rollback hook. Schema rollback is never automatic: migrations must remain backward-compatible with the previously deployed image. Destructive cleanup belongs in a later release after the compatibility window.

Before approval:

1. Confirm managed backup/PITR health and that the last restore drill recorded in `BACKUP_RESTORE_TESTED_AT` is within 90 days.
2. Review migration SQL for locks, table rewrites, destructive operations, and compatibility with both old and new images.
3. Confirm staging passed `npm run check`, integration tests, migration up/down/up rehearsal, container scan, and the client contract smoke test.
4. Confirm on-call ownership and the incident channel.

After rollout, verify readiness, error rate, p95 latency, active connections, overdue deadlines, dead jobs, and evidence deletion lag. Roll back the application image when behavior regresses. Roll forward with a corrective migration when the schema is involved.

## Backups and restore drill

Enable encrypted daily backups and point-in-time recovery with at least seven days of retention in the managed PostgreSQL service. Store backups outside the application account's deletion boundary. The evidence bucket is intentionally ephemeral and is not restored as a durable user archive.

Quarterly and before a first public launch:

1. Restore the latest backup to a new isolated database using the provider's point-in-time restore operation.
2. Connect with a read-only drill credential; record the recovery point, start/end time, backup identity, and operator.
3. Run `npm run migrate:up`, then `npm run ops:status` against the restored database.
4. Check schema migrations, row counts, referential constraints, one active-room snapshot, jobs, and terminal evidence metadata. Do not send notifications or connect the restored database to a public app.
5. Destroy the isolated restore after recording recovery-time and recovery-point results. Never overwrite production during a drill.

The launch owner must set explicit RPO/RTO based on the selected provider and observed drill. Repository code cannot truthfully certify provider backup health.

## Monitoring and alerts

Collect stdout JSON logs and scrape the protected Prometheus endpoint. Logs include service, environment, version, request ID, status, and latency and redact credentials, cookies, tokens, passwords, and signed URLs.

Create these paging alerts after two consecutive evaluation windows unless noted:

| Signal                             |                          Initial threshold | Action                                             |
| ---------------------------------- | -----------------------------------------: | -------------------------------------------------- |
| Readiness                          |                      failing for 2 minutes | Page; check PostgreSQL and rollout                 |
| HTTP 5xx                           | >2% for 5 minutes and at least 20 requests | Page; correlate version/request IDs                |
| Request latency                    |               p95 >1 second for 10 minutes | Investigate pool saturation and slow queries       |
| DB pool waiting                    |                           >0 for 5 minutes | Page before raising pool size; inspect DB capacity |
| Active realtime connections        |               sudden 50% drop in 5 minutes | Check proxy/rollout/network                        |
| Deadline worker failures           |                     any sustained increase | Page; inspect overdue games                        |
| Evidence worker failures/dead jobs |           any dead job or repeated failure | Page; inspect storage and safely retry             |
| Retention lag                      |    any object metadata overdue >30 minutes | Page privacy owner; run deletion verification      |
| Authentication/rate-limit spike    |                        5x 24-hour baseline | Security investigation, usually ticket not page    |

Run `npm run ops:status` from a trusted operations shell for aggregate active-room, overdue-deadline, due/dead-job, and retention-lag counts. It never emits nicknames, tokens, roles, or object keys.

## Incident procedures

1. Declare an incident, record UTC start time/version, and assign incident lead and communications owner.
2. Preserve redacted logs and audit events. Never paste credentials, signed URLs, photos, or raw database exports into chat/tickets.
3. If integrity is uncertain, stop new traffic by failing/removing readiness; do not delete evidence or reverse migrations ad hoc.
4. For PostgreSQL outage, keep the process alive but unready and allow clients to retry with jitter. For storage outage, gameplay without new evidence may continue; do not mark uploads complete.
5. For a stuck deadline/job, inspect `ops:status`, database locks, attempt counts, and last safe error. Restarting is safe because deadlines and jobs are durable. Do not manually edit roles, ballots, winners, or idempotency rows.
6. For credential exposure, revoke at the provider, rotate the affected secret, revoke related sessions if applicable, and review access logs.
7. Confirm recovery through readiness, a fresh authorized snapshot, worker lag, and deletion canary. Record impact, cause, timeline, and follow-up actions.

Administrator recovery remains the out-of-band procedure in `ADMIN_OPERATIONS.md`: verify ownership independently, replace the password hash, revoke every admin session, and audit the action. There is no public reset endpoint.

## Launch checklist

- [ ] Domain/TLS, provider, region, privacy notice, 18+ consent wording, RPO/RTO, and retention decisions approved.
- [ ] One replica enforced; WebSocket proxy and graceful SIGTERM rollout tested.
- [ ] Production configuration validation passes and secret manager access is least privilege.
- [ ] PITR enabled and isolated restore drill witnessed within 90 days.
- [ ] Private bucket policy and lifecycle backstop verified with deletion canary.
- [ ] Dashboards and the alerts above are active and routed to an owner.
- [ ] Staging capacity/restart/outage test results meet the selected launch target.
- [ ] OpenAPI and realtime v1 artifacts pass checks; client smoke test passes.
- [ ] Dependency, secret, container, DTO-leakage, CORS/CSRF/CSP, and proxy reviews are signed off.
