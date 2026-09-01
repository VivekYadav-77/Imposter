# Phase 5 context — Photo evidence and flags

## Delivered scope

Phase 5 replaces the HTTP development-completion route with private evidence upload intents, confirmation, asynchronous validation/normalization, authorized short-lived viewing, participant flags, and persisted deletion work. `src/modules/evidence` owns evidence authorization and lifecycle rules; `src/infrastructure/object-storage` is the S3-compatible adapter.

## Storage configuration

The private bucket is configured with `EVIDENCE_BUCKET`, `EVIDENCE_S3_REGION`, optional `EVIDENCE_S3_ENDPOINT`, and `EVIDENCE_S3_FORCE_PATH_STYLE`. The AWS SDK credential chain supplies credentials; no credential is stored in source or PostgreSQL. Development MinIO is provisioned by Docker Compose with anonymous access explicitly disabled. Uploads are limited by `EVIDENCE_MAX_BYTES` (5 MiB), `EVIDENCE_GAME_MAX_BYTES`, and `EVIDENCE_MAX_PIXELS` (20 MP).

## Upload protocol and privacy

`POST /api/v1/task-assignments/{assignmentId}/upload-intents` returns an opaque upload ID, exact `PUT` headers, a five-minute signed capability, and evidence policy version `2026-09-20`. The policy contains the approved 18+, consent, room visibility, and 24-hour retention notice. Confirmation verifies key ownership, expiry, exact size/type, and SHA-256 when supplied before provisionally completing the assignment and incrementing game state.

Object keys use random UUIDs under game/participant namespaces and are never exposed in application DTOs. Accepted submissions are listed only to authenticated participants in the same game, with one-minute private read capabilities. Signed URLs must not be logged.

## Processing and jobs

Submission processing is `pending -> accepted` or `pending -> rejected`. Sharp verifies detected JPEG/PNG/WebP type, applies bounded single-frame decoding, orientation, and WebP re-encoding without source metadata. Rejection deletes the object, marks the evidence invalid, reopens the assignment, increments state, and reverses a provisional crew task win when necessary.

The `jobs` table supports `process_evidence`, `delete_orphan`, and `delete_evidence`, with transactional claiming, exponential retry, bounded attempts, sanitized failure codes, and a `dead` state. Orphans are removed after intent expiry plus one hour. Terminal-game objects receive a deletion deadline 24 hours after termination; deletion is verified before `deleted_at` is recorded.

## Flags and Phase 6 dependencies

Only living participants in the current game may flag accepted unresolved evidence. Self-flags are forbidden and `(submission_id, flagger_participant_id)` is unique. Flagging increments game state but does not reopen the assignment. `EvidenceService.unresolvedFlagged(gameId)` provides the deterministic submission IDs that Phase 6 must snapshot into meeting review items. Phase 6 owns review voting, permanent resolution, setting `submission_flags.resolved_at`, and invalid-review task reopening.
