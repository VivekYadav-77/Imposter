# Android requirements traceability

Update status only with a link to implemented code and passing tests. Status values: `planned`, `in progress`, `verified`, `blocked`.

| ID | Requirement | Phase | Primary verification | Status |
|---|---|---:|---|---|
| AND-001 | Native Kotlin Android client with reproducible build | 1 | [`../app/build.gradle.kts`](../app/build.gradle.kts), clean quality gate, debug APK install | verified |
| AND-002 | Same canonical crewmate SVG for every player | 2 | Vector geometry/golden test | in progress |
| AND-003 | Unique stable color per room participant | 0, 2, 4 | Contract conflict + palette/UI tests | blocked |
| AND-004 | No website animal avatar visuals/names in Android | 2, 8 | Asset/string scan and UI review | in progress |
| AND-005 | Compact portrait layout | 2, 4–6 | [`../core/designsystem/src/androidTest/java/com/impostergame/designsystem/DesignSystemScreenshotTest.kt`](../core/designsystem/src/androidTest/java/com/impostergame/designsystem/DesignSystemScreenshotTest.kt), physical-device usability | in progress |
| AND-006 | Compact landscape layout | 2, 4–6 | [`../core/designsystem/src/androidTest/java/com/impostergame/designsystem/DesignSystemScreenshotTest.kt`](../core/designsystem/src/androidTest/java/com/impostergame/designsystem/DesignSystemScreenshotTest.kt), physical-device usability | in progress |
| AND-007 | Foldable/tablet-safe adaptive behavior | 2, 7 | Window/hinge test matrix | in progress |
| AND-008 | Guest create and join | 4 | Staging integration/E2E | in progress |
| AND-009 | Secure session resume | 3, 7 | [`../app/src/test/java/com/impostergame/android/entry/EntryLobbyViewModelTest.kt`](../app/src/test/java/com/impostergame/android/entry/EntryLobbyViewModelTest.kt), process-death/reconnect tests; [`phase-07-hardening.md`](phase-07-hardening.md) matrix | in progress |
| AND-010 | Host lobby setup and start | 4 | [`../app/src/test/java/com/impostergame/android/entry/EntryLobbyModelsTest.kt`](../app/src/test/java/com/impostergame/android/entry/EntryLobbyModelsTest.kt), multi-device E2E | in progress |
| AND-011 | Private role reveal and automatic reseal | 5, 7 | Lifecycle/privacy tests | in progress |
| AND-012 | Task list and authoritative progress | 5 | Snapshot/UI integration tests | in progress |
| AND-013 | Camera/photo picker evidence flow | 5 | [`../app/src/androidTest/java/com/impostergame/android/gameplay/EvidenceProcessorTest.kt`](../app/src/androidTest/java/com/impostergame/android/gameplay/EvidenceProcessorTest.kt), [`../core/data/src/test/java/com/impostergame/data/network/NetworkPolicyTest.kt`](../core/data/src/test/java/com/impostergame/data/network/NetworkPolicyTest.kt), physical-device accepted upload | in progress |
| AND-014 | Safe background/retry upload behavior | 5, 7 | Failure/process tests | in progress |
| AND-015 | Evidence gallery and authorized flagging | 5 | Visibility/authorization tests | in progress |
| AND-016 | Authorized imposter elimination | 5 | Role/cooldown/race tests | in progress |
| AND-017 | Player-called meeting | 0, 5 | Product decision and E2E | blocked |
| AND-018 | Discussion and evidence review | 6 | Multi-device phase E2E | in progress |
| AND-019 | Private/public ejection voting | 0, 6 | Contract/privacy/race tests | in progress |
| AND-020 | Meeting and terminal result | 6 | End-reason/reconnect tests | in progress |
| AND-021 | Server-authoritative snapshot/resync | 3 | Version-gap integration tests; [`../app/src/test/java/com/impostergame/android/entry/EntryLobbyViewModelTest.kt`](../app/src/test/java/com/impostergame/android/entry/EntryLobbyViewModelTest.kt) remote-start routing | in progress |
| AND-022 | Idempotent mutation retry | 3 | Request-policy tests | in progress |
| AND-023 | TalkBack and non-color semantics | 2, 7 | [`../core/designsystem/src/androidTest/java/com/impostergame/designsystem/AccessibilityTest.kt`](../core/designsystem/src/androidTest/java/com/impostergame/designsystem/AccessibilityTest.kt), manual traversal; [`phase-07-hardening.md`](phase-07-hardening.md) | in progress |
| AND-024 | Large text, contrast, reduced motion/sound | 2, 7 | [`../core/designsystem/src/test/java/com/impostergame/designsystem/theme/BrandThemeTest.kt`](../core/designsystem/src/test/java/com/impostergame/designsystem/theme/BrandThemeTest.kt), [`../app/src/test/java/com/impostergame/android/preferences/AppPreferencesTest.kt`](../app/src/test/java/com/impostergame/android/preferences/AppPreferencesTest.kt), physical light/dark persistence check, [`phase-07-hardening.md`](phase-07-hardening.md) accessibility matrix | in progress |
| AND-025 | Token/role/vote/evidence privacy | 1, 3, 5–8 | Redaction tests + [`phase-07-hardening.md`](phase-07-hardening.md) threat model | in progress |
| AND-026 | Release, monitoring, rollback | 8 | [`phase-08-release.md`](phase-08-release.md), signed-release and connected-device workflows, [`operations-runbook.md`](operations-runbook.md) | in progress |
| AND-027 | Predictable system and labeled in-app back navigation | 7, 8 | [`../app/src/androidTest/java/com/impostergame/android/NavigationBackTest.kt`](../app/src/androidTest/java/com/impostergame/android/NavigationBackTest.kt), physical Acer device Back verification | verified |
