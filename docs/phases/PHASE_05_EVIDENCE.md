# Phase 5 — Photo Evidence and Flags

## Required reading and source of truth

1. [Master architecture plan](../MASTER_PLAN.md) — evidence rules, 18+ scope, privacy notice, and 24-hour retention.
2. [Database design](../DATABASE_DESIGN.md) — submissions, flags, jobs, and lifecycle columns.
3. [API contract](../API_CONTRACT.md) — upload intent, confirmation, viewing, and flagging.
4. [Security design](../SECURITY.md) — file-validation and privacy threat controls.
5. [System architecture](../ARCHITECTURE.md) — object storage and worker failure behavior.
6. Previous handoff: `../context/PHASE_04_CONTEXT.md`.

## Objective

Replace temporary task completion with secure direct photo evidence, verification/normalization, flagging, and lifecycle deletion.

## Prerequisites

- Phase 4 complete.
- Storage provider and image-processing library selected. Formats are JPEG/PNG/WebP, proposed limit is 5 MiB, retention is fixed at 24 hours after terminal state, and the master-plan notice is approved as the baseline.

## Features

- Upload intent, direct private upload, confirmation, provisional completion.
- Image detection/normalization/quarantine and failure reopening.
- Authorized short-lived viewing.
- One-per-player evidence flags and orphan/retention cleanup.

## Database changes

- `task_submissions`, `submission_flags`, media jobs, idempotency and deletion indexes.

## Backend changes

- Object-storage adapter, media worker, quota checks, assignment/submission state coordination, safe download authorization.

## Implementation work packages

1. Provision/configure a private development bucket and least-privilege runtime credentials; document production policy without committing secrets.
2. Add submission, flag, upload-intent/job metadata, cleanup, and partial-current-submission migrations.
3. Implement upload-intent authorization with random keys, short expiry, exact method/headers, byte quotas, and single-assignment scope.
4. Implement confirmation with object ownership, size, checksum where supported, and detected-type verification.
5. Implement bounded decode/re-encode, metadata removal, accepted/rejected transitions, and assignment reopening after processing failure.
6. Implement authorized short-lived viewing and room/phase visibility projection.
7. Implement one flag per eligible participant, no self-flagging, and unresolved-flag selection for the next meeting.
8. Implement orphan, rejected, and terminal-game deletion jobs with retry/dead-letter visibility.
9. Surface the approved 18+/consent/retention notice before upload and contract-test that clients receive the policy version if needed.
10. Remove the Phase 4 temporary completion adapter and run security fixture tests.

## API changes

- Upload intent/confirmation, submission list/view authorization, flag endpoint; remove temporary task-completion endpoint.

## Security considerations

- Private bucket, random keys, restricted signatures, content sniffing, decompression limits, metadata stripping, no SVG, signed-URL redaction, deletion verification.

## Tests

- Valid images; spoofed extension/MIME; oversized/corrupt/decompression-bomb fixtures; cross-player access; duplicate confirm/flag; processor failure; orphan and retention jobs.

## Completion criteria

- A task completes only through an accepted evidence flow.
- Invalid processing safely reopens the assignment.
- Unauthorized users cannot upload to, view, overwrite, or retain another game's objects.
- Deletion is observable and retryable.

## Context summary

Create `PHASE_05_CONTEXT.md` with storage configuration names, upload protocol, processing state machine, jobs, privacy limits, and Phase 6 dependencies.
