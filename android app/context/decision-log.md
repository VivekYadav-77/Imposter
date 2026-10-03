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

### ADR-A-015 — Phase 3 client-core ownership and credential protection

- **Status:** approved
- **Date:** 2026-09-27
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Keep API v1 DTOs, safe HTTP policy, participant-session contracts, authoritative snapshot repositories, Socket.IO session coordination, and bootstrap routing in a UI-independent JVM `core:data` module, with the Android Keystore implementation isolated in `core:session`. Use AES-256-GCM with a non-exportable Android Keystore key, store only ciphertext/IV/expiry in non-backed-up private preferences, and fail closed after key invalidation or corrupt storage. Keep mutation idempotency keys on immutable command instances and make conflict handling explicit rather than globally retrying requests.
- **Reason:** These concerns share the authenticated application-session lifecycle and must be testable without a composable or feature screen. A single core boundary avoids leaking transport DTOs or bearer credentials into navigation/saved state while preserving command-specific retry semantics from the frozen contract.
- **Consequences:** Feature modules observe repositories and bootstrap destinations instead of owning sockets or cached gameplay state. `409` responses require refresh/user confirmation, revocation clears all sensitive state and stops reconnection, and future persistence must not cache private role/evidence snapshots.

### ADR-A-016 — Lobby settings commit behavior

- **Status:** approved by Phase 4 implementation request
- **Date:** 2026-09-28
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Host lobby settings use an explicit Apply action. While an entry or settings command is active, duplicate submission and background room polling are suppressed; conflicts refresh the authoritative room before another user decision.
- **Reason:** A visible commit boundary makes several related room rules understandable, avoids partially applied setup, and prevents delayed polling or mutation responses from replacing newer state.
- **Consequences:** Draft settings remain local until Apply succeeds. A failed or conflicting Apply preserves the draft and presents the server-safe error; realtime or polling snapshots replace only committed room state.

### ADR-A-017 — Foreground-only evidence pipeline

- **Status:** approved by Phase 5 implementation request
- **Date:** 2026-09-28
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Evidence preparation, upload-intent creation, signed PUT, confirmation, and initial refresh run only while the app is in the foreground. Leaving the foreground cancels active work and presents an explicit retry state using the same command identity. Selected images are bounded, orientation-normalized, flattened, and re-encoded as metadata-free JPEGs in memory; camera captures use scoped cache files with deterministic cancellation and expiry cleanup.
- **Reason:** The current product has no approved background-upload notification, worker policy, or durable encrypted evidence queue. Foreground-only execution avoids false success, hidden data transfer, and persistence of evidence or signed storage capabilities.
- **Consequences:** Players must keep the app open during upload. Process death loses the prepared preview and safely returns through bootstrap/role sealing; it never marks a task complete locally. A future background worker requires a separate privacy, notification, retry, and storage decision.

### ADR-A-018 — Conservative meeting ballot lock and privacy rendering

- **Status:** approved by Phase 6 implementation request
- **Date:** 2026-09-28
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Review and ejection selections remain local and reversible until explicit confirmation. After the first accepted response, Android locks the choice and follows the authoritative snapshot. A `409` closes the pending confirmation and refreshes. Private meetings show participation counts only; individual ballots render only from server-returned public fields. Countdown expiry disables commands and requests fresh state without resolving the meeting locally.
- **Reason:** ADR-A-007 remains unresolved, while Phase 6 explicitly specifies lock-after-acceptance as the safe fallback and the current ejection service rejects replacement. This policy neither invents ballot mutability nor exposes hidden choices.
- **Consequences:** Android cannot replace an accepted ballot even if a future backend permits it until ADR-A-007 is approved and the client behavior is revised. Replay and account prompts remain absent under ADR-A-008 and ADR-A-009.

### ADR-A-019 — Phase 7 secure-surface and untrusted-input policy

