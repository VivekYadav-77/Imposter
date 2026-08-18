# Administrator Operations

Administrator registration is intentionally unavailable over HTTP. Provision the first owner from a trusted terminal after migrations have completed.

## Initial bootstrap

1. Set `DATABASE_URL` to the target database.
2. Set `ADMIN_BOOTSTRAP_PASSWORD` to a unique 12–128 character password. Avoid shell history and shared process environments.
3. Run `npm run admin:bootstrap -- --email owner@example.com`.
4. Remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment immediately.

The command refuses to run when any administrator already exists. It stores a salted scrypt hash and never prints the password or hash. There is no public registration route.

## Recovery and disabling access

Automated password reset is not part of the MVP. Recovery is a deliberate database-administrator procedure: verify the owner out of band, generate a replacement hash using the same password module, update the selected account, and revoke all of its rows in `app.admin_sessions`. Record the operator and reason outside credential-bearing logs.

To disable an administrator, set `app.admin_users.status` to `disabled` and revoke active sessions. Authorship and audit history remain intact.

## Session and login policy

- Sessions default to eight hours and are stored server-side as HMAC hashes.
- The browser cookie is `Secure`, `HttpOnly`, `SameSite=Strict`, scoped to `/`, and has no `Domain` attribute.
- Logout revokes the database session before clearing the cookie.
- Expired sessions are cleaned opportunistically on login; an operations scheduler may also delete rows by `expires_at`.
- Login defaults to five failures per normalized email/IP hash in 15 minutes. `429` responses include `Retry-After`.
- Set `ADMIN_SESSION_TOKEN_PEPPER` to at least 32 random characters and rotate it only with a planned revocation of all admin sessions.

## Task-pack rules

- Drafts contain 0–15 ordered items.
- Names contain 1–80 trimmed characters, descriptions at most 1,000 characters, and item text 1–280 characters.
- Publication requires 10–15 active items.
- Mutations require an `Idempotency-Key` and expected revision where applicable. Idempotent results are retained for 24 hours.
- Archived packs cannot be edited or restored in Phase 2.
- Audit events store action, actor, target, outcome, request ID, and bounded structural metadata—never passwords, session tokens, or task-edit bodies.
