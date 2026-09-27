# Android decision log

Use IDs `ADR-A-###`. Status is `proposed`, `approved`, `superseded`, or `rejected`. An agent may implement only approved decisions that affect behavior or architecture.

## Approved baseline decisions

### ADR-A-001 — Native client stack

- **Status:** approved by product request
- **Date:** 2026-09-27
- **Decision:** Build a native Android application in Kotlin. The plan targets Jetpack Compose and a single-activity adaptive UI.
- **Reason:** The requested client is native Android and must support portrait and landscape consistently.

### ADR-A-002 — Canonical avatar appearance

- **Status:** approved by product request
- **Date:** 2026-09-27
- **Decision:** Every player uses the same supplied crewmate SVG silhouette. Player identity is differentiated by a unique room color, nickname, and non-color status indicators. Website animal avatar artwork is not an Android reference.
- **Compatibility:** API v1 legacy `avatarId` values may be used internally as stable color-slot identifiers but their animal names/art are never shown.

### ADR-A-003 — Server authority

- **Status:** approved as existing contract constraint
- **Date:** 2026-09-27
- **Decision:** HTTP commands and complete participant-specific server snapshots are authoritative. Android does not calculate hidden state, winner, eligibility, or phase transitions.

### ADR-A-004 — Orientation strategy

- **Status:** approved planning baseline
- **Date:** 2026-09-27
- **Decision:** Support portrait and landscape using adaptive available-width/height layouts. Do not create separate state owners per orientation and do not force portrait globally.

## Proposed decisions requiring product/technical approval

### ADR-A-005 — Player capacity

- **Status:** proposed
- **Decision needed:** Select authoritative minimum/maximum capacity and whether the host can configure bounds.
- **Conflict:** current docs and web behavior disagree.

### ADR-A-006 — Player-called emergency meetings

- **Status:** proposed
- **Decision needed:** Enable according to current capability/cooldown APIs, or remove from the supported product and contract.
- **Conflict:** How-to-play text disagrees with current API/UI support.

### ADR-A-007 — Ejection ballot replacement

- **Status:** proposed
- **Decision needed:** Allow replacement until voting locks, or permanently lock first accepted confirmation.
- **Conflict:** API documentation and current UI copy disagree.

### ADR-A-008 — Same-room replay

- **Status:** proposed
- **Decision needed:** Confirm replay endpoint semantics and whether Android v1 exposes it.

### ADR-A-009 — Account scope

- **Status:** proposed
- **Recommendation:** Ship guest gameplay first; add Google/account history only if native OAuth/token exchange and result ownership are fully contracted.

### ADR-A-010 — Player color palette and wire mapping

- **Status:** approved
- **Date:** 2026-09-27
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Preserve all 18 API v1 legacy `avatarId` values as internal transport identifiers and map them in contract order to Coral, Gold, Blue, Violet, Teal, Green, Bronze, Rose, Indigo, Cyan, Red, Lime, Amber, Magenta, Purple, Slate, Orange, and Sea green. Use separate light/dark rendering colors, a contrasting outline, nickname, and localized neutral color label.
- **Reason:** The mapping covers every server-supported identifier and remains compatible with the current maximum room capacity of 15 without exposing animal identities. Automated contrast checks require at least 4.5:1 against the intended theme background, and color-vision transformations verify the slots remain mechanically distinct; text/status decoration remains authoritative for accessibility.
- **Consequences:** This mapping is stable for API v1 and must not be reordered. New transport IDs require an explicit mapping and test update. Backend uniqueness at room capacity remains server-authoritative.

### ADR-A-011 — Push notifications

- **Status:** proposed
- **Recommendation:** No push notifications in v1 unless the backend gains an explicit safe push contract. Use in-app realtime alerts only.

### ADR-A-012 — Android support baseline

- **Status:** approved for the technical foundation; product distribution details remain open
- **Date:** 2026-09-27
- **Approver:** product owner delegated best-fit technical choices
- **Decision:** Use minimum SDK 26 and compile/target SDK 36. Build one adaptive phone/tablet/foldable application without forced orientation. English is the initial source locale; translated locales and release regions remain product-release decisions.
- **Reason:** API 36 satisfies the August 2026 Google Play target requirement, API 26 provides a practical background-execution/security baseline, and the adaptive device policy follows the approved master plan.
- **Consequences:** New platform APIs require compatibility handling down to API 26. Release-region and localization scope must be approved before store launch but do not block the foundation.

### ADR-A-013 — Phase 1 build toolchain

- **Status:** approved
- **Date:** 2026-09-27
- **Approver:** product owner delegated best-fit technical choices
- **Decision:** Pin AGP 9.4.0, Gradle 9.6.0, Kotlin/Compose compiler 2.4.20, stable Compose BOM 2026.09.00, Java 17 toolchains, and deterministic Spotless formatting. Use AGP 9 built-in Kotlin rather than the obsolete Kotlin Android plugin.
- **Reason:** These are mutually compatible stable releases documented by Android, Kotlin, and Gradle at implementation time.
- **Consequences:** Gradle may provision JDK 17 through the pinned Foojay resolver. Developers still need the licensed Android SDK Platform 36 and Build Tools 36.0.0.

### ADR-A-014 — Design-system and adaptive-layout ownership

- **Status:** approved
- **Date:** 2026-09-27
- **Approver:** product owner delegated best-fit technical choices
- **Decision:** Place theme tokens, player identity visuals, foundational components, preview catalog, and available-bounds layout policy in `core:designsystem`. Classify compact below 600dp, medium from 600dp, and expanded from 840dp; allow compact-height medium windows to use two panes and accept actual hinge occlusion as an explicit input.
- **Reason:** Central ownership prevents feature drift, while available bounds and hinge data support phones, resizing, tablets, and foldables without orientation/device-name branches.
- **Consequences:** Features consume design-system APIs rather than defining independent colors or breakpoints. Platform folding-feature observation will feed the existing hinge seam when the application shell gains lifecycle integration.

## Adding a decision

Copy this structure:

```text
### ADR-A-### — Short title

- Status:
- Date:
- Approver:
- Decision:
- Reason:
- Consequences:
- Supersedes: (optional)
```
