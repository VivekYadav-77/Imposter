# Imposter Game — Design Strategy & Visual System

A complete creative direction for the Imposter Game website. No production code — this is the reference another builder works from.

## 0. Project-alignment review

**Verdict:** the “Night Desk, Signal-Lit” direction is approved. It is distinctive, appropriate for low-light group play, and supports the most important usability requirement: recognizing the current phase at a glance. The design language should be implemented with restrained texture, strong typography, and phase color used as orientation—not decoration.

This document is subordinate to the frozen backend contracts in `../../openapi/openapi.json`, `../../contracts/realtime-v1.schema.json`, and `../CLIENT_INTEGRATION.md`. The following corrections are binding:

- Room creation collects only the host nickname. The host chooses a published task pack and timer settings after entering the lobby.
- Imposter count and tasks per crew are computed by the server and are not host-editable.
- Host settings exist only in the lobby. There is no timer extension, player-removal, emergency-meeting, or in-game moderator control.
- Published task packs are available only to an authenticated participant; there is no anonymous public pack catalog.
- Task items contain a description and active state. There are no difficulty tags, icons, separate fake-task authoring fields, or image-requirement toggles.
- Role and assignment secrecy is permanent. Other players' roles are not revealed after an ejection or at game over.
- A completed room cannot be replayed. “Play again” means creating a new room.
- Evidence confirmation completes an assignment provisionally. Processing may later reject the media and reopen the assignment; the UI must describe this accurately.
- Votes are replaceable until the phase locks. Confirmation prevents accidental input but must not claim the vote is irreversible.
- Realtime snapshots are authoritative replacements. Do not optimistically invent committed game state.
- Capability arrays and server phase—not assumed actor type—control which actions are rendered.

Items outside the current contract may be recorded as future ideas, but must not appear in the MVP interface or implementation plan.

---

## 1. Product Design Principles

1. **The phone is a tool, not the game.** Players are looking at each other, not the screen. Every screen must be readable in under 2 seconds of glancing.
2. **One-handed, one-thumb.** Someone is holding a snack, a drink, or their phone flashlight. All primary actions sit in the bottom third of the screen on mobile.
3. **The current phase is never ambiguous.** A player who looks away for 10 seconds and looks back must instantly know: am I in a task, a meeting, or eliminated?
4. **Secrets feel like secrets.** Role reveal and private info need real visual weight — a moment, not a toast notification.
5. **Nothing destructive happens by accident.** Kill, flag, vote, and leave-room actions all require deliberate confirmation, because thumbs are moving fast in a social setting.
6. **Dim-room legible.** Parties happen with lights low. Contrast and size must survive that, not just a lab screen.
7. **Calm chrome, loud moments.** The UI shell (nav, cards, lists) stays quiet and disciplined. Animation budget is spent only on the 8–10 moments that matter (role reveal, elimination, meeting call, vote result, victory).
8. **Original, not derivative.** No spacesuits, no bean-shaped mascots, no airlock-blue-and-red. The identity is built from paper, ink, light, and typography — not sci-fi costume design.

---

## 2. Three Visual Concepts

### Concept A — "Night Desk" (Field Dossier / Covert Briefing)

**Idea & tone:** You've been handed a case file under a desk lamp. The product feels like classified paperwork brought into a slick modern app — stamps, redaction bars, typewriter accents — but rendered cleanly, not "grungy scrapbook." Tone: composed, quietly tense, trustworthy.

**Palette (exact hex):**

- Background (base): `#14130F` (near-black warm ink, not pure black)
- Surface / card: `#1C1B16`
- Surface elevated: `#242219`
- Border / hairline: `#3A3627`
- Primary accent (amber stamp): `#D98E3B`
- Secondary accent (faded brass): `#8A7A52`
- Success (cleared): `#5C8A5C`
- Danger (eliminated/ejected): `#B5482F`
- Warning (pending/uncertain): `#C9A227`
- Info (system): `#5C7A8A`
- Text primary: `#EDE7D8`
- Text secondary: `#A69E86`

No blues-and-purples-as-default. No gradient backgrounds — flat ink surfaces with a very faint (2–3%) paper-grain noise texture instead.

**Typography:** A humanist grotesque for UI text (e.g., a _Inter_-class or _Söhne_-class font) paired with a condensed slab or stencil-adjacent display face for headlines and the phase indicator — like a stamped case-file header. Numbers (room codes, timers) use tabular, slightly spaced-out digits so a "0" is never mistaken for an "8" in dim light.

**Surfaces, borders, shadow:** Flat surfaces, 1px hairline borders in `#3A3627`, no drop shadows on mobile (shadows are the first thing that reads as "generic AI app" — replaced with a 1px top highlight border instead to imply elevation). Corners: small radius (8–10px), not the pill-everything look.

**Icons/illustration:** Thin-line, single-weight icons, hand-stamped feel — a torch, a camera, a thumbprint, a wax-seal-style circular badge for the host. No 3D icons, no emoji-as-icons.

**Background treatment:** Solid ink color with a subtle grain/film-grain texture (~3% opacity noise) — this alone kills the "generated gradient blob" look.

**Buttons/controls:** Rectangular with soft corners, filled amber for primary, outline for secondary. Pressed state = slight inset shadow, not a glow. No neon glow anywhere.

**Motion personality:** Deliberate, weighted, slightly mechanical — like a stamp coming down, or a drawer sliding open. Not bouncy.

**Strengths:** Feels premium and different from every "gamer" site; scales beautifully to dim rooms; typography does a lot of the "mystery" work so the palette can stay restrained.
**Weaknesses:** Could feel too serious/corporate if overused; needs the amber accent used generously enough to stay "fun."
**Why it fits:** The whole product is about hidden information and evidence review — a dossier metaphor is literally what's happening in the game (task photos = evidence, meetings = case review).

