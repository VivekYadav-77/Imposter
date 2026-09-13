# Website frontend phase plan

Each phase is independently verifiable and ends by replacing `context/CURRENT_CONTEXT.md` using the mandatory template. A later agent reads that context instead of reviewing previous-phase code.

## Phase 0 — Frontend foundation and contract boundary

**Objective:** establish the client architecture without building feature pages.

Deliver:

- Route/layout skeleton for marketing, player, and admin areas.
- CSS token implementation, font loading strategy, reset, safe-area utilities, focus and reduced-motion foundations.
- Typed HTTP client, common success/error parsing, request ID capture, idempotency helper, and retry policy.
- Realtime client wrapper with authenticated connection, resync requests, teardown, and schema-version guard.
- Test stack for components/browser flows and deterministic frontend fixtures.
- Error/loading/not-found boundaries and a development-only component showcase.

Tests: token/contrast checks, API adapter tests, realtime lifecycle tests, route smoke tests, production build.

Complete when no placeholder UI depends on backend implementation modules and the next phase can build exclusively on typed client interfaces.

## Phase 1 — Design system and responsive application shell

**Objective:** turn the approved visual specification into reusable, accessible primitives.

Deliver buttons, icon buttons, inputs, room-code input, cards, badges, status chips, timers, progress, skeletons, banners, toast, dialog, confirmation sheet, drawer, tabs, phase bar, player identity token, and responsive game shell. Include all interaction/disabled/loading/error/focus/reduced-motion states.

Tests: keyboard and focus behavior, 320px/200% zoom, touch targets, reduced motion, contrast, visual snapshots for all primitives.

Complete when feature phases need composition rather than new styling conventions.

## Phase 2 — Marketing, trust, and create/join

**Objective:** ship the public funnel into a valid room session.

Deliver landing, how-to-play, privacy/photos/18+ content, `/play`, create/join modes, exact room-code/nickname validation, privacy acknowledgement, cookie transport, duplicate-submit protection, expired/invalid room handling, metadata, and responsive navigation/footer.

Do not anonymously call the participant-only task-pack API. Do not store participant credentials in client-readable persistence.

Tests: create/join happy paths, validation, `429`/`Retry-After`, idempotent retry, cookie behavior, keyboard/phone layouts, no-secret storage audit.

## Phase 3 — Lobby, presence, host setup, and game start

**Objective:** make realtime room formation dependable and understandable.

Deliver authoritative room snapshot state, realtime connect/reconnect/resync, roster presence, host transfer presentation, code copy/share, authenticated published-pack selection, supported timers, readiness reasons, host-only capability rendering, leave confirmation, and start transition.

Imposter/task counts are displayed only if provided/derived by the server at start; they are never editable.

Tests: simultaneous roster updates, reconnect, host transfer, non-host authorization, stale UI recovery, start retry/idempotency, small-phone lobby.

## Phase 4 — Private role, tasks, and evidence lifecycle

**Objective:** deliver the complete task-phase experience without leaking secrets.

Deliver opt-in role reveal, background re-obscuring, participant-specific assignments, task progress, crew ghost state, imposter kill capability when allowed, evidence intent/upload/confirm flow, provisional processing states, rejected-task reopening, evidence gallery, signed-image refresh, and flagging.

Tests: shoulder-surf/privacy behaviors, no cross-player role data, direct-storage upload headers, upload expiry/retry, media rejection, ghost permissions, flag restrictions, offline/reconnect during upload.

## Phase 5 — Meetings, reviews, voting, and outcomes

**Objective:** complete every server-driven game phase.

Deliver kill/deadline meeting entry, discussion timer, current evidence-review item, valid/invalid voting, replaceable ejection vote, skip, participation counts, aggregate result display, return-to-task transition, killed/ejected views, terminal winner view, abandoned/expired/session-revoked recovery, and start-new-room CTA.

Never reveal another player's role or an individual ballot. Never add host phase controls.

Tests: every phase and capability combination, timer expiry/resync, vote replacement, ties/skip/no-vote, mid-dialog phase change, terminal response/realtime recovery, secret-data assertions.

## Phase 6 — Administrator task-pack experience

**Objective:** provide the exact supported operational authoring surface.

Deliver login/logout, session-expiry handling, list/search/filter/sort/pagination, create draft, ordered item editing, active toggles, revision-aware updates, publish validation, archive confirmation, idempotent mutations, conflict resolution, and unsaved-change protection.

Do not add room moderation, administrator-settings pages, fake-task variants, image rules, difficulty, analytics, or administrator registration.

Tests: auth boundary, generic login errors, rate limiting, validation, revision conflicts, replayed idempotency, publish item-count rule, archive terminality, responsive editor.

## Phase 7 — Integration, polish, and website release readiness

**Objective:** prove the complete frontend as a secure, accessible consumer of the frozen contracts.

Deliver full browser journeys, visual regression matrix, accessibility audit, responsive/device QA, reduced-motion audit, performance budgets, offline/reconnect drills, error-copy review, DTO leakage audit, CSP/cookie/storage review, dependency scan, production metadata, and frontend handoff.

Required journeys:

1. Four web clients create/join/start and reach a task phase.
2. Evidence upload, processing, flagging, meeting review, voting, and outcome.
3. Restart/reconnect and state-version gap recovery in every phase.
4. Administrator draft-to-publish-to-archive lifecycle.

Complete when all repository checks and production build pass, the browser test uses public contracts only, and remaining launch items are explicitly external rather than hidden TODOs.