- **Status:** approved by Phase 7 implementation request
- **Date:** 2026-09-28
- **Approver:** product owner delegated best-fit product and technical choices
- **Decision:** Treat every gameplay destination as sensitive, applying screenshot/recent-app protection and API 31+ overlay hiding. Keep lobby sharing explicit while marking copied room codes sensitive and clearing an unchanged clip after 60 seconds. Bound API bodies, server display text, image bytes/dimensions/pixels, and signed upload behavior; redact private DTO string representations. Preserve readable authoritative content while polling reconnects and reject stale game snapshots by state version.
- **Reason:** Role, ballot, evidence capability, and session leakage can occur outside ordinary HTTP logging, while hostile text/images and retry races can exhaust resources or mislead players. A single conservative policy is easier to audit across every gameplay phase.
- **Consequences:** Screenshots and ordinary overlays are unavailable throughout active gameplay. Server error details are not rendered directly. Oversized or unsupported responses/images fail closed. Rooted-device compromise and OEM clipboard/task-switcher behavior remain documented platform limitations requiring device review.

### ADR-A-020 — External signing, environment separation, and privacy-safe operations

- **Status:** approved by Phase 8 implementation request
- **Date:** 2026-09-28
- **Approver:** product owner delegated best-fit technical choices; final app identity, service vendors, and store policy remain owner decisions
- **Decision:** Inject debug, staging, and production origins separately; require HTTPS for staging/release; inject semantic version/version code; and sign release candidates only with credentials outside the repository. CI verifies a shrunk signed bundle with a disposable key, while the protected manual workflow uses production secrets and retains the AAB/R8 mapping. Operational events and crash breadcrumbs use fixed metric/outcome enums only; consent-gated support diagnostics expose only version, environment, coarse network state, and bounded request IDs.
- **Reason:** The release pipeline must be reproducible without committing keys, and observability must diagnose availability without creating a new path for role, ballot, evidence, participant, or credential leakage.
- **Consequences:** Release tasks fail closed when endpoint/signing/version inputs are invalid. Vendor SDK selection, data residency/retention, dashboards, Play Console approvals, final application ID, and signing-key recovery require explicit owner approval before production rollout.

### ADR-A-021 — Compose BOM compatible with the API 36 compile baseline

- **Status:** approved by local-device verification
- **Date:** 2026-09-28
- **Approver:** product owner delegated local Android environment setup and testing
- **Decision:** While the approved compile/target baseline remains API 36, pin the stable Compose BOM to `2026.06.01` (Compose UI/Foundation 1.11.4), AndroidX Core to `1.17.0`, and Lifecycle to `2.10.0`. Do not consume Compose 1.12.x, Core 1.19.x, or Lifecycle 2.11.x until the application deliberately adopts compile SDK 37 or later.
- **Reason:** The newer dependency set requires compile SDK 37 in published AAR metadata. The mismatch prevents Android compilation before application Kotlin sources are evaluated; Core 1.18 also requires API 36.1 rather than the approved API 36 baseline.
- **Consequences:** API 36 builds remain reproducible and compatible with ADR-A-012. A future compile SDK upgrade must reevaluate and explicitly update the BOM.
- **Supersedes:** The Compose BOM version only in ADR-A-013; all other Phase 1 toolchain pins remain unchanged.

### ADR-A-022 — Recoverable bootstrap and connected-device release gate

- **Status:** approved by QA remediation implementation
- **Date:** 2026-09-28
- **Approver:** product owner requested full implementation of `improvementApp1.md`
- **Decision:** Preserve failed bootstrap as an explicit recoverable UI state with a guarded manual retry and bounded automatic backoff. Keep connected instrumentation outside the host-only `quality` task but expose it as `connectedQuality` and require it in a dedicated CI emulator job. Device tests use stable behavior/semantics rather than presentation pixels and a lock-screen-safe test activity.
- **Reason:** Transport loss must not strand a resumable credential, and a passing host-only quality task must not hide broken app/device integration. Pixel sampling was not a meaningful visual assertion and physical devices can pause ordinary test activities while locked.
- **Consequences:** CI now provisions an API 35 emulator for connected tests; local physical-device runs should keep the device awake. Full API 26/31/36 and multi-client acceptance remain separate Phase 8 gates.

