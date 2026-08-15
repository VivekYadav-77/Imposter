# ADR-002: Realtime transport

**Status:** Accepted  
**Date:** 2026-09-20

## Decision

Use Socket.IO 4 on the persistent HTTP server at `/realtime`, restricted initially to WebSocket transport. Business commands remain HTTP-only.

## Rationale

Socket.IO supplies a mature Android-compatible client protocol, bounded reconnection and heartbeat behavior, middleware authentication, acknowledgements, and room primitives. These reduce custom protocol work without moving durable state into the realtime layer.

## Consequences

- The handshake accepts credentials only through handshake auth or an authorization header, never a URL query.
- Every connection is authenticated before joining one room-scoped channel.
- Phase 1 rejects all sessions because participant-session persistence begins in Phase 3.
- Multiple application replicas require a shared adapter and load testing before deployment.
