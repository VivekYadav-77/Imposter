# Phase 2 Context — Administrator Authentication and Task Packs

**Status:** Implemented; PostgreSQL integration verification requires an available migrated test database  
**Date:** 2026-09-20

## Authentication and session behavior

- Administrators are provisioned only with `npm run admin:bootstrap`; no registration endpoint exists.
- Bootstrap is serialized with a PostgreSQL transaction advisory lock, so concurrent first-run
  attempts cannot create multiple owners.
- Passwords use Node's scrypt with a per-password 128-bit salt, `N=32768`, `r=8`, `p=1`, and a 64-byte derived key.
- Login errors are generic. The process-local limiter defaults to five failures per normalized email/IP hash in 15 minutes and returns `Retry-After` when blocked.
- Successful login creates a random 256-bit credential. PostgreSQL stores only an HMAC-SHA-256 token hash and optional IP hash.
- Login accepts only the service's configured scrypt cost parameters and fixed salt/hash sizes.
- The `__Host-admin_session` cookie is Secure, HttpOnly, SameSite=Strict, path `/`, and defaults to an eight-hour lifetime.
- Active sessions require an active administrator, a future expiry, and no revocation timestamp. Logout revokes the row and clears the cookie. Expired rows are cleaned on login.
- Cookie-authenticated mutations require an allowed `Origin`. Admin and participant authentication realms remain separate.

## Schema and API state

Migration `000002_admin_task_packs.cjs` creates `admin_users`, `admin_sessions`, `task_packs`, `task_pack_items`, `admin_audit_events`, and `admin_idempotency_records` in the `app` schema, including lifecycle, ordering, uniqueness, and length constraints.

Implemented admin endpoints:

- `POST /api/v1/admin/sessions`
- `DELETE /api/v1/admin/sessions/current`
- `GET|POST /api/v1/admin/task-packs`
- `GET|PATCH /api/v1/admin/task-packs/{packId}`
- `POST /api/v1/admin/task-packs/{packId}/publish`
- `POST /api/v1/admin/task-packs/{packId}/archive`

Published list/detail projections exist separately and expose no slug, status, inactive items, author, or audit fields. Their HTTP endpoints are documented as participant-authenticated and deny access until Phase 3 installs the participant-session authorizer.

## Pack lifecycle and limits

- Draft creation accepts 0–15 ordered items.
- Pack names are 1–80 trimmed characters; descriptions are at most 1,000 characters; task descriptions are 1–280 trimmed characters.
- Complete item replacement occurs in one transaction and regenerates contiguous one-based positions.
- Every mutation increments a positive revision. Stale mutations return `409 PACK_REVISION_CONFLICT`.
- Publication is draft-only and requires 10–15 active tasks. Published packs may be archived. Archived packs cannot be edited or restored in this phase.
- Archival is restricted to published packs; draft packs must be completed and published first.
- Mutation idempotency keys are scoped to the administrator, serialized with a transaction advisory lock, reject mismatched reuse, and retain the original response for 24 hours.
- Expired idempotency records are removed under that lock before a key is reused.

## Auditing and operations

Login success/failure, logout, and pack lifecycle mutations are audited. Events contain structural metadata only and never store credentials, hashes, tokens, or task-edit request bodies. Bootstrap and manual recovery guidance is in `docs/ADMIN_OPERATIONS.md`.

New configuration: `ADMIN_SESSION_TOKEN_PEPPER`, `ADMIN_SESSION_TTL_SECONDS`, `ADMIN_LOGIN_WINDOW_SECONDS`, and `ADMIN_LOGIN_MAX_ATTEMPTS`.

## Phase 3 dependencies

- Implement participant-session persistence and inject a participant authorizer into the published-pack HTTP reads.
- Keep participant tokens/cookies separate from `__Host-admin_session` and never permit participant credentials on admin routes.
- Rooms may select only the published projection and must snapshot pack items at game start in Phase 4.
- Replace or coordinate the process-local login throttle before multi-instance deployment; the initial topology remains one application process.
