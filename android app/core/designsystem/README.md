# Android design system

`core:designsystem` owns the reusable visual, adaptive-layout, privacy, and accessibility primitives for the Android client. Feature modules may consume these APIs but must not redefine player colors, copy the crewmate path, or depend on legacy animal labels.

## Public foundations

- `ImposterGameTheme`: semantic light, dark, and high-contrast themes plus accessibility preferences.
- `GameSpacing`, `GameShapes`, `GameElevation`, `GameMotion`, and `GameTouchTarget`: centralized layout and interaction tokens.
- `PlayerColors`: the only legacy transport-ID-to-neutral-color mapping.
- `PlayerAvatar`: the canonical crewmate geometry with selection and status decoration.
- `AdaptiveGameScaffold`: available-bounds-driven one/two-pane composition with safe-area, IME, bottom-action, and vertical-hinge handling.
- `ComponentCatalog`: preview harness for supported widths, heights, font scales, themes, and layout direction.

## Usage rules

1. Pair every player color/avatar with nickname and neutral color text in identification contexts.
2. Never show the legacy transport ID to a player or accessibility service.
3. Use `GameButton` variants for a consistent 48dp target and loading behavior.
4. Private role content must reseal on lifecycle loss. Screenshot, screen-recording, recent-task,
   and overlay blocking are intentionally not applied in any build type under ADR-A-030.
5. Treat countdown text as ordinary semantics, never a live region that announces every tick.
6. Pass actual hinge occlusion width into `AdaptiveGameScaffold`; never infer layout from a device name or orientation string.
7. Keep business state outside this module. Catalog data is preview-only and contains no gameplay rules.

## Verification

Host-side tests cover stable slot mapping, canonical vector geometry, palette contrast, color-vision transformations, and adaptive breakpoints. Instrumented tests cover minimum targets, avatar semantics, and rendered compact portrait/landscape captures.
