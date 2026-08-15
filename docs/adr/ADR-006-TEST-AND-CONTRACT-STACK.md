# ADR-006: Test and contract stack

**Status:** Accepted  
**Date:** 2026-09-20

## Decision

Use Vitest 5 for unit and PostgreSQL integration tests, Supertest for HTTP behavior, and a code-owned OpenAPI 3.1 document validated by Swagger Parser. CI compares the generated checked-in contract byte-for-byte to detect drift.

## Consequences

- Database integration tests use an isolated CI database and create only test-owned probe tables.
- Liveness, readiness, envelopes, configuration failure, body limits, and shutdown are covered in Phase 1.
- Contract generation and validation are mandatory build checks.