### ADR-A-023 — Same-origin relative evidence upload instructions

- **Status:** approved by physical-device contract verification
- **Date:** 2026-09-28
- **Approver:** product owner requested complete implementation of `improvementApp1.md`
- **Decision:** Resolve a relative evidence upload URL against the already validated API origin. Keep absolute upload URLs subject to the existing HTTPS/local-debug policy, and reject protocol-relative URLs, URL credentials, fragments, or a relative resolution that changes origin.
- **Reason:** API v1 describes the field as a URI and the local object-storage implementation returns a same-origin relative path. The web client resolves that path through the browser origin, while Android previously rejected it before transfer and could never complete a task.
- **Consequences:** Android supports both same-origin relative capabilities and approved absolute HTTPS upload instructions without attaching participant authorization. Network-policy tests cover relative resolution and fail-closed protocol-relative input; the physical Acer run completed upload and confirmation.

### ADR-A-024 — Website-equivalent native brand, preferences, and feedback

- **Status:** approved by UI/UX parity implementation request
- **Date:** 2026-09-29
- **Approver:** product owner requested complete implementation of `implementationAppui/ux.md`
- **Decision:** Adapt the website's charcoal/amber visual language into semantic Compose tokens rather than copying DOM measurements. Persist only non-sensitive System/Light/Dark, sound, haptic, reduced-motion, and high-contrast preferences in private app storage. Drive phase colors and one-shot audio/haptic feedback from typed authoritative state transitions; use lifecycle-safe native tones and platform haptics until separately licensed audio assets are supplied.
- **Reason:** A shared semantic language provides recognizable parity across adaptive native layouts while retaining Android accessibility, privacy, and server authority. Typed events and stable identities prevent recomposition or reconnect from replaying feedback.
- **Consequences:** New UI must consume the design-system roles instead of hard-coded brand colors. Preferences never contain participant/session/game data. Sound and haptics remain optional and are never the only state signal. Replay, player-called meetings, and account/dashboard UI remain absent until ADR-A-008, ADR-A-006, and ADR-A-009 are approved.

### ADR-A-025 — Native signal-room presentation layer

- **Status:** approved by major Android presentation update request
- **Date:** 2026-09-29
- **Approver:** product owner requested the website as the completed design and feature reference
- **Decision:** Express the website's signal-room character through reusable Compose primitives: an atmospheric but contrast-safe canvas, a code-native signal mark, editorial headings, bordered raised cards, compact trust/status chips, phase accents, player-color rails, pill actions, and reduced-motion-aware press feedback. Apply the layer to every existing server-supported flow while keeping adaptive scrolling, native form controls, canonical crewmate identities, and the established accessibility semantics.
- **Reason:** Token parity alone left the Android surfaces visually generic. Reusable native primitives create a cohesive, interactive identity without copying brittle web geometry or weakening platform behavior.
- **Consequences:** Feature screens should compose these shared primitives instead of inventing isolated card and background treatments. Decorative effects remain nonessential, cannot carry state by themselves, and must preserve high contrast and reduced motion. This decision does not authorize account/history, replay, or player-called-meeting features that remain gated by ADR-A-009, ADR-A-008, and ADR-A-006.

### ADR-A-026 — Server-authoritative Android emergency meetings

