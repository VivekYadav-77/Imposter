# Imposter Game website frontend master plan

**Status:** Approved implementation plan  
**Product surface:** Responsive web experience, player game client, and task-pack administration  
**Design direction:** Night Desk, Signal-Lit  
**Backend contract:** Frozen HTTP `/api/v1` and realtime schema version 1

## 1. Objective

Build a polished, mobile-first website that lets independent players complete the entire supported game through public backend contracts while also providing a persuasive marketing experience and a practical administrator task-pack interface.

The web client is a presentation and interaction layer. It must not reproduce backend rules, infer hidden state, assign roles, calculate winners, invent deadlines, expose signed URLs, or depend on backend implementation modules.

## 2. Product areas

### Marketing

- Landing page with a clear value proposition and original visual identity.
- How-to-play content grounded in actual MVP rules.
- Privacy/photo-safety and 18+ explanation.
- Direct path into create/join without account-registration friction.
- Metadata, semantic HTML, share previews, and strong performance.

### Player application

- Create/join and privacy acknowledgement.
- Lobby roster, presence, room code, task-pack selection, supported timer settings, and start readiness.
- Private role reveal and participant-specific task projection.
- Camera/file upload through presigned object-storage capability.
- Evidence browsing and flagging.
- Kill, meeting discussion, sequential evidence review, voting, results, ghost state, reconnection, and terminal states.
- Same-origin Secure/HttpOnly cookie transport; no participant token in browser JavaScript.

### Administrator

- Admin login/logout with server-managed cookie.
- List, search, filter, sort, create, edit, publish, and archive task packs.
- Revision-conflict, idempotency, validation, empty, loading, and error states.
- No invented room moderation, analytics, settings, or account-management surfaces.

## 3. Authoritative boundaries

When documents disagree, use this order:

1. `../../openapi/openapi.json`
2. `../../contracts/realtime-v1.schema.json`
3. `../CLIENT_INTEGRATION.md`
4. `imposter-game-design-system.md`
5. This plan and the phase plan

Render actions from server-provided `capabilities`. Treat `room.snapshot` and `game.snapshot` as complete authorized replacements. REST commands are authoritative; realtime delivery is a recovery and freshness channel.

The current backend does not support host removal, emergency meetings, timer extension after start, manual phase advancement, same-room replay, anonymous pack browsing, public player accounts, text/voice chat, or revealing other players' roles. The website must not suggest these capabilities.

## 4. Frontend architecture

Use the existing Next.js App Router and React/TypeScript application. Keep the custom Node server and backend routes intact.

Recommended boundaries:

```text
app/                         routes, layouts, metadata and route-level boundaries
src/client/
  api/                       generated/typed DTO boundary and HTTP client
  realtime/                  Socket.IO lifecycle, resync and event parsing
  session/                   cookie-session lifecycle and route recovery
  game/                      authoritative snapshot store and phase selectors
  components/
    primitives/              accessible buttons, inputs, sheets, dialogs
    game/                    phase bar, roster, task/evidence/vote components
    marketing/               public-page sections
    admin/                   task-pack tables and forms
  styles/                    tokens, theme, motion and utilities
  test/                      fixtures, factories and browser helpers
```

Rules:

- No direct imports from backend service/repository/database modules into client code.
- Handwritten adapters may wrap generated contract types, but cannot weaken them to `any`.
- Centralize error-envelope parsing, request IDs, idempotency keys, `Retry-After`, and state-version conflict handling.
- Keep idempotency keys stable for retries of the same request body; generate a new key for a changed intent.
- Use one participant state owner per tab. Store no role/session secret in analytics or durable browser logs.
- Use server components for static marketing content where helpful; interactive gameplay remains client-owned and realtime-aware.
- Prefer platform primitives and a small deliberate dependency set. Do not add a general state/design/animation library unless the current phase proves a concrete need.

## 5. Routing model

Recommended routes:

