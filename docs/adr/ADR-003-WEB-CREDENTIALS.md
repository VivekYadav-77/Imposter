# ADR-003: Web participant credential transport

**Status:** Accepted  
**Date:** 2026-09-20

## Decision

Use one opaque participant-session credential model with two transports: bearer tokens for native clients and a Secure, HttpOnly, SameSite cookie for the same-origin web client. State-changing cookie-authenticated requests must pass an Origin check. Add a synchronizer CSRF token later only if cross-site deployment requirements weaken the SameSite/origin controls.

## Consequences

- Raw web session tokens never enter browser JavaScript or serialized DTOs.
- Authentication middleware normalizes either transport into the same principal.
- CORS is an explicit origin allowlist and never combines wildcard origins with credentials.
- Realtime handshakes use handshake auth/header/cookie mechanisms, never query parameters.