- **Status:** approved by gameplay-parity implementation request
- **Date:** 2026-09-29
- **Approver:** product owner requested website-equivalent Android game flow and repair of missing gameplay actions
- **Decision:** Expose player-called emergency meetings in Android only when the authoritative snapshot grants `call_meeting`, the player is alive, the server-provided allowance and task requirement pass, and the cooldown has elapsed. Require a deliberate confirmation, send the current state version with an idempotency key, and transition only from the returned server snapshot. A compact Status / Evidence / Meeting action rail and the expanded status surface share these same rules.
- **Reason:** The production website and API already implement this game mechanic, while Android rendered a nonfunctional Status button and omitted Meeting entirely. The product owner explicitly requested equal game flow and asked that missing server-supported features be implemented.
- **Consequences:** ADR-A-006 is approved for this server-backed behavior and no longer blocks Android meeting calls. Android still never starts or resolves a meeting locally, never reveals private ballots, and refreshes after stale-state conflicts. Replay and account/dashboard work remain gated by ADR-A-008 and ADR-A-009.
- **Supersedes:** The player-called-meeting exclusion in ADR-A-024 and ADR-A-025.

### ADR-A-027 — Server-authoritative same-room replay

- **Status:** approved by gameplay-parity implementation request
- **Date:** 2026-09-29
- **Approver:** product owner requested feature-complete website-equivalent lobby/game/results flow
- **Decision:** Expose same-room replay after an authoritative terminal game through `POST /api/v1/rooms/current/replay`. Reuse one idempotency identity for retries, accept only the returned room snapshot, clear every per-game private/UI state, rebuild the lobby settings draft from that snapshot, and restart lobby refresh. Keep explicit leave/home as the alternative.
- **Reason:** The endpoint and production website already support replay for hosts and participants, and omitting it forced players to learn a different Android flow and re-enter a room unnecessarily.
- **Consequences:** Replay never resets a room locally or preserves role, ballot, evidence preview, selection, or meeting state from the prior round. Multi-client staging acceptance remains required. Native account/dashboard/history remains separately blocked by ADR-A-009.
- **Supersedes:** ADR-A-008 and replay exclusions in ADR-A-018, ADR-A-024, and ADR-A-025.

### ADR-A-028 — Website is the exact Android presentation authority

- **Status:** approved by explicit product-owner direction
- **Date:** 2026-10-01
- **Approver:** product owner
- **Decision:** The frozen mobile website is the source of truth for Android layout, copy, typography, colors, spacing, radii, shadows, icons, artwork, identity presentation, animation, and navigation presentation. Android maps website CSS pixels one-to-one to logical dp/sp except for documented font-metric or OS-surface constraints. Existing Android-only accessibility and feedback controls remain, styled with the website system. Backend, API, authentication, persistence, realtime, privacy, and gameplay authority remain unchanged.
- **Reason:** The product owner rejected preserving the current Android presentation and explicitly requested full website parity.
- **Consequences:** UI work proceeds in approval-gated screen groups against frozen website references. Public Sans Variable and Barlow Condensed are bundled under OFL. Screen-local visual constants are migrated into the shared design system. Website operative identities replace the earlier crewmate-only presentation when player screens are migrated; transport identifiers and server authority remain intact.
- **Supersedes:** ADR-A-002, the presentation-only portion of ADR-A-010, and the native-adaptation constraints in ADR-A-024 and ADR-A-025. Security, accessibility, server-authority, and feedback-preference requirements in those decisions remain active.

### ADR-A-029 — Website-exact lobby/gameplay presentation and synthesized feedback

