# Android requirements traceability

Update status only with a link to implemented code and passing tests. Status values: `planned`, `in progress`, `verified`, `blocked`.

| ID | Requirement | Phase | Primary verification | Status |
|---|---|---:|---|---|
| AND-001 | Native Kotlin Android client with reproducible build | 1 | Clean CI build and debug APK | in progress |
| AND-002 | Same canonical crewmate SVG for every player | 2 | Vector geometry/golden test | in progress |
| AND-003 | Unique stable color per room participant | 0, 2, 4 | Contract conflict + palette/UI tests | blocked |
| AND-004 | No website animal avatar visuals/names in Android | 2, 8 | Asset/string scan and UI review | in progress |
| AND-005 | Compact portrait layout | 2, 4–6 | Screenshot and usability tests | in progress |
| AND-006 | Compact landscape layout | 2, 4–6 | Screenshot and usability tests | in progress |
| AND-007 | Foldable/tablet-safe adaptive behavior | 2, 7 | Window/hinge test matrix | in progress |
| AND-008 | Guest create and join | 4 | Staging integration/E2E | in progress |
| AND-009 | Secure session resume | 3, 7 | Process-death/reconnect tests | in progress |
| AND-010 | Host lobby setup and start | 4 | Multi-device E2E | in progress |
| AND-011 | Private role reveal and automatic reseal | 5, 7 | Lifecycle/privacy tests | planned |
| AND-012 | Task list and authoritative progress | 5 | Snapshot/UI integration tests | planned |
| AND-013 | Camera/photo picker evidence flow | 5 | Physical-device upload E2E | planned |
| AND-014 | Safe background/retry upload behavior | 5, 7 | Failure/process tests | planned |
| AND-015 | Evidence gallery and authorized flagging | 5 | Visibility/authorization tests | planned |
| AND-016 | Authorized imposter elimination | 5 | Role/cooldown/race tests | planned |
| AND-017 | Player-called meeting | 0, 5 | Product decision and E2E | blocked |
| AND-018 | Discussion and evidence review | 6 | Multi-device phase E2E | planned |
| AND-019 | Private/public ejection voting | 0, 6 | Contract/privacy/race tests | blocked |
| AND-020 | Meeting and terminal result | 6 | End-reason/reconnect tests | planned |
| AND-021 | Server-authoritative snapshot/resync | 3 | Version-gap integration tests | in progress |
| AND-022 | Idempotent mutation retry | 3 | Request-policy tests | in progress |
| AND-023 | TalkBack and non-color semantics | 2, 7 | Manual + automated accessibility checks | in progress |
| AND-024 | Large text, contrast, reduced motion/sound | 2, 7 | Accessibility matrix | in progress |
| AND-025 | Token/role/vote/evidence privacy | 1, 3, 5–8 | Redaction/threat-model review | in progress |
| AND-026 | Release, monitoring, rollback | 8 | Release-candidate checklist | planned |
