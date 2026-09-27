# Phase 0 — product and contract alignment

## Goal

Remove ambiguity before Android code is created. This phase prevents a polished client from implementing the wrong rules.

## Required inputs

- `openapi/openapi.json`
- `contracts/realtime-v1.schema.json`
- `docs/API_CONTRACT.md`
- `docs/REALTIME_CONTRACT.md`
- `docs/CLIENT_INTEGRATION.md`
- `docs/SECURITY.md`
- `src/shared/avatars.ts` only to understand legacy transport IDs, never as a visual source

## Decisions that must be approved

1. **Player capacity:** documentation and current UI disagree. Establish one minimum and maximum supported by the server and Android.
2. **Emergency meetings:** the guide says unsupported while current contracts/UI expose player-called meetings. Decide the actual rule.
3. **Ejection ballot mutability:** decide whether a ballot may be replaced until lock or is permanently locked on first confirmation.
4. **Replay:** confirm whether replay in the same room is supported and which endpoint/state governs it.
5. **Account scope:** decide whether Android v1 includes Google/account history or guest gameplay only.
6. **Avatar naming:** approve Android's mapping of legacy `avatarId` values to neutral color slots. Decide whether a future API renames the field.
7. **Color count:** approve a distinguishable palette large enough for maximum room capacity, including accessibility review.
8. **Evidence visibility:** confirm exactly when uploader identity, thumbnails, full images, and flag actions are visible.
9. **Notification scope:** approve whether v1 has only in-app alerts or also push notifications.
10. **Supported Android baseline:** approve minimum SDK, target SDK, phone/tablet/foldable policy, locales, and release regions.

## Contract work

- Build an endpoint inventory for every Android command and read.
- Build a DTO field matrix marking public, self-only, role-secret, meeting-secret, and terminal-only data.
- Record required headers: bearer token, idempotency key, expected state version, content type, checksum, and request ID behavior.
- Record all stable error codes and map each to refresh, retry, inline correction, session reset, or terminal messaging.
- Record the exact socket connection, event, heartbeat, resync, presence, and revocation behavior.
- Obtain or add sanitized fixtures for every room/game phase and important failure.
- Confirm development/staging base URLs and TLS requirements without committing secrets.

## Avatar compatibility decision

The approved baseline is:

- same supplied crewmate silhouette for every player;
- unique runtime color per occupied room slot;
- legacy values such as `fox` or `owl` remain internal wire IDs only for API v1;
- Android UI uses neutral color labels and nicknames, not legacy animal names;
- no website avatar image, animation, or name is used as an Android design reference.

If the backend cannot guarantee uniqueness using its available-ID mechanism at the approved capacity, Phase 0 is blocked until the contract is corrected.

## Test strategy produced in this phase

- Contract parsing tests for every fixture.
- Redacted request/response logging tests.
- State-version gap and resync scenarios.
- Idempotent retry scenarios.
- Session revocation and expiration scenarios.
- A full game-script fixture from create/join through terminal result.

## Deliverables

- Approved entries in `../context/decision-log.md` for all ten decisions.
- Updated requirements traceability rows.
- Endpoint/DTO/error inventory, either added to context or linked from it.
- Sanitized fixtures available to Android tests.
- A written statement that Android can proceed without guessing.

## Exit criteria

- No known product text contradicts the approved server behavior.
- Avatar/color identity is contract-compatible and uniquely selectable.
- Every v1 screen maps to an authoritative server state or a purely local entry/settings state.
- Every mutation has documented idempotency, conflict, retry, and user-feedback behavior.
- The product owner approves the scope and supported-device baseline.