```text
/                         marketing landing
/how-to-play              supported rules
/privacy-and-photos       photo/retention/18+ notice
/play                     create or join
/room                     authenticated room/game shell; phase derives from snapshot
/admin/login              administrator login
/admin/task-packs         administrator list
/admin/task-packs/new     create draft
/admin/task-packs/[id]    edit/publish/archive
```

Prefer one `/room` shell rather than route-per-phase navigation. A realtime phase transition should replace the view without producing misleading browser history. The room code may be displayed/copied but is not authentication.

## 6. Design implementation

Implement the approved tokens from `imposter-game-design-system.md` as CSS custom properties. The player shell is dark and mobile-first; marketing and admin may use carefully derived light surfaces. Use phase color for orientation, never as the only state signal.

Core interaction requirements:

- Minimum 44×44 CSS-pixel targets.
- Stable sticky phase and critical-action regions with safe-area padding.
- No hover-only functionality.
- Two-step confirmation for kills, flags, leaving, and vote submission/changes.
- Private role reveal is opt-in, re-obscures when the document is hidden, and has a reduced-motion/keyboard equivalent.
- Motion follows the documented duration/easing budget and fully respects reduced motion.
- Layout remains usable at 320px width, 200% zoom, landscape phone, tablet, laptop, and large desktop.

## 7. State, recovery, and concurrency

Model transport state separately from authoritative game state:

- `connecting`, `connected`, `reconnecting`, `offline`, `revoked` for transport/session.
- `idle`, `submitting`, `retryable_error`, `conflict`, `succeeded` for commands.
- Snapshot phase/state version for game rendering.

On version gap, conflict, reconnection, or `server.resync_required`, request a complete snapshot. If a phase changes while a dialog or draft action is open, close/invalidate it safely and explain what changed. Never retain a destructive confirmation across a phase transition.

Uploads are a multi-step state machine: obtain intent, upload bytes with required headers, confirm, show provisional assignment completion, then reconcile processing/rejection through snapshots/list refresh. Signed URLs remain ephemeral memory-only data.

## 8. Accessibility, privacy, and security

- Meet WCAG 2.2 AA for shipped flows.
- Use semantic landmarks, labels, descriptions, focus management, error summaries, and restrained live regions.
- Never auto-announce or auto-display a role in a shared space.
- Provide camera and file-picker paths; explain photo consent before the first upload.
- Do not cache authenticated API responses or evidence images in a service worker.
- Avoid third-party analytics/session replay on authenticated player and admin routes. If analytics is later approved, allowlist non-sensitive events explicitly.
- Sanitize no server HTML because the client should render text as text. Preserve CSP compatibility; avoid inline scripts/styles that require unsafe directives.

## 9. Testing strategy

- Unit tests: reducers/selectors, timers, formatters, error mapping, idempotency retry behavior.
- Component tests: keyboard/touch states, focus restoration, dialogs/sheets, role privacy, upload state machine.
- Contract tests: DTO fixtures against frozen schemas and exhaustiveness for phases/capabilities.
- Integration/browser tests: create/join, lobby/start, reconnect/resync, evidence upload with controlled storage, kill/meeting/vote, terminal state, and admin pack lifecycle.
- Visual tests: key screens at small phone, standard phone, tablet, and desktop; reduced motion and 200% zoom.
- Accessibility tests: automated checks plus keyboard and screen-reader smoke passes.
- Performance: marketing Core Web Vitals and gameplay interaction responsiveness on a mid-range mobile device.

## 10. Definition of done

The website is client-complete when:

- Every supported participant and administrator operation is usable without importing backend internals.
- All phase/recovery/privacy/error states are designed and tested.
- Responsive screenshots and accessibility checks meet the documented matrix.
- No UI exposes or infers unauthorized roles, ballots, object keys, credentials, or signed URLs.
- Clean install, lint, typecheck, unit/integration/browser tests, contract checks, and production build pass.
- The current context accurately records delivered behavior and the next work boundary.

Provider deployment, public legal approval, active monitoring/backup configuration, and native Android implementation remain separate launch tracks.
