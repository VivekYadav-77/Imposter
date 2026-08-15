# Security Design

**Status:** Proposed security baseline; not implemented.

## 1. Security goals

1. A player cannot impersonate another participant by knowing a room code or nickname.
2. A player cannot learn roles, real/fake task status, or private actions they are not allowed to see.
3. A client cannot perform an action that is invalid for its actor, phase, or game version.
4. Administrators are isolated from temporary player authentication.
5. Uploaded files cannot become public, executable active content or permanent uncontrolled data.
6. Retries, races, reconnects, and process restarts cannot corrupt game state.
7. Logs and errors do not disclose credentials, signed URLs, images, or secret game data.

This is a party game, not a financial system, but role secrecy and photo privacy are core product requirements.

## 2. Trust boundaries and threats

| Boundary                 | Representative threat                  | Control                                                                                       |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Untrusted client to API  | Forged role/action, malformed input    | Authentication, resource authorization, schema validation, phase checks                       |
| Player to player         | Nickname impersonation, role leakage   | Opaque session token, player-specific DTOs, unique normalized nicknames                       |
| Browser to API           | CSRF or token theft                    | SameSite HttpOnly cookie, origin checks, CSP, output encoding                                 |
| Native client to API     | Stolen/replayed token                  | TLS, high-entropy scoped token, protected storage, expiry/revocation                          |
| Client to object storage | Upload overwrite or arbitrary file     | Random key, single-purpose short-lived permission, type/size constraints, confirmation checks |
| Admin interface          | Brute force or privilege escalation    | Separate auth realm, password hashing, rate limit, server-side admin authorization, audit     |
| Concurrent commands      | Double vote/kill or stale phase action | Unique constraints, idempotency, expected state version, transaction and row lock             |
| Logs/monitoring          | Secret or personal-data leakage        | Field allowlist/redaction and restricted access                                               |

## 3. Participant authentication

### Credential

- Generate at least 256 bits of cryptographically secure random data.
- Show/return the raw opaque token only at issuance/rotation.
- Store a keyed hash or strong cryptographic hash, never the raw token.
- Scope to one participant and room.
- Set explicit issue, expiry, last-used, and revoked timestamps.
- Revoke all participant sessions when the room is purged.
- Rotate after suspicious reuse or explicit recovery.

Room codes are locators and may be rate-limited, but are not credentials.

### Transport

- Android and future native clients: Bearer token over TLS, stored using platform-protected storage.
- Same-origin web client: Secure, HttpOnly, SameSite cookie preferred.
- Central authentication middleware normalizes both into the same participant principal.
- Never accept credentials in URL query strings.
- WebSocket authentication occurs during the handshake and is revalidated on reconnect.

Refresh tokens are unnecessary for a short room-scoped session. A valid session can be rotated by a dedicated endpoint. If product retention later outlives a party session, redesign rather than stretching temporary tokens indefinitely.

## 4. Administrator authentication

- Admin registration is disabled.
- Initial admin provisioning happens out of band.
- Passwords use a modern memory-hard password hash with calibrated cost and per-password salt.
- Login uses generic failure messages, progressive rate limiting, and audit events.
- Admin sessions are random, server-side, short-lived, revocable, and delivered in Secure HttpOnly cookies.
- State-changing browser requests require SameSite protection plus Origin/Referer validation; add CSRF tokens if deployment/cross-site behavior requires them.
- Password reset and email verification are intentionally deferred until administrator recovery/email delivery exists. Manual secure reprovisioning is the MVP recovery path.
- Multi-factor authentication is a post-MVP improvement, strongly recommended before multiple administrators or public launch.

## 5. Authorization rules

Every use case checks:

1. Authenticated principal type.
2. Membership in the addressed room/game.
3. Resource ownership where applicable.
4. Host/admin/role capability.
5. Alive/eliminated eligibility.
6. Current phase and deadline.
7. Expected game state version.

Never authorize from client-supplied `role`, `isHost`, `alive`, participant ID, room ID, or task ownership without resolving it from the authenticated session and database.

Host is a room capability, not a superuser role. It must not bypass game rules or reveal secret data.

## 6. Secret-data projection

- Define public, self, host, and admin DTOs explicitly.
- Role is returned only in the authenticated participant's self projection after game start.
- Imposter teammate identities are returned only if the approved rules allow them.
- Killer identity is never included in public meeting events.
- `counts_toward_progress`, token hashes, admin password hashes, internal object keys, idempotency records, and raw audit payloads are never returned to players.
- Automated contract tests inspect serialized JSON for forbidden fields.
- Server-rendered HTML and hydration payloads follow the same secrecy rules as API JSON.

