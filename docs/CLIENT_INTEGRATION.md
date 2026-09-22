# Client integration contract v1

The stable client surface is `openapi/openapi.json` plus `contracts/realtime-v1.schema.json`. HTTP business commands are authoritative; realtime messages are authenticated hints or participant-specific snapshots. Clients must never infer hidden roles, winners, task totals, or vote results.

Native clients send `Authorization: Bearer <participant token>`. Same-origin web clients request cookie transport with `X-Session-Transport: cookie`, then rely on the Secure/HttpOnly/SameSite cookie and send an approved `Origin` for mutations. Never place a credential in a URL, query parameter, analytics event, or log.

For retryable mutations, generate one `Idempotency-Key` and reuse that same key and identical body until a definitive response arrives. A changed body requires a new key. On `409` state-version conflict, fetch a fresh snapshot and ask the user to repeat an action when necessary. On `429`, respect `Retry-After`. Retry network/`503` failures with exponential backoff and jitter; do not blindly retry validation or authorization failures.

Connect Socket.IO with WebSocket transport at `/realtime` using `auth.token` on native or the participant cookie on web. Replace local state on `room.snapshot` or `game.snapshot`. If state versions skip, emit `game.resync` or fetch `GET /api/v1/games/current/snapshot`. Stop reconnecting on `session.revoked`.

Treat navigation, a backgrounded tab, and transport loss as a soft disconnect, never as an implicit leave. Keep the participant credential, offer **Resume** when `/api/v1/rooms/current` succeeds, and restore the latest server snapshot. This also restores the terminal result if the game ended while the player was away. Only the explicit leave command removes the participant; active games reject permanent leave so an accidental Back press cannot destroy a seat or leak a replacement identity into the game.

Compatibility policy:

- `/api/v1` and realtime `schemaVersion: 1` are frozen as of backend `1.0.0`.
- New optional response fields and new event types may be added in v1; clients must ignore unknown fields/events.
- Existing meanings, required request fields, enum values used by clients, authentication behavior, or field types are not changed incompatibly in v1.
- Deprecations receive documentation and at least one released-client migration window. A breaking change uses `/api/v2` or realtime schema version 2 with parallel support.
- `npm run contracts:check` prevents generated OpenAPI drift. `npm run contracts:fixtures:check` checks the realtime schema/fixture identity. Integration CI runs a non-React bearer-token client through a complete game.

The sample realtime fixtures are deterministic examples only; IDs and timestamps are not production credentials or state.
