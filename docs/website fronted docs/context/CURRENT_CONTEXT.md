# Frontend phase 7 context — Complete product surface and release-readiness baseline

## Status

Phases 0–6 implementation is complete. Phase 7 is substantially complete: all repository checks, contract checks, production compilation, responsive static-route QA, and browser console checks pass. The four-client live game journey and admin draft-to-archive browser journey still require the external PostgreSQL/object-storage runtime and provisioned admin account, so release readiness remains partially complete rather than being overstated.

## Delivered behavior

- Responsive Night Desk marketing home, how-to-play, and privacy/photo/18+ pages with production metadata and mobile navigation.
- `/play` create/join modes with exact six-character room-code handling, 24-character nickname limit, adult/privacy acknowledgement, same-origin cookie bootstrap, duplicate-submit prevention, stable idempotency keys, retry handling, and safe errors.
- A single `/room` application shell that loads authoritative room/game snapshots, connects Socket.IO at `/realtime`, detects schema/version gaps, resyncs, reflects presence, and stops presenting a usable session after revocation.
- Lobby roster, copyable room code, host-only published-pack/timer settings, capability-gated start, safe leave confirmation, and realtime host/presence projection.
- Private role reveal that is opt-in and re-obscures on blur/backgrounding; participant-specific task progress; eliminated/ghost state; capability-gated kill with confirmation; intent/direct-upload/confirm evidence lifecycle; provisional copy; evidence gallery; and capability-gated flagging.
- Discussion, evidence review, replaceable ejection vote/skip, participation counts, aggregate result, killed/ejected projection, terminal winner/abandoned state, and start-new-room path. Other roles and individual ballots are never rendered.
- Admin sign-in/out, session-expiry routing, search/status/sort list, create/edit ordered items, active toggles, revision-aware save, publish validation handoff, archive confirmation, conflict recovery, idempotent mutations, and unsaved-change protection.
- Shared accessible primitives plus a development-only `/dev/showcase` (404 in production).

## Architecture and contracts

- `src/client/api/types.ts` is the browser DTO boundary; client code imports no backend service, repository, database, or domain module.
- `src/client/api/client.ts` centralizes cookie credentials, JSON envelopes, request IDs, `Retry-After`, retry/backoff, error mapping, and stable mutation idempotency.
- `src/client/realtime/client.ts` owns Socket.IO lifecycle, schema-version validation, state-version gap detection, resync, and teardown.
- `src/client/components/room-client.tsx` owns one authoritative participant state per tab. Snapshot messages replace state; commands do not invent committed state.
- Signed upload and image URLs remain component memory only. No participant credential, role, ballot, object key, or signed URL is written to local/session storage or analytics.
- Implemented contract operations are room create/join/current/settings/leave/start; game snapshot/kill; current meeting/review vote/ejection vote; evidence intent/confirm/list/flag; published packs; admin session and pack lifecycle. Realtime v1 room/game snapshots, presence, revocation, resync, and ready messages are handled.
- Deliberate exclusions: host removal, emergency meetings, chat, timer extension, manual phase advance, replay, public accounts, anonymous pack browsing, other-role reveal, and individual-ballot reveal.

## Files created or changed

- `app/layout.tsx`, `app/globals.css`, `app/page.tsx` — metadata, global design system, and landing page.
- `app/how-to-play`, `app/privacy-and-photos`, `app/play`, `app/room` — public and participant routes.
- `app/admin/**` — administrator login, list, new, and edit routes.
- `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` — route boundaries.
- `app/dev/showcase/page.tsx` — development-only primitive gallery.
- `src/client/api/**` — typed transport boundary and DTOs.
- `src/client/realtime/client.ts` — authenticated realtime wrapper.
- `src/client/components/ui.tsx` and `site-shell.tsx` — primitives and public chrome.
- `src/client/components/play-form.tsx`, `room-client.tsx`, `admin-client.tsx` — feature composition.
- `tests/unit/frontend-api.test.ts`, `frontend-design.test.ts` — cookie/idempotency/error and token/foundation checks.

## Design and accessibility decisions

- Approved ink/amber palette and phase colors are CSS tokens; task gold uses dark ink, while lobby/meeting/result colors use light text.
- Gameplay is dark, capped-width, mobile-first, safe-area aware, and remains functional at 320 CSS pixels. Admin intentionally uses a derived warm-paper light surface.
- Every control has a minimum 44-pixel target, visible focus, semantic labels, associated errors, and keyboard operation. Destructive/high-stakes actions use explicit second-step confirmations.
- Reduced motion removes transforms and continuous animation. Phase, presence, processing, and result state always include text, not color alone.
- Role content is never automatically revealed or announced and is hidden on blur/visibility change. Evidence upload provides camera and file-picker paths.

## Verification

- `npm run check` — passed: Prettier, ESLint, strict TypeScript, 13 unit-test files / 50 tests, OpenAPI drift validation, and realtime schema/fixture validation.
- `npm run build` — passed: Next.js 16 optimized production build plus server TypeScript compilation; all product routes compiled.
- Follow-up `npm run lint` and `npm run typecheck` after the showcase addition — passed.
- In-app-browser manual QA against `next start -p 3100`: landing, `/play`, join-mode interaction, `/admin/login`, and `/room` unavailable-session recovery rendered correctly; console had zero warnings/errors.
- Responsive manual QA at an explicit 320×640 viewport passed; viewport override was reset afterward.
- Live multi-client and authenticated admin browser journeys were not run because this verification instance did not start the external PostgreSQL/object-storage/provider environment or use administrator credentials.

## Known limitations and risks

- Release-signoff journeys involving four simultaneous clients, real object storage, deadline workers, and a provisioned administrator remain environment-dependent verification work.
- Public privacy/legal copy remains subject to launch-owner approval.
- Final font licensing/hosting and branded share-image assets remain external design/launch decisions; the implementation uses a resilient local system-font strategy and does not fetch third-party fonts.
- No service worker or third-party analytics is installed by design.

## Exact next starting point

Finish the remaining Phase 7 environment-backed QA. Start PostgreSQL and the configured private object-storage emulator/provider, apply migrations, provision a disposable admin, then add/run browser automation for the four-client complete game and admin draft→publish→archive journeys. Expected additions are browser-test configuration and tests under `tests/browser/`; production component code should change only for a reproduced defect.

## Continuation instruction

The next agent must read `README.md`, `FRONTEND_MASTER_PLAN.md`, Phase 7 in `FRONTEND_PHASE_PLAN.md`, the design system, client integration contract, and this context. It should not review implementation from completed phases unless a limitation above explicitly requires it or verification fails.
