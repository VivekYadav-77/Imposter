# Phase 7 hardening record

**Date:** 2026-09-28
**Scope:** automated resilience, accessibility, privacy, security, media, and performance safeguards. Manual device, assistive-technology, penetration, profiling, and moderated-usability results must be added here; an unchecked item is not a pass.

## Threat model and controls

| Threat | Implemented control | Residual limitation / verification |
|---|---|---|
| Participant token theft | AES-256-GCM Android Keystore storage; ciphertext-only private preferences; backup/device-transfer excluded; no token navigation or logs | A rooted or actively compromised device can inspect process memory or input; the app does not claim protection from a hostile OS |
| Private role or ballot leakage | Capture and overlays are explicitly allowed under ADR-A-030; role reseals on pause and focus loss; DTO `toString` redaction; server-authoritative visibility remains enforced | Verify lifecycle reseal, TalkBack, task-switcher disclosure, and the owner-approved capture tradeoff on physical API 26/31/36 devices |
| Signed evidence capability leakage | Signed URLs/headers redacted; participant bearer token excluded; redirects disabled so scoped headers cannot cross origins | Storage-provider headers remain governed by the frozen upload-intent contract and are sent exactly as authorized |
| Replayed/double commands | Stable idempotency keys, identical retry bodies, synchronous single-flight command guards, no `409` replay, stale game snapshots rejected by state version | Multi-device staging race suite remains required |
| Malicious server text | Control/bidirectional characters removed, whitespace normalized, text bounded before display; raw error details withheld | Exercise representative Unicode and accessibility output on device |
| Malicious images/decode exhaustion | HTTPS-only fetch, image MIME allowlist, 5 MiB transfer cap, dimension/pixel caps, source file/dimension caps, sampled decode, metadata-free re-encode | Fuzzed image corpus and low-memory physical-device profiling remain required |
| Clipboard exposure | Room-code clip marked sensitive and cleared after 60 seconds only if the user has not replaced it | OEM clipboard behavior varies; room sharing remains an explicit user action |
| Backup extraction | `allowBackup=false`, legacy backup disabled, every data-extraction domain excluded | Validate installed release manifest and `bmgr` behavior on a release device |
| Tapjacking/overlay | Ordinary overlays are explicitly allowed under ADR-A-030; destructive actions retain selection and confirmation steps | Document the accepted overlay risk and verify confirmations cannot be bypassed |
| Cleartext/downgrade | Manifest/network-security cleartext prohibition; clients accept HTTPS except explicit localhost debug mode; signed uploads and images require HTTPS | Release artifact inspection and TLS interception test remain required |

Temporary evidence is kept in memory. Scoped camera files are deleted after use/cancellation and captures older than one hour are purged whenever the processor starts or creates a capture. Leaving the foreground cancels transfer work and drops displayed image bytes. No durable evidence upload queue or image disk cache exists.

## Engineering budgets

These are v1 acceptance budgets, not measurements. Record median/P95 and device details before Phase 7 exits.

| Area | Budget | Current enforceable bound / status |
|---|---|---|
| Warm interactive startup | median ≤ 1.0 s, P95 ≤ 2.0 s | Not measured |
| Cold interactive startup | median ≤ 2.0 s, P95 ≤ 3.5 s | Not measured |
| Frame time | ≥ 95% frames under 16.7 ms during ordinary navigation; no frozen frames | Not measured |
| Steady lobby/game memory | ≤ 160 MiB PSS on representative 4 GiB device | Not measured |
| Evidence processing peak | ≤ 220 MiB PSS; no OOM for accepted input | Source 20 MiB, input 80 MP/16,384 px, output 2,048 px/5 MiB; not profiled |
| Upload | one active upload; 5 MiB maximum; no background transfer | Enforced in source |
| API response | normal response ≤ 2 MiB; error response ≤ 64 KiB | Enforced in source |
| Reconnect | randomized exponential delay, 0.5–10 s cap, cancellable | Host-tested; battery profiling pending |
| Poll fallback | no faster than every 5 s while relevant UI is active | Enforced in current ViewModels; realtime wiring still pending |

Per-second timer state currently updates the gameplay `UiState`; unrelated-tree recomposition must be measured and, if observed, split into a dedicated countdown state before exit. No decorative animation or sound is currently used. Haptic feedback is supplemental and delegates to system accessibility/user settings.

## Lifecycle and network matrix

Run on API 26, 31, and 36; compact portrait, compact-height landscape, expanded/tablet, and one resizable/foldable configuration.

- [ ] Rotate/resize every screen, dialog, sheet, keyboard state, and confirmation.
- [ ] Background/foreground before, during, and after every mutation.
- [ ] Process death in lobby, sealed role, revealed role, evidence preparation/upload, local vote selection, accepted vote, meeting result, and final result.
- [ ] Airplane mode, DNS failure, captive portal, 2G-like throttling, socket flapping, server restart, `429 Retry-After`, and ±10-minute device clock skew.
- [ ] Confirm safe cached content stays readable with Offline/Reconnecting status and all authoritative mutations revalidate current server state.
- [ ] Confirm a retried/racing command produces one visible result and stale snapshots never replace newer game state.

## Accessibility matrix

- [ ] TalkBack traversal and action labels for every journey; no role/ballot exposed outside its authorized pane.
- [ ] Switch Access and hardware keyboard: logical order, visible focus, activation, dialog escape, no gesture-only action.
- [ ] Font scale 2.0 and largest display size: no clipped essential content in portrait or compact-height landscape.
- [ ] Light/dark, grayscale, protan/deutan/tritan simulation, disabled/loading contrast, and non-color identity review.
- [ ] Animator scale 0, sound off, haptic off.
- [ ] Countdown announcements occur only at minute/under-one-minute/expiry boundaries; visual seconds may continue.
- [ ] Press-and-hold role reveal and the explicit accessible reveal button both work and reseal.
- [ ] English pluralization/timer/error/color-name audit. Additional locale scope remains a release decision.

## Usability and external review

No moderated group study, dependency vulnerability/license scan, or independent security review was performed in this source-only pass. Record participants without personal data and file ranked defects with severity, reproduction, affected journey, decision, and regression evidence. Phase 7 cannot exit until all blocker/critical accessibility defects and critical/high security or privacy defects are resolved and required v1 usability findings are regression-covered.