---

### Concept B — "Parlour Noir" (Dark Card-Table Sophistication)

**Idea & tone:** A backroom card game — velvet, brass fittings, low lamp light. More "elegant heist" than "case file." Tone: sly, confident, a little glamorous.

**Palette:**

- Background: `#141018`
- Surface: `#1F1926`
- Primary accent (garnet): `#8C2F39`
- Secondary accent (brass): `#B08D57`
- Success: `#4F7A5C`
- Danger: `#C1483F`
- Text primary: `#F1EAE2`

**Typography:** A high-contrast serif for display (headlines, role reveal) + clean sans for UI — the serif does the "sophistication" work.

**Surfaces:** Deep plum-black with a subtle felt/weave texture on hero sections only (not every card, to avoid clutter). Brass-thin dividing lines.

**Strengths:** Very distinctive, feels adult (18+ is easy to sell), photographs well for marketing/social sharing.
**Weaknesses:** Serif-heavy UI text can hurt legibility at small sizes on phones; risk of feeling more "casino app" than "party game" if brass is overused.
**Why it fits:** Strong "mystery party" identity, but slightly less flexible for fast-paced UI text than Concept A.

---

### Concept C — "Street Signal" (Bold Flat Modern Social-Play)

**Idea & tone:** Poster/zine energy — flat bold color blocks, halftone dot texture, big confident type. Feels like a physical party game box, not a screen. Tone: energetic, social, unpretentious.

**Palette:**

- Background: `#F4F1E9` (warm paper white) _or_ dark mode `#191919`
- Ink: `#191919`
- Accent 1 (signal red): `#D6402C`
- Accent 2 (signal yellow): `#E8B33D`
- Accent 3 (signal teal): `#2E7D6B`
- Each **game phase** gets one flat accent color (lobby=teal, tasks=yellow, meeting=red) instead of everything sharing one accent.

**Typography:** Bold grotesque display type, tight tracking, big numerals for timers.

**Surfaces:** Flat color blocks, hard edges, thin black keylines (like risograph/screen-print), halftone dot texture used sparingly as a background device.

**Strengths:** Extremely shareable/marketable, very "not-AI-generated" because it rejects dark-mode-gradient defaults entirely, great for a light-mode marketing site.
**Weaknesses:** Harder to keep "mysterious" — leans more "party game night" than "who do you trust." Flat light backgrounds can be harsh in a dim room if used for the in-game surface (needs a dark in-game mode even if marketing site is light).
**Why it fits:** Best for virality/marketing but weakest for the tense, secretive core loop compared to A.

---

## 3. Comparison Table

| Criteria                            | A. Night Desk | B. Parlour Noir | C. Street Signal  |
| ----------------------------------- | ------------- | --------------- | ----------------- |
| Fits "secrecy & tension"            | Strongest     | Strong          | Weakest           |
| Fits "party energy"                 | Medium        | Medium          | Strongest         |
| Dim-room legibility                 | Strongest     | Medium          | Weak (light mode) |
| Marketing shareability              | Medium        | Strong          | Strongest         |
| Distinct from generic AI-app look   | Strong        | Strong          | Strongest         |
| Risk of feeling "corporate"         | Medium        | Low             | Low               |
| UI text legibility at small size    | Strongest     | Weaker (serif)  | Strong            |
| Build complexity (textures, states) | Medium        | Medium          | Low               |

---

## 4. Recommended Final Direction — Hybrid: "Night Desk, Signal-Lit"

**Decision:** Base the entire product on **Concept A (Night Desk)** as the structural and emotional foundation — it's the only one that serves _both_ the secrecy and the legibility requirements simultaneously, and it's the most defensible against the "this looks AI-generated" complaint because it avoids the two biggest tells: (1) purple/blue gradient backgrounds and (2) glowing neon buttons.

Borrow **one thing from Concept C**: assign a distinct flat accent color to each _game phase_ (not each random UI element) — lobby, tasks, meeting, results — layered on top of the Night Desk palette. This solves the "phase must be unmistakable" requirement without breaking the dossier identity, and it gives the product a signature device: **glancing at the color of the screen tells you the phase before you read a word.**

Do **not** use Concept B's serif-heavy approach — legibility at small sizes matters more than glamour here.

### Why this wins

- Solves the hardest constraint (phase clarity, dim-room use, one-handed play) better than the alternatives.
- The dossier/evidence metaphor is literally what the mechanic is (photo evidence, meetings, votes) — the visual language and the product logic reinforce each other, which reads as intentional rather than decorative.
- Phase-based accent color is a genuinely original navigation device most party-game apps don't use — a strong point of difference.
- Avoids every visual cliché a reviewer would flag as "looks AI-made": no indigo-to-purple gradient hero, no glassmorphism cards, no glowing pill buttons, no generic sans-only stack, no stock 3D icon set.

---

## 5. Brand & Visual System

### 5.1 Brand personality (7 traits)

1. **Composed** — never chaotic, even during a meeting countdown.
2. **Sly** — a wink, not a scream. Copy and micro-interactions carry dry humor.
3. **Trustworthy** — privacy and fairness are visually reinforced (locks, seals, redaction as _protection_, not as a gimmick).
4. **Tactile** — feels like paper and ink, not glass and glow.
5. **Decisive** — every screen has one obvious next action.
6. **Nocturnal** — built for evening, dim rooms, phones in hand.
7. **Unpretentious** — premium, but never precious or over-designed for its own sake.

