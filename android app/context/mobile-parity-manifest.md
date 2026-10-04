# Mobile website parity manifest

**Website reference:** repository revision `c2edf34` (website files unchanged by the Android pass)
**Target viewports:** 320×720, 390×844, and 430×932 CSS pixels / Android logical dp
**Themes:** website light and dark
**Capture policy:** Android capture is enabled in debug, staging, and release builds under ADR-A-030.

## Visual contract

| Role | Dark | Light |
|---|---|---|
| Canvas | `#14130F` | `#F4F0E6` |
| Surface | `#1C1B16` | `#FFFDF7` |
| Raised surface | `#242219` | `#EBE4D5` |
| Text | `#EDE7D8` | `#242119` |
| Muted text | `#A69E86` | `#6B6354` |
| Border | `#3A3627` | `#C9BEA8` |
| Amber/action | `#D98E3B` | `#A6530B` |
| Lobby | `#4A6878` | `#3D6578` |
| Tasks | `#C9A227` | `#C19A1C` |
| Meeting | `#A63F2B` | `#9C3928` |
| Results | `#426D48` | `#3E7047` |
| Success | `#5C8A5C` | `#3F7448` |
| Danger text | `#E06B51` | `#982F1F` |

- Body: Public Sans Variable; display: Barlow Condensed 400/600/700/800.
- Geometry is translated at 1 CSS px = 1 dp and typography at 1 CSS px = 1 sp.
- Shared radii: 8, 10, 14, 16, 18, 22, 24, and 30dp plus pills.
- Mobile command bar: 70dp minimum; task cards: 104dp minimum; roster rows: 78dp;
  mobile action rail: 70dp; touch targets: at least 48dp.
- Motion easing: `cubic-bezier(0.16, 1, 0.3, 1)` with 120, 200, 420, 440, 480,
  and 560ms roles and a 45ms task-card stagger.

## State and navigation matrix

| Group | Required states | Back/dismiss behavior |
|---|---|---|
| Account choice | Continue with Google, Play as guest, cancellation, no account, network error | Dismiss returns Home; guest continues the original create/join intent |
| Dashboard | loading, empty/populated statistics, linked/rejoinable rooms, recent results, retry/offline | Home dismisses dashboard; rejoin stores participant authority before lobby/game routing |
| History | empty, pagination, detail, private/public vote disclosure, error | Detail returns History; server-returned visibility is authoritative |
| Account settings | profile validation, 18 operatives, devices, revoke, sign out, delete reauthentication | Destructive actions require confirmation; account actions never leave an active participant seat |
| Create/join | mode choice, room lookup, nickname, operative picker, consent, loading, validation, conflict, error | Picker closes first; screen returns Home |
| Lobby | host/participant, invite, readiness, roster, settings, saving/saved/invalid, reconnect, start blocked, leave confirmation | Confirmation closes first; leaving requires explicit confirmation |
| Role | sealed, revealed, acknowledged, lifecycle reseal | Back reseals and offers safe minimization |
| Tasks/status | loading, active/completed tasks, proof action, progress, eliminated state, meeting availability | Transient task/status surfaces close before active-game handling |
| Evidence | empty, gallery, preparing, upload, processing, retry/failure, preview, flag confirmation | Preview/confirmation closes first; Evidence returns to Tasks |
| Elimination | unavailable/cooldown, target selection, confirmation, submitting, result/error | Confirmation then picker close before active-game handling |
| Meeting/voting | alert, discussion, review, ballot selection, locked/private/public/observer, outcome | Alert/confirmation closes before active-game handling |
| Results | winner/abandoned, collapsed/expanded details, evidence, replay, error | Back returns Home; replay accepts only the authoritative room response |
| Guest upgrade | non-blocking Save this case, Google cancellation/error/success | Results, replay, and leave remain available throughout; success claims the current participant |

## Capture and comparison references

- Website references are generated from `/play`, `/room`, and deterministic `/dev/showcase`
  fixtures without modifying website source.
- Current device captures are written to the repository-local ignored directory
  `.playwright-results/` so real room codes, nicknames, roles, or evidence are never committed.
- Comparison masks are limited to Android status/navigation bars, font antialiasing, and native
  photo-picker content. Speaker and haptic hardware are assessed separately.
- Captures must be taken in both themes at each target viewport before a parity state is marked
  verified. Private test data must be synthetic.

## Platform-only differences

- Android system status/navigation bars and font rasterization.
- Android system photo picker.
- Device speaker frequency response and haptic motor response.
- Role content still reseals on focus/lifecycle loss, even though screenshots and recording are
  allowed.