## 7. Input and API security

- Use allowlist schema validation for body, path, query, and realtime payloads.
- Normalize nicknames and enforce code-point and byte limits.
- Render player-supplied text as text, never HTML.
- Parameterize every database query.
- Return a stable safe error code; log internal detail only on the server.
- Apply body-size limits before JSON parsing.
- Configure CORS to known origins; do not combine wildcard origins with credentials.
- Apply secure headers including a restrictive Content Security Policy on the web client.
- Rate-limit by a combination of IP, room code, participant session, admin identity, and endpoint class.
- Keep dependency and container scanning in CI; patch supported versions deliberately.

Suggested endpoint classes:

| Class                        | Examples                | Initial policy direction                  |
| ---------------------------- | ----------------------- | ----------------------------------------- |
| Public enumeration-sensitive | Join room, admin login  | Strict burst and sustained limits         |
| Authenticated commands       | Kill, vote, flag, start | Per-session limit plus idempotency        |
| Read/snapshot                | Room/game snapshot      | Moderate per-session limit                |
| Upload intent                | Evidence upload         | Low concurrency and daily/room byte quota |
| Realtime connect             | Socket handshake        | Per-IP and per-session connection cap     |

Exact numbers must be load-tested rather than guessed into the contract.

## 8. File upload security

- Store objects in a private bucket with public access blocked.
- Generate server-owned random object keys under a game/participant namespace.
- Accept only JPEG, PNG, and WebP. Reject SVG and other active/document formats.
- Enforce a small maximum object size, initially proposed as 5 MiB.
- Upload permissions are short-lived, single-object, and method constrained.
- Do not trust filename extension or client `Content-Type`.
- On confirmation, verify existence, expected key, size, checksum when available, and detected image type.
- Decode/re-encode images with pixel and memory limits to remove metadata and malformed payloads; quarantine until processing succeeds where practical.
- Serve with a safe fixed image content type, `nosniff`, and short-lived read authorization.
- Delete rejected/orphaned uploads and lifecycle-expired evidence.
- Never log signed URLs or object contents.

The task may become provisionally complete immediately after confirmation. A processing failure reopens it and emits a safe player notification.

## 9. Database and infrastructure security

- Separate migration and runtime database privileges where hosting permits.
- Runtime role receives only required schema privileges.
- Require encrypted network connections to managed PostgreSQL and object storage.
- Store secrets in hosting secret management/environment injection, never source control.
- Rotate database, storage, admin-bootstrap, and token-hash secrets.
- Automated backups must be encrypted; restore procedures must be tested.
- Reverse proxy applies TLS, request/header limits, timeouts, and WebSocket upgrade rules.
- Production debug endpoints and stack traces are disabled.

## 10. Privacy and retention

Photos may contain faces, rooms, documents, or other personal information even though the app has no accounts.

- Explain photo purpose and retention before camera/gallery access.
- Avoid collecting GPS/EXIF; normalization should remove metadata.
- Do not use photos for analytics or model training.
- Provide an in-game path for the host to end a game and schedule deletion.
- Delete objects automatically after the approved retention period.
- Keep only minimal non-image audit metadata needed for operational diagnosis.
- Define an abuse/reporting contact before public launch.
- Review age/consent requirements for the intended audience and launch regions before production release.

## 11. Logging rules

Allowed examples:

- Request ID, route template, status, duration.
- Internal UUIDs for room/game/participant.
- Game phase/version and safe error code.
- Storage operation type and redacted object identifier.

Forbidden examples:

- Raw participant/admin tokens or cookie values.
- Passwords or password hashes.
- Signed upload/download URLs.
- Photo bytes, EXIF, user-agent fingerprint collections.
- Full nickname unless required for a narrowly scoped audit.
- Secret role assignments or killer identity in general request logs.

## 12. Security verification before launch

- Authentication and authorization tests for every protected endpoint.
- Cross-player and cross-room access tests.
- DTO leakage tests for every game phase and role.
- Brute-force/rate-limit tests for room join and admin login.
- Upload tests using spoofed extensions, MIME values, oversized files, decompression bombs, and SVG.
- CSRF/CORS/CSP validation for the deployed web origin.
- Dependency and secret scanning.
- Database least-privilege review.
- Backup restore and media deletion verification.
- Manual threat-model review after rules and deployment provider are final.

## 13. References

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [AWS presigned URL guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
