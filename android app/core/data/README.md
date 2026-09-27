# Data core

UI-independent Phase 3 client infrastructure for the frozen `/api/v1` and realtime schema v1 contracts.

- `model`: transport snapshots kept separate from future feature/domain models.
- `network`: cancellable authenticated HTTP, typed errors, and command-scoped retry metadata.
- `session`: platform-neutral participant credential/lifecycle contracts.
- `repository`: authoritative full-snapshot state with late-response and version-gap protection.
- `realtime`: Socket.IO WebSocket-only session transport and reconnect coordination.
- `bootstrap`: deterministic startup routing based on server-authoritative state.

The `core:session` Android adapter supplies Keystore-backed encrypted persistence so this module and its host-side tests remain independent of the Android SDK.
