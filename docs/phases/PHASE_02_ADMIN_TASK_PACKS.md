# Phase 2 — Administrator Authentication and Task Packs

## Required reading and source of truth

1. [Master architecture plan](../MASTER_PLAN.md) — actors, pack lifecycle, and backend ownership.
2. [Database design](../DATABASE_DESIGN.md) — administrator and task-catalog tables.
3. [API contract](../API_CONTRACT.md) — admin sessions and pack endpoints.
4. [Security design](../SECURITY.md) — password, cookie, CSRF, throttling, and audit controls.
5. [System architecture](../ARCHITECTURE.md) — module and transaction boundaries.
6. Previous handoff: `../context/PHASE_01_CONTEXT.md`, created only after Phase 1 completes.

## Objective

Provide a secured owner workflow for creating, editing, publishing, listing, and archiving reusable task packs.

## Prerequisites

- Phase 1 complete and `PHASE_01_CONTEXT.md` available.
- Admin bootstrap and password recovery policy approved.
- Pack validation limits approved.

## Features

- Out-of-band admin provisioning, login, logout, session revocation.
- Draft/published/archived pack lifecycle.
- Ordered task item editing with optimistic revisions.
- Published pack discovery API for future clients.

## Database changes

- `admin_users`, `admin_sessions`, `task_packs`, `task_pack_items` and indexes/constraints.

## Backend changes

- Admin authentication/authorization middleware.
- Pack service, repository, DTOs, audit logs, and normalization.

## Implementation work packages

1. Add migrations and database constraints for administrators, sessions, packs, and ordered items.
2. Add a safe one-time/out-of-band administrator bootstrap procedure; never expose public registration.
3. Implement password verification, login throttling, server-side session creation, revocation, and expiry cleanup.
4. Implement admin principal middleware and deny-by-default route guards.
5. Implement pack draft creation, metadata editing, complete ordered-item replacement, optimistic revision checks, publication validation, and archival.
6. Implement published-pack list/detail projections separately from admin DTOs.
7. Add admin security audit events without recording credentials or task-edit request bodies unnecessarily.
8. Publish OpenAPI changes and update operational/bootstrap documentation.

Do not implement player rooms or reuse admin sessions for players.

## API changes

- Admin session endpoints.
- Admin task-pack CRUD/publish/archive endpoints.
- Participant-facing published pack list/detail endpoints.

## Security considerations

- Memory-hard password hashing, generic login errors, strict login limits, Secure HttpOnly cookie, Origin/CSRF posture, no password/token logs.

## Tests

- Login/revocation/rate-limit tests; non-admin denial; lifecycle transitions; revision conflicts; item count/order/length constraints; draft isolation.

## Completion criteria

- Administrator can safely manage a valid published pack through API only.
- Unauthenticated/participant callers cannot access admin data.
- Published and draft projections are contract-tested.
- Audit and documentation match behavior.

## Context summary

Create `PHASE_02_CONTEXT.md` with auth/session behavior, schema/API state, bootstrap procedure, security limits, and Phase 3 dependencies.
