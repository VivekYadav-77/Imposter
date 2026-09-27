# Phase 2 — design system, adaptive shell, and avatar system

## Goal

Create the reusable visual and interaction language before feature screens, with accessibility and orientation behavior proven in isolation.

## Design foundations

- Define semantic color roles for surfaces, content, accent, success, warning, danger, outline, focus, and scrims.
- Support dark and light themes; dark may be the brand default, but system/user preference must be respected unless product explicitly decides otherwise.
- Define display and body typography with tested large-font behavior.
- Define spacing, shape, elevation, icon, motion, haptic, and sound tokens.
- Use platform icons or original Android assets; do not copy the web avatar or decorative artwork.
- Respect edge-to-edge system bars, cutouts, gesture navigation, IME, and foldable hinges.

## Canonical avatar component

- Implement the exact path geometry documented in `master-plan.md` as a tintable vector.
- Create one `PlayerAvatar` API receiving transport ID/color slot, size, optional status badge, content description, and selected state.
- Define a centralized legacy-ID-to-color mapping; never scatter color hex values through features.
- Provide neutral localized color names for accessibility.
- Render avatar plus nickname in all identification contexts.
- Provide non-color selected, disconnected, dead, ejected, host, and self indicators.
- Test every supported slot on light/dark surfaces and under common color-vision simulations.

## Reusable components

- Game top bar with phase, timer, identity, and connection state.
- Primary, secondary, destructive, and icon buttons with loading states.
- Player row/card and selectable player card.
- Task card and upload-state indicator.
- Status banner, inline validation, snackbar, and persistent blocking error.
- Confirmation dialog, modal bottom sheet, full-screen sensitive surface.
- Countdown semantics that do not announce every second to TalkBack.
- Empty, loading, retry, offline, and session-ended states.
- Compact bottom action bar and expanded supporting rail.

## Adaptive reference compositions

Create preview/test harnesses for:

- compact portrait phone;
- compact-height landscape phone;
- medium-width foldable/tablet;
- expanded tablet;
- display cutout and hinge cases;
- 100%, 150%, and 200% font scale;
- left-to-right and right-to-left layouts if RTL is in the approved locale scope.

Landscape rules:

- Lists and details become two panes only when both remain usable.
- Keep primary confirmation visible, but never overlay it on essential content.
- Constrain line length and card width; do not stretch portrait layouts.
- Preserve state and scroll positions when window size changes.

## Accessibility verification

- 48dp minimum target and adequate spacing between destructive/normal actions.
- WCAG-aligned contrast review for text and meaningful graphics.
- Deterministic focus order and visible focus indicators.
- Useful TalkBack role, state, value, and action descriptions.
- No color-, sound-, or motion-only information.
- Reduced motion and sound/haptic preferences honored.

## Exit criteria

- Component catalog/previews cover all states and window classes.
- Screenshot/golden tests exist for key components in portrait and landscape.
- The canonical avatar is visually identical in geometry for all players and differs only by approved color/status decoration.
- Accessibility checks find no known blocker in foundational components.