### 5.2 Logo & identity direction

- **Symbol:** A circular wax-seal-style mark containing a single abstract "masked eye" — two overlapping arcs forming an eye shape inside a stamped circle, printed as flat single-color ink, never 3D or glossy. Reads as "watched / hidden" without any face, mascot, or character (avoids any resemblance to existing games' characters).
- **Wordmark:** "IMPOSTER GAME" set in the condensed display face, tight tracking, all-caps, with the second word set slightly smaller/lighter — implies a stamped label rather than a logotype.
- **Tagline options:**
  - "Trust no one. Prove everything."
  - "Everyone's watching. Someone's lying."
  - "The room knows. You don't — yet."

### 5.3 Design tokens

**Color tokens**
| Token | Hex | Usage |
|---|---|---|
| `bg.base` | `#14130F` | App background |
| `bg.surface` | `#1C1B16` | Cards, panels |
| `bg.elevated` | `#242219` | Modals, sheets, popovers |
| `bg.overlay` | `#0B0A07` at 72% | Scrim behind modals/role reveal |
| `border.hairline` | `#3A3627` | Card/list dividers |
| `border.focus` | `#D98E3B` | Focus ring |
| `text.primary` | `#EDE7D8` | Body/headline text |
| `text.secondary` | `#A69E86` | Meta text, timestamps |
| `text.disabled` | `#5E5A48` | Disabled labels |
| `text.danger` | `#E06B51` | Accessible danger copy on dark surfaces |
| `text.info` | `#7E9EAD` | Accessible informational copy on dark surfaces |
| `accent.primary` (amber) | `#D98E3B` | Primary buttons, host badge |
| `accent.secondary` (brass) | `#8A7A52` | Secondary emphasis |
| `phase.lobby` | `#4A6878` (deep slate blue) | Lobby screens with `text.primary` |
| `phase.tasks` | `#C9A227` (dim gold) | Active task phase |
| `phase.meeting` | `#A63F2B` (deep rust red) | Meeting/voting with `text.primary` |
| `phase.results` | `#426D48` (deep moss green) | Results with `text.primary` |
| `state.success` | `#5C8A5C` | Task accepted, connected |
| `state.warning` | `#C9A227` | Pending, uncertain |
| `state.danger` | `#B5482F` | Danger fills/borders; use `text.danger` for small text |
| `state.info` | `#5C7A8A` | Info fills/borders; use `text.info` for small text |

Use `text.primary` on lobby, meeting, and result phase surfaces. Use `bg.base` ink text on the gold task phase surface. These specific pairings meet **WCAG AA (4.5:1)** for normal text; tokens are not assumed to be interchangeable with every foreground.

**Typography**

- Display/headline face: condensed slab or stencil-adjacent grotesque (e.g., a _Fjalla One_ / _Barlow Condensed_-class face).
- UI/body face: humanist grotesque (e.g., _Inter_-class), variable weight 400–600.
- Numerals: tabular lining figures everywhere (room codes, timers, vote counts).

Type scale (mobile base 16px, fluid up on larger screens):
| Token | Size | Weight | Use |
|---|---|---|---|
| `display.xl` | 40/44 | 700 | Landing hero |
| `display.l` | 28/32 | 700 | Phase headers (ROLE REVEAL, MEETING) |
| `heading.m` | 20/26 | 600 | Card titles |
| `body.m` | 16/24 | 400 | Default body |
| `body.s` | 14/20 | 400 | Secondary/meta |
| `caption` | 12/16 | 500 | Labels, tags, timestamps |
| `numeral.timer` | 32/32 | 600 tabular | Countdown, room code |

**Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 (px) — 8px base grid.

**Radius scale:** `sm=6px` (inputs, chips), `md=10px` (cards), `lg=16px` (sheets/modals), `full` (avatars, badges only — not buttons, to avoid the "everything is a pill" AI look).

**Elevation:** No blurred drop shadows on mobile (battery + "glassy AI" avoidance). Elevation communicated by:

1. Background step-up (`base` → `surface` → `elevated`)
2. A 1px top-edge highlight (`rgba(255,255,255,0.04)`)
3. On desktop only, a very soft `0 4px 16px rgba(0,0,0,0.35)` for modals.

**Icon style:** 1.5px stroke, single color, no fills, 24px grid, rounded caps — consistent stamped-line feel.

**Illustration style:** Flat single-ink line illustrations (case-file diagram style) used sparingly on marketing pages only — never inside active gameplay screens.

**Focus ring:** 2px solid `#D98E3B`, 2px offset, visible on every interactive element — never removed.

**Grid/container:** 4px baseline grid; max content width `680px` for gameplay screens (never full-bleed text on desktop — keeps it phone-like even on a laptop, since the product's soul is mobile); marketing site max width `1120px`.

**Safe area:** `env(safe-area-inset-*)` padding applied to top phase bar and bottom action bar on all mobile screens.

**Theme:** Dark is the only theme for gameplay screens (non-negotiable — this is a low-light social product). Marketing/admin surfaces may offer a light variant using the same ink/amber tokens inverted onto `#F4F1E9`.

---

## 6. Sitemap & Information Architecture

```
Public Marketing (public, SEO'd, light-or-dark)
 ├─ / (Landing)
 ├─ /how-to-play
 ├─ /privacy-and-photos
 └─ /legal (terms, 18+ notice)

Player Game Experience (no account, room-scoped, full-screen app shell)
 ├─ /play (create or join entry)
 └─ /room (one authenticated shell; snapshots select lobby, role, task,
           meeting, result, or terminal views without phase-route history)

Host Controls (embedded in the lobby, not a separate site)
 └─ Host-only task-pack/timer settings sheet and start control

Admin (separate authenticated area, distinct visual chrome — desktop-first)
 ├─ /admin/login
 ├─ /admin/task-packs
 └─ /admin/task-packs/:id/edit
```

**Navigation model per area:**

- **Marketing:** conventional top nav + footer, standard scrolling site.
- **Player game:** _no navigation chrome at all_ — a persistent top **Phase Bar** (replaces a nav bar) and a bottom **Action Bar**. Players never "navigate" — the app pushes them through phases via realtime state.
- **Host controls:** contextual in the lobby only—a settings sheet for task-pack selection and the four supported timers. During play, the host has no privileged gameplay controls.
- **Admin:** classic authenticated dashboard — sidebar nav, tables, forms. Deliberately looks _different_ (more conventional SaaS) from the game shell, reinforcing "this is the backstage, not the game."

---

## 7. End-to-End Player Flow

Each entry: **Purpose → Key info → Primary/secondary action → Notes**

1. **Landing page** — Sell the concept fast. Key info: what it is, who it's for (4–12 adults), one clear CTA. Primary: "Start a Room." Secondary: "How to Play." Hero uses phase-color-blocked visual (not a gradient).
2. **How-to-play** — Explains loop via short numbered steps + one illustrative diagram (flat ink style). Primary: "Got it, start a room."
3. **Privacy/photo-safety** — Plain-language explanation of photo retention/deletion. Primary: back to create/join. Must be reachable from every join/create screen, not just buried in footer.
4. **Create-room flow** — Host enters a nickname and gets a 6-character code. Task-pack selection happens afterward in the authenticated lobby. Primary: "Create Room."
5. **Join-room flow** — Enter code + nickname. Primary: "Join." Inline validation on code (auto-uppercase, 6-char mask). Error state for invalid/expired code shown inline, not as a separate page.
6. **Age/privacy acknowledgement** — Single checkbox + one-line summary + link to full policy, shown once per room join, not a full-page interstitial (reduce friction).
7. **Room lobby** — Roster of joined players with presence dots, host badge, task-pack name, player count vs. min/max. Primary (host only): "Start Game" (disabled until min players met — shown as _why_ disabled, not just greyed). Secondary: leave room.
8. **Host settings** — Sheet/drawer over lobby: published task-pack selection and task, discussion, review, and voting timer lengths. Never a separate route. Imposter/task counts are server-owned.
9. **Task-pack selection** — Authenticated card list with pack name, description, active task count, and revision. Host-only.
10. **Player roster & connection state** — Persistent component (not a separate screen) visible via a collapsible drawer at all times; shows connected/reconnecting/disconnected per player.
11. **Game-start transition** — Full-screen countdown (3–2–1) on `phase.lobby` color, then hard-cut (not fade) to role reveal — the cut itself signals "this is real now."
12. **Private role reveal** — Full-screen, high-privacy moment: press-and-hold to reveal (prevents shoulder-surfing accidentally), auto-blurs if app loses focus. Primary: "I understand my role" → proceeds to tasks. This is the single most important "premium moment" screen in the product.
13. **Active task phase** — Persistent Phase Bar (gold, `phase.tasks`) + task list + timer. Primary: open current task. Secondary: view evidence gallery.
14. **Crew task list** — Checklist cards, each with status (todo/pending/accepted/rejected).
15. **Imposter fake-task experience** — Visually _identical_ task list UI (critical: must not be visually distinguishable from crew's screen by design, since that would leak info if seen over a shoulder) but content is fabricated tasks; kill action is a separate, deliberately harder-to-reach control (long-press + confirm) inside the same shell.
16. **Photo capture/upload** — Native camera trigger, immediate local preview, upload progress bar, clear "don't leave this screen" state.
17. **Upload progress/processing/acceptance/rejection/retry** — Explicit states: `uploading → confirmed/provisional → accepted` or `rejected and task reopened`. Show a reason only when the API provides one; always offer a safe retry path when the assignment is open.
18. **Evidence gallery** — Grid of accepted photos per player/task, tap to enlarge, flag control per item.
19. **Flagging suspicious evidence** — Two-step: tap flag icon → confirm sheet with an optional one-line reason. One player may flag a submission once, so the confirmation clearly explains that the flag cannot be withdrawn.
20. **Elimination interaction (imposter)** — Long-press target player avatar → confirmation sheet ("Eliminate [name]? This can't be undone this round.") → animated confirmation.
21. **Eliminated/ghost state** — Screen desaturates, "You have been eliminated" banner, read-only view of remaining game (can still see meetings/results, cannot act) — clearly different chrome so it's unmistakable.
22. **Meeting announcement** — Full-screen interrupt on `phase.meeting` red, short unmissable animation + sound cue if enabled, cannot be dismissed without acknowledging.
23. **Discussion timer** — Large persistent countdown, no other primary action competing with it.
24. **Evidence-review voting** — Evidence gallery re-surfaced in meeting context, players can reference specific photos while discussing.
25. **Ejection voting** — One player per vote, large tap targets, "skip vote" always available, vote is hidden from others until reveal.
26. **Vote-result reveal** — Dramatic but short reveal sequence: aggregate tally count-up → ejected player or no-ejection result. Never reveal another player's role.
27. **Returning to task play** — Hard-cut back to `phase.tasks` gold, brief "meeting ended" toast.
28. **Crew victory / Imposter victory** — Full-screen result on `phase.results` green (or muted rust for an imposter win), using only contract-provided winner, roster life states, meeting totals, and progress. "Start a New Room" begins a new session; never promise roster reuse or reveal hidden roles.
29. **Reconnection/resync** — Non-blocking top banner "Reconnecting…" with spinner; on success, silently resyncs state without forcing a manual refresh.
30. **Expired/abandoned/unavailable room** — Dedicated calm empty-state screen, not a raw error — "This room has ended or expired" + CTA to start a new one.
31. **Session revocation** — Clear neutral message based on the server reason, followed by a safe route back to `/play`. Do not imply host removal because that capability does not exist.
32. **Generic loading/empty/offline/error/retry** — Shared component set (see §8) reused everywhere, never a raw browser error.

---

## 8. Detailed Key-Page Specifications

### Marketing landing page

- **Header:** Logo mark + wordmark left, "How to Play" + "Start a Room" right (desktop); hamburger collapses to sheet on mobile.
- **Main structure:** Hero (headline + one-line pitch + primary CTA) → 3-step "how it works" strip (flat icon + short line each) → social proof / party-photo-style illustration band → secondary CTA → footer with privacy/legal links.
- **Cards/panels:** How-it-works uses 3 equal cards on desktop, stacked on mobile.
- **Max width:** 1120px content, hero can be full-bleed background color.
- **Mobile:** single column, CTA button sticky at bottom of hero viewport only (not globally sticky down the whole page).
- **Empty/error:** N/A for the static launch page. Do not invent live room/activity counters without an approved aggregate endpoint.

### Create/Join page

- **Header:** Minimal — back arrow + "Imposter Game" wordmark only, no full nav (this is already the funnel).
- **Main:** Two large tappable cards stacked on mobile ("Create a Room" / "Join a Room"), side-by-side on tablet+.
- **Content order:** Choice first → relevant single form appears below/inline, not a new page.
- **Max width:** 480px centered — this is a form, not a browsing page.
- **States:** Inline field validation; invalid code shows red hairline + inline message, no modal.

### Lobby

- **Header (in-shell):** Phase Bar shows "LOBBY" on `phase.lobby` slate, room code large and tap-to-copy, player count "6/10."
- **Main:** Scrollable roster list (avatar-token + nickname + presence dot + host crown icon if applicable).
- **Sticky bottom:** Host sees "Start Game" primary button (with disabled-reason microcopy above it if under minimum players); non-hosts see "Waiting for host to start…" static state instead of a button.
- **Desktop/tablet:** Roster becomes a grid (2–3 columns) instead of a list; host settings panel can dock as a persistent side panel instead of a drawer.

### Role reveal

- **Full-bleed, no header/nav at all** — this screen should feel like nothing else in the product.
- **Main:** Center card, initially a face-down "sealed envelope" motif; press-and-hold reveals role name + one-line responsibility + relevant color (`phase` tie-in optional, kept subtle here since privacy > phase-color here).
- **Primary:** "I understand" (only enabled after reveal has been shown for a minimum duration, preventing accidental skip).
- **Accessibility:** Screen-reader users get an explicit "Press and hold, or activate this button, to reveal your private role" — never auto-announced on page load (would leak via screen-reader audio in a shared room).

### Active task screen

- **Header (in-shell):** Phase Bar "TASKS" on `phase.tasks` gold + countdown to next phase-eligible check (if used) + roster-drawer toggle icon.
- **Main:** Vertical list of task cards using the server-provided description and assignment status. Tapping opens task detail as a bottom sheet, not a new page.
- **Sticky bottom:** none needed beyond the phase bar — avoid competing bottom bars during core loop.
- **Mobile:** default and primary target. **Desktop/tablet:** same single-column layout centered at 480–560px — deliberately _not_ stretched wide, since players are still meant to feel like they're holding a phone.

### Evidence upload screen (bottom sheet from a task)

- **Main:** Camera trigger button large and centered; once captured, preview fills sheet with "Retake" / "Upload" actions.
- **States:** `uploading`, `confirmed/provisional`, `processing`, `accepted`, and `rejected/task reopened`. Never label a confirmed submission permanently accepted before processing finishes.

### Evidence gallery

- **Main:** Responsive grid — 2 columns mobile, 3–4 tablet/desktop — each thumbnail tagged with player nickname + task name.
- **Interaction:** Tap = full-screen viewer with swipe between photos; flag icon persistent in viewer corner.

### Meeting discussion screen

- **Header:** Phase Bar "MEETING" on `phase.meeting` rust-red — the single most visually distinct phase in the product, intentionally.
- **Main:** Large countdown timer top-center, evidence gallery access below as a secondary tab, not competing for primary space.
- **Sticky bottom:** none until voting opens — discussion phase should have zero unnecessary controls.

### Evidence review screen

- Same gallery component reused inside the meeting context; a lightweight tab switch ("Discuss" / "Evidence") within the meeting screen rather than a new route.

### Ejection voting screen

- **Main:** Grid of remaining players as large tap targets (avatar + name), "Skip Vote" as a clearly secondary (outline, not filled) option at the bottom, never visually equal-weight to naming a player.
- **Confirmation:** Tap → confirm sheet ("Vote to eject [name]?") before the vote locks in.

### Game-over screen

- **Main:** Full-bleed result banner (`phase.results` green for crew win, muted rust for imposter win), winner, final task progress, roster life states, and available aggregate meeting results. Other players' roles remain private.
- **Primary:** "Start a New Room." A completed participant session is terminal; do not offer same-room replay.

### Admin task-pack dashboard and editor

- **Distinct chrome:** a compact Task Packs sidebar/top navigation and admin session action—deliberately more conventional than the game shell, without placeholder Rooms or Settings destinations.
- **Dashboard:** Table of task packs (name, active/total item count, status, revision, last edited), contract-supported search/status/sort controls, and a "New Pack" action.
- **Editor:** Two-pane layout with pack name/description/status and an ordered list of task descriptions with active toggles. The backend creates believable imposter assignments from the same published pack; there is no separate fake-task field.
- **States:** Empty state for zero packs with a friendly CTA; inline validation on required fields; unsaved-changes guard on navigation.

---

## 9. Responsive Strategy (mobile-first)

- **320–375px (small phones):** Single column everywhere. Phase Bar text may abbreviate ("MEETING" stays, but supporting subtext drops). Room code font shrinks one step but never below 24px. Bottom action bar buttons are full-width.
- **390–430px (standard phones):** Baseline target — all specs above assume this width by default.
- **Large phones / small tablets (~600–760px):** Roster and evidence gallery move from 2 to 3 columns; task list can optionally show as 2 columns if pack has many tasks.
- **Tablets portrait (~768px):** Gameplay content still capped at ~560px centered (never stretched) to preserve the "phone-like" intimacy; host settings can dock as a side panel.
- **Tablets landscape / small laptops (~1024px):** Roster drawer can become a persistent left rail instead of an overlay.
- **Laptops (~1280–1440px):** Marketing/admin use full width per their own max-widths; gameplay shell stays centered and capped — this is intentional, not unfinished responsive work.
- **Large desktop (1920px+):** Same as laptop, extra space becomes background/margin, never stretched content.

**Touch targets:** minimum 44×44px enforced on every interactive element, including list-item rows (full row is tappable, not just the label text).

**Bottom safe area:** all sticky bottom bars pad with `env(safe-area-inset-bottom)`; critical actions (Start Game, vote confirm) never sit closer than 12px above the safe area.

**Timers/critical actions:** never placed inside a scrollable area — always pinned (top for countdowns, bottom for confirm actions) so they can't scroll off-screen mid-interaction.

**Long nicknames/translated text:** nickname fields truncate with ellipsis at a fixed max-width + full name on tap/long-press tooltip; layouts use `flex` with `min-width: 0` throughout to prevent overflow breaking cards; never rely on fixed pixel widths for any text-bearing element.

**Evidence image adaptation:** all photo thumbnails use `object-fit: cover` inside fixed-aspect containers (1:1) to avoid awkward crops varying by device orientation; full viewer always shows uncropped `object-fit: contain`.

**Avoiding accidental destructive actions:** every destructive action (kill, flag, eject vote, leave room) requires a second confirmation step and is never the first/only button in its visual group; destructive buttons use `state.danger` color exclusively (never reused for anything non-destructive) so color alone becomes a reliable warning signal.

---

## 10. Motion & Animation System

General rule: **transform + opacity only** for performance; color and blur used sparingly; no particle effects (expensive, and reads as "trying too hard").

| Moment                  | Behavior                                                                                                    | Duration                      | Easing      | Technique                           | Reduced-motion fallback                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------- | ----------------------------------- | ------------------------------------------ |
| Page/phase transition   | Hard-cut with 80ms cross-fade, not a slide                                                                  | 80ms                          | linear      | opacity                             | Instant cut, no fade                       |
| Room creation           | Code characters "stamp in" one by one                                                                       | 400ms total                   | ease-out    | opacity+transform (y+4px)           | Instant appearance                         |
| Player joins            | New roster row slides in from bottom + brief highlight background pulse                                     | 250ms                         | ease-out    | transform+background-color          | Instant appearance, no pulse               |
| Player leaves           | Row fades + collapses height                                                                                | 200ms                         | ease-in     | opacity+height                      | Instant removal                            |
| Host transfer           | Host badge "moves" via a short crossfade between avatars, toast confirms                                    | 300ms                         | ease-in-out | opacity                             | Toast only, no badge animation             |
| Countdown to start      | Large numeral scale-pulse each second (102%→100%)                                                           | 150ms/tick                    | ease-out    | transform scale                     | Numeral changes with no scale              |
| Private role reveal     | Press-hold fills a radial mask revealing the card beneath                                                   | tied to hold gesture (~600ms) | linear      | clip-path/mask                      | Tap-to-reveal instantly, no mask animation |
| Phase change            | Phase Bar background hard-cuts to new phase color + label swaps                                             | 100ms                         | linear      | background-color                    | Instant swap                               |
| Task completion         | Checkbox fills + card border briefly flashes `state.success` then settles                                   | 200ms                         | ease-out    | color+transform                     | Instant checkmark, no flash                |
| Photo upload/processing | Determinate progress bar; processing = slow 1px-wide scan line, not a spinner                               | continuous, capped 2s loop    | linear      | transform (translateX)              | Static "Processing…" label                 |
| Evidence flagging       | Flag icon fills + tiny 4px bump                                                                             | 150ms                         | ease-out    | transform scale                     | Icon state change only                     |
| Elimination             | Screen briefly desaturates (200ms), target avatar gets a single downward "struck" line-draw                 | 500ms                         | ease-in-out | filter(grayscale)+stroke-dashoffset | Instant grayscale + static line            |
| Meeting alert           | Full-screen phase-color wipe in from top, 1 short haptic/sound pulse if enabled                             | 350ms                         | ease-out    | transform (scaleY)                  | Instant color swap, no wipe                |
| Voting                  | Selected player card gets a solid border + subtle scale (101%)                                              | 100ms                         | ease-out    | transform+border-color              | Border change only                         |
| Vote-result reveal      | Aggregate tally counts up, then the ejected/no-ejection result stamps into place; roles stay private        | 700ms total                   | ease-in-out | transform+text content              | Final totals and result shown directly     |
| Victory/defeat          | Result banner rises from bottom, settles; no confetti/particles — a single accent-colored bar sweep instead | 400ms                         | ease-out    | transform translateY                | Instant static banner                      |
| Reconnection restored   | Top banner shrinks/fades out after success                                                                  | 250ms                         | ease-in     | opacity+height                      | Instant removal                            |
| Toasts                  | Slide up from bottom, auto-dismiss                                                                          | 200ms in / 150ms out          | ease-out    | transform+opacity                   | Instant show/hide                          |
| Dialogs/drawers/sheets  | Slide up (mobile) or fade+scale (desktop)                                                                   | 220ms                         | ease-out    | transform/opacity+scale             | Instant show, no slide/scale               |
| Validation errors       | Field border color-shifts + 2px horizontal shake (single cycle)                                             | 200ms                         | ease-in-out | border-color+transform              | Border color change only, no shake         |

`prefers-reduced-motion` disables all transform-based motion globally and falls back to the listed alternative — never just "make it faster," genuinely remove the movement.

---

## 11. Component Inventory

- **Button** — primary (filled amber), secondary (outline), tertiary (text-only), destructive (filled `state.danger`); states: default/hover(desktop only)/active/disabled/loading (inline spinner replaces label, width doesn't jump).
- **Icon button** — 44×44 min hit area, used for camera trigger, flag, roster toggle.
- **Text input** — room-code variant (6 boxed characters, auto-advance, auto-uppercase), nickname variant (max-length counter at 80% capacity).
- **Task card** — icon, title, status chip (todo/pending/accepted/rejected), tap target = full card.
- **Role card** — sealed/revealed states, role icon, one-line responsibility text.
- **Player avatar/identity token** — generated flat-color monogram (no photo uploads of faces required), consistent per player for the session.
- **Player roster item** — avatar, nickname, presence dot (green/gray/pulsing amber for reconnecting), host crown icon, ghost styling for eliminated.
- **Host badge** — small crown icon chip, always paired with the host's roster item.
- **Presence indicator** — 3 states: connected (solid green dot), reconnecting (pulsing amber dot), disconnected (hollow gray dot).
- **Phase indicator (Phase Bar)** — persistent top bar, background = phase color, label + optional icon, replaces traditional nav entirely.
- **Timer** — large tabular numerals, color shifts to `state.warning` under 25% remaining, no red-flash panic state (keeps product "composed").
- **Progress display** — linear determinate bar for uploads; step-dot indicator for multi-step flows (e.g., onboarding acknowledgement).
- **Evidence card** — thumbnail (1:1), player nickname, task label, flag icon overlay.
- **Photo viewer** — full-screen, swipe navigation, pinch-zoom, flag control.
- **Upload component** — camera trigger + preview + progress states as specified in §8.
- **Voting option** — large player tile, selected-state border, disabled state once vote submitted.
- **Result chart/tally display** — simple horizontal bar tally per player, count-up animation, no pie charts (harder to read fast).
- **Modal** — desktop-centered, used sparingly (mostly for admin).
- **Bottom sheet** — primary pattern on mobile for task detail, host settings, confirmations.
- **Drawer** — roster/evidence side access on tablet/desktop.
- **Popover/tooltip** — used for truncated nickname reveal, admin form hints.
- **Toast** — transient system messages ("Meeting ended," "Reconnected").
- **Alert/banner** — persistent, non-blocking (reconnecting), or full-screen blocking (meeting announcement).
- **Skeleton/loading indicators** — shape-matched placeholders for roster/task list, never a generic centered spinner on data-bearing screens.
- **Offline/reconnecting banner** — top-pinned, amber, auto-hides on recovery.
- **Empty state** — icon + one-line message + single CTA, reused for "no packs," "room ended," "no evidence yet."
- **Error state** — same shell as empty state, `state.danger` accent, always includes a retry action where retry is meaningful.
- **Confirmation control** — two-step pattern (tap → sheet with explicit action-named button, e.g., "Eliminate Player," never a bare "Yes/No").
- **Admin table** — sortable columns, row actions on hover(desktop)/tap(mobile mapped to a kebab menu), pagination.
- **Admin filters/forms** — standard labeled inputs, inline validation, sticky save bar on long forms.
- **Task-item editor** — ordered description fields with active toggles, add/remove/reorder controls, validation, and the published-pack item-count rule.

---

## 12. UX Copy Examples

- **Landing hero:** "Everyone's watching. Someone's lying." / "A live social deduction game for your next hangout — no app download, no accounts, just a room code."
- **Create action:** "Start a Room" · Join action: "Join with a Code"
- **Privacy/photo notice:** "Photos are visible only to your room and deleted automatically after the game. No one outside this room ever sees them."
- **Role reveal (crew):** "You're Crew. Complete your tasks. Watch everyone."
- **Role reveal (imposter):** "You're the Imposter. Blend in. Eliminate quietly."
- **Crew instructions:** "Finish every task on your list. Upload proof as you go — it's how the room trusts you."
- **Imposter instructions:** "Your tasks are fake — do them anyway to look busy. Eliminate players when no one's watching."
- **Upload guidance:** "Get the whole task in frame. Clear photos get accepted faster."
- **Flag confirmation:** "Flag this photo for the room to discuss? This can't be undone."
- **Meeting announcement:** "A player was eliminated. Everyone, gather." For deadline-triggered meetings: "Time's up. Meeting called."
- **Voting guidance:** "Vote to eject the player you trust least. You can skip if you're not sure."
- **Victory (crew):** "Crew wins. Every imposter has been found."
- **Victory (imposter):** "Imposters win. The room never caught on."
- **Reconnection:** "Reconnecting you to the room…"
- **Errors/retry:** "That didn't go through. Try again?"

Tone rule: short sentences, no exclamation-point stacking, dry rather than cutesy — the product should sound like a confident narrator, not a mascot.

---

## 13. Accessibility

- **Contrast:** all text/background pairs verified at WCAG AA (4.5:1 body, 3:1 large text); phase colors chosen to retain sufficient contrast against `text.primary` at all times.
- **Keyboard navigation:** full tab order through every flow (relevant mainly for admin + marketing; gameplay is touch-first but must remain keyboard-operable for testing/accessibility compliance).
- **Visible focus:** 2px amber focus ring, never suppressed, visible in dark theme by design (light color against dark surfaces).
- **Screen readers/live regions:** phase changes, meeting announcements, and vote results are announced via `aria-live="polite"` (or `"assertive"` only for meeting call, since it's time-critical); role reveal is explicitly _not_ auto-announced (privacy).
- **Timer accessibility:** countdowns are supplemented with a non-visual periodic cue (e.g., announced at 30s/10s remaining) rather than relying on color/motion alone.
- **No color-only communication:** every state (accepted/rejected/pending, connected/reconnecting) pairs color with an icon or text label.
- **Reduced motion:** full fallback table in §10 honored via `prefers-reduced-motion`.
- **Text scaling:** layouts tested up to 200% browser zoom without truncation breaking functionality (nicknames handle this via the truncate+tooltip pattern).
- **Camera/upload alternatives:** file-picker fallback always available alongside the native camera trigger, for devices/browsers without camera API access.
- **Form errors:** inline, associated via `aria-describedby`, never conveyed by color/border alone.
- **Destructive-action confirmation:** every irreversible action requires an explicit, clearly labeled confirm step (see §11 Confirmation control).
- **Privacy during role reveal:** press-and-hold or explicit tap-to-reveal only, auto-obscures on app-blur/backgrounding, no auto-play of role audio.
- **Color-vision deficiency support:** phase colors chosen to remain distinguishable under common CVD simulations (deuteranopia/protanopia checked); icons/text always back up color-coded state.
- **Touch accessibility during physical play:** all primary controls sit in the reachable bottom two-thirds of the screen; no reliance on hover for any function.

---

## 14. Design Risks & Solutions

| Risk                                                                                   | Solution                                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role accidentally shown to others nearby                                               | Press-and-hold reveal, auto-blur on app-blur/backgrounding, no notification preview text that could leak role                                                               |
| Active phase unclear after a glance away                                               | Persistent full-width Phase Bar with distinct color per phase, always visible, never scrolls away                                                                           |
| Accidental kills/flags/votes                                                           | Universal two-step confirm pattern for every destructive/high-stakes action                                                                                                 |
| Confusing provisional vs. accepted uploads                                             | Explicit 4-state status chip (uploading/processing/accepted/rejected) shown on every task card, not just in the upload sheet                                                |
| Realtime state changing mid-interaction (e.g., meeting starts while voting is mid-tap) | In-flight actions complete or are gracefully cancelled with a toast explanation ("Meeting started — your action was cancelled") rather than silently discarding or erroring |
| Network interruptions                                                                  | Non-blocking reconnect banner; preserve pending input, resync from an authorized snapshot, and avoid optimistic authoritative state                                         |
| Players passing phones around                                                          | Player identity token + nickname always visible in header so anyone picking up a phone mid-game immediately sees whose device it is                                         |
| Long meetings/timers dragging pace                                                     | Let the host choose supported timer lengths in the lobby; once play starts, display the authoritative deadline without an extension control                                 |
| Too much content on active-game screens                                                | Strict content budget per screen: one primary list + one primary action; secondary info (roster, evidence) always tucked behind a drawer/tab, never stacked inline          |
| Desktop-first layouts that fail on phones                                              | Gameplay shell is capped-width and centered at all breakpoints — literally the same layout scaled, not two different designs, removing the chance of divergence             |

---

## 15. Prioritized First-Screens-to-Design List

1. Phase Bar + app shell (governs every other screen)
2. Role reveal (highest-stakes, most distinctive moment)
3. Lobby (first real multi-user screen, sets tone)
4. Active task list + task detail sheet
5. Photo upload flow (capture → progress → accept/reject)
6. Meeting announcement + discussion + voting sequence
7. Vote-result reveal
8. Game-over (victory/defeat)
9. Create/Join flow
10. Landing page
11. Admin task-pack editor

---

## 16. Handoff Brief

**What this is:** Imposter Game is a mobile-first, no-account, room-based social deduction party product. Visual identity = "Night Desk" — an ink-and-amber field-dossier aesthetic (no purple/blue gradients, no glassmorphism, no glowing neon, no 3D icon packs), overlaid with a phase-based flat accent-color system (slate=lobby, gold=tasks, rust-red=meeting, green=results) so the current game phase is always legible at a glance.

**Non-negotiables for the builder:**

- Gameplay screens are dark-mode only, capped at ~480–560px width even on desktop, centered.
- Every destructive action needs a two-step confirm.
- Role reveal must never auto-display and must obscure on app-blur.
- Elevation = surface color steps + 1px top highlight, not blurred drop shadows, on mobile.
- Buttons are rounded-rectangle (6–10px radius), never full pill.
- Use the token tables in §5.3 exactly — don't introduce new ad-hoc colors.
- Motion = transform/opacity only, respects `prefers-reduced-motion` per the table in §10.
- Admin area is visually distinct (conventional dashboard chrome) from the game shell on purpose.

**Build order:** follow §15. Get the Phase Bar + shell and Role Reveal right first — everything else is a variation on the same shell.
