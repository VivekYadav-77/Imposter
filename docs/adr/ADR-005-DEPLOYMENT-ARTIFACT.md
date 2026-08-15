# ADR-005: Deployment artifact

**Status:** Accepted  
**Date:** 2026-09-20

## Decision

Produce a provider-neutral OCI container containing the compiled custom server, Next build output, and production dependencies. Target one Node 24 process behind a TLS/WebSocket-capable ingress. Choose a hosting provider only when deployment constraints and budget are known.

## Consequences

- The custom server and normal Next production output are compiled and copied explicitly; standalone output is not used because the application owns its server.
- Migrations run separately before the new application becomes ready.
- The container runs as a non-root user.
- Scale remains one instance until shared realtime coordination and distributed job ownership exist.
