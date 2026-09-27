# Phase 7 — resilience, accessibility, privacy, and security hardening

## Goal

Turn feature-complete behavior into a trustworthy mobile experience under real devices, unreliable networks, assistive technology, and hostile inputs.

## Lifecycle and network resilience

- Test rotation/window resize at every screen and dialog.
- Test background/foreground before, during, and after every command.
- Test process death with lobby, role sealed/revealed, upload, vote selection, and result states.
- Test airplane mode, captive/slow network, socket flapping, server restart, and clock skew.
- Restore from the server whenever authority matters; do not restore stale secrets from generic saved state.
- Provide calm offline/reconnecting status without blocking already-readable safe content.
- Ensure only one command result is applied after retry/race conditions.

## Accessibility audit

- Manual TalkBack traversal of every user journey.
- Switch Access/external keyboard navigation for all actions.
- 200% font scale and display-size changes without clipped essential content.
- Color-vision and grayscale review of every player color and status.
- Contrast review in light/dark themes and disabled/loading states.
- Reduced motion, sound off, and haptic off behavior.
- Avoid countdown announcement spam; announce meaningful minute/phase changes only.
- Ensure press-and-hold role reveal has an accessible alternative.
- Localize semantics, pluralization, timer formatting, error messages, and color names.

## Security and privacy review

- Threat-model token theft, role leakage, ballot leakage, signed evidence URL leakage, malicious images, replayed commands, overlay/tapjacking, rooted-device limitations, clipboard exposure, and backup extraction.
- Apply secure-window protection to approved sensitive surfaces and recent-app previews.
- Validate TLS/network security configuration and production cleartext prohibition.
- Verify secure session storage and deliberate backup rules.
- Redact all sensitive headers, request bodies, DTO fields, URLs, file paths, and image metadata.
- Sanitize server text and filenames before display/logging.
- Bound image bytes, pixels, decoding work, cache, and upload retries.
- Keep dependencies current and scan known vulnerabilities/licenses.
- Define data deletion/temporary-file cleanup behavior.

## Performance and battery

- Establish startup, frame-time, memory, upload, and reconnect budgets.
- Profile on a representative low-memory device.
- Baseline profiles for critical launch/join/task routes if measurement supports them.
- Prevent per-second timer recomposition of unrelated screen trees.
- Pause unnecessary animation/work off-screen.
- Avoid aggressive heartbeat/reconnect loops that drain battery.

## Usability validation

Run moderated tests with actual groups, including first-time players:

- Can a player join without explanation?
- Can a host understand why Start is disabled?
- Can a player reveal and reseal privately?
- Can a player submit evidence under time pressure?
- Can players distinguish all participants by nickname and color?
- Do meeting phases and ballot confirmation feel unambiguous?
- Is compact landscape usable while the keyboard/system bars are present?

Record findings as ranked defects, not informal notes.

## Exit criteria

- No critical/high security or privacy issue remains.
- No blocker/critical accessibility issue remains.
- Lifecycle/network matrix passes on supported API levels and form factors.
- Performance budgets are measured and met or explicitly approved with rationale.
- Usability findings required for v1 are fixed and regression-covered.