- **Status:** approved by implementation request and verified locally
- **Date:** 2026-10-01
- **Approver:** product owner
- **Decision:** Port the frozen website lobby and post-lobby presentation into shared Compose tokens and components, including the 18 operative SVG geometries, website identity names/colors, compact phase/invite/readiness/roster/task/vote/result hierarchy, 120/200/420/440/480/560ms motion roles, 45ms task stagger, and the website cubic-bezier easing. Replace stock Android tones with deterministic foreground-only PCM synthesis matching the website oscillator, envelope, noise, timing, and event recipes while retaining the existing typed feedback contract and preference gates.
- **Reason:** The prior Android lobby and gameplay surfaces, generic crewmate artwork, Material icons, and `ToneGenerator` feedback were visibly and audibly different from the approved mobile website.
- **Consequences:** Lobby and gameplay UI consumes the shared website roles instead of introducing screen-local presentation constants. Transport identity IDs, API/gateway signatures, authentication, persistence, realtime, evidence, and gameplay authority remain unchanged. Android secure-window privacy blocks ordinary role/gameplay screenshots; those states require semantics/interaction verification or test-host captures. Native photo picker, font rasterization, status/navigation bars, haptic motor response, and speaker response remain OS/device controlled.
- **Supersedes:** The temporary native-tone choice in ADR-A-024 and the canonical-crewmate artwork constraint in ADR-A-025.

### ADR-A-030 — Allow capture and overlays in every Android build

- **Status:** approved by explicit product-owner direction
- **Date:** 2026-10-02
- **Approver:** product owner
- **Decision:** Do not apply `FLAG_SECURE` or `HIDE_OVERLAY_WINDOWS` to Android gameplay in debug, staging, or release. Screenshots, screen recording, recent-task previews, and ordinary overlays are allowed so Android can be compared directly with the mobile website. Continue resealing the private role on pause and focus loss, and retain credential protection, authorization, DTO redaction, bounded media handling, clipboard expiry, and server-authoritative private-field filtering.
- **Reason:** The product owner explicitly accepted the privacy tradeoff and requires real-device capture-based parity review across room entry, lobby, and gameplay.
- **Consequences:** Private role, ballot, room, and evidence content can appear in user-initiated captures, screen recordings, recent-task thumbnails, or overlays. Store/privacy disclosures and the hardening checklist must describe this accurately. Synthetic data remains mandatory for committed or published comparison images.
- **Supersedes:** The screenshot/recent-task and overlay-blocking portion of ADR-A-019 and the secure-capture limitation in ADR-A-029. All other security controls in those decisions remain active.

### ADR-A-031 — Non-blocking deduplicated lobby settings autosave

- **Status:** approved by host-lobby parity correction request
- **Date:** 2026-10-02
- **Approver:** product owner
- **Decision:** Own lobby settings autosave in `EntryLobbyViewModel` with a 550ms trailing debounce, immutable request comparison, one in-flight update, and one latest-value follow-up. Expose clean, dirty, saving, saved, and error presentation states without using the screen-wide loading flag. Consume existing `room.snapshot` and connectivity repository flows as the primary lobby transport; use foreground-only HTTP fallback at 15/30/60 seconds only while realtime is unavailable.
- **Reason:** Compose-owned side effects caused duplicate settings calls and froze unrelated lobby controls, while frequent HTTP refreshes generated avoidable traffic.
- **Consequences:** Screen recomposition cannot initiate API work, unchanged values do not send requests, late responses cannot replace newer drafts, and Start remains blocked until the authoritative save succeeds. API paths, DTOs, authorization, and gameplay rules are unchanged.

### ADR-A-032 — Website-exact Imposter elimination dashboard and confirmation flow

- **Status:** approved by explicit product-owner parity direction and verified locally
- **Date:** 2026-10-03
- **Approver:** product owner
- **Decision:** On compact task screens, render the Imposter elimination ability after the assignment list and keep the card visible in both ready and cooldown states. Use the frozen website target-list hierarchy, privacy/cooldown copy, and one deliberate `Eliminate player` submission after target selection; do not add a second Android-only confirmation. Continue to revalidate the selected target against the newest snapshot and let the existing idempotent server command decide the outcome.
- **Reason:** The earlier Android presentation hid the ability while recharging, placed it before assignments, used generic ballot rows, and introduced a user-flow step absent from the approved mobile website.
- **Consequences:** Visual and interaction parity improves without granting client authority. Back closes the target popup, a changed target fails closed through existing ViewModel validation, and command failures refresh the authoritative snapshot.

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
