# ADR-005: Deployment artifact

**Status:** Accepted  
**Date:** 2026-09-20

## Decision

Deploy the compiled application directly as one Node 24 process on a server. Install production dependencies with npm, run migrations before starting the new version, and supervise the process with the operating system service manager. Put a TLS/WebSocket-capable reverse proxy in front of the process for internet-facing environments.

## Consequences

- The custom server and normal Next production output are compiled with `npm run build`; standalone output is not used because the application owns its server.
- Migrations run separately before the new application becomes ready.
- The Node process runs as a dedicated non-administrator operating-system user.
- PostgreSQL and `EVIDENCE_LOCAL_DIRECTORY` are provisioned directly on the server.
- Scale remains one instance until shared realtime coordination and distributed job ownership exist.
