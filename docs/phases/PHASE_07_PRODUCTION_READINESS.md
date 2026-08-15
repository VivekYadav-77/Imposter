# Phase 7 — Production Readiness and Contract Freeze

## Required reading and source of truth

1. [Project entry point](../../README.md)
2. [Master architecture plan](../MASTER_PLAN.md)
3. [System architecture](../ARCHITECTURE.md)
4. [Database design](../DATABASE_DESIGN.md)
5. [API and realtime contract](../API_CONTRACT.md)
6. [Security design](../SECURITY.md)
7. Previous handoff: `../context/PHASE_06_CONTEXT.md`.

## Objective

Prove the completed backend can be operated safely and consumed independently by web and Android clients without architectural changes.

## Prerequisites

- Phase 6 complete with end-to-end game tests.
- Hosting, domain/TLS, backup, retention, monitoring, and launch privacy decisions approved.

## Features

- Production deployment pipeline, migration release step, monitoring/alerts, backups, restore/incident runbooks.
- Contract publication and client integration sandbox/fixtures.
- Abuse limits, cleanup dashboards, admin operational tools strictly required for launch.

## Database changes

- Only measured index/retention/operational adjustments; no unplanned domain redesign.

## Backend changes

- Load/recovery tuning, graceful deploys, dependency timeouts, safe retry policies, final configuration validation.

## Implementation work packages

1. Select and document the hosting topology, TLS/proxy WebSocket settings, database plan, object lifecycle, secret injection, and environment separation.
2. Build a release pipeline that validates, backs up as required, applies migrations once, deploys, checks readiness, and supports rollback without destructive schema reversal.
3. Configure structured-log collection, error tracking, metrics, dashboards, and actionable alerts for the signals in the master plan.
4. Run capacity tests for agreed simultaneous rooms/connections/uploads and tune pools, proxy timeouts, heartbeat intervals, and limits from measurements.
5. Test process restart during every phase, database/storage outages, expired deadlines, stuck jobs, graceful deployment, and idempotent client retries.
6. Verify backup restore, object deletion, credential rotation, admin recovery, and incident/runbook procedures.
7. Complete the security matrix, CORS/CSRF/CSP/proxy checks, secret/dependency scans, DTO leakage audit, and privacy notice/retention verification.
8. Freeze OpenAPI and realtime schema v1, generate client-facing examples/fixtures, and prove a non-React client can play a full game.
9. Reconcile every planning document with deployed behavior and produce the final backend handoff context.

## API changes

- Freeze `/api/v1` and realtime schema v1; only fixes required by contract/security testing.

## Security considerations

- Full authorization matrix, secret scan, dependency/container review, proxy/CSP/CORS/CSRF validation, storage policy review, least privilege and threat-model update.

## Tests

- Load tests at agreed target; rolling/restart tests; dependency outage tests; backup restore; retention deletion; end-to-end web-like and Android-like clients; migration rehearsal.

## Completion criteria

- Operational checklist and alerts are active.
- Restore and restart behavior are demonstrated.
- OpenAPI/realtime schemas match production and compatibility policy is documented.
- A non-React test client can play a complete game using public contracts only.
- Backend is declared ready for web-client implementation.

## Context summary

Create `PHASE_07_CONTEXT.md` as the backend handoff: deployment/runtime, stable contracts, credentials, operations, limitations, and exact starting point for client teams. Do not include secrets.
