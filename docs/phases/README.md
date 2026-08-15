# Development Phases

Implementation is dependency-ordered. Each phase reads:

1. `docs/MASTER_PLAN.md`
2. Its own phase document
3. Only the immediately previous completed phase context
4. Existing code and current tests

| Phase | Document                                                 | Primary result                                                          |
| ----: | -------------------------------------------------------- | ----------------------------------------------------------------------- |
|     1 | [Foundation](PHASE_01_FOUNDATION.md)                     | Runnable backend skeleton and verified persistence/contract conventions |
|     2 | [Admin and task packs](PHASE_02_ADMIN_TASK_PACKS.md)     | Secure pack administration and public discovery                         |
|     3 | [Rooms and sessions](PHASE_03_ROOMS_SESSIONS.md)         | Guest identity, lobby, presence, and reconnect                          |
|     4 | [Game and tasks](PHASE_04_GAME_TASKS.md)                 | Authoritative game start, roles, assignments, and progress              |
|     5 | [Evidence](PHASE_05_EVIDENCE.md)                         | Private photo upload, validation, flags, and retention                  |
|     6 | [Meetings and outcomes](PHASE_06_MEETINGS_OUTCOMES.md)   | Kill, meetings, reviews, voting, timers, and win checks                 |
|     7 | [Production readiness](PHASE_07_PRODUCTION_READINESS.md) | Recovery, hardening, deployment, and stable client contract             |

Do not begin a phase until its prerequisites and previous completion criteria are satisfied. At completion, write `docs/context/PHASE_N_CONTEXT.md` from the template and verify the documentation describes reality.

## Reference map

Every phase file contains direct links to its required sources. This table shows why each document is used.

| Phase | Master plan         | Architecture        | Database                | API contract            | Security                  | Prior context |
| ----: | ------------------- | ------------------- | ----------------------- | ----------------------- | ------------------------- | ------------- |
|     1 | Scope and decisions | Runtime bootstrap   | Persistence conventions | Common contract         | Baseline controls         | Phase 0       |
|     2 | Admin/pack rules    | Module boundaries   | Admin/catalog schema    | Admin/catalog endpoints | Password/session controls | Phase 1       |
|     3 | Room rules          | Realtime/recovery   | Room/session schema     | Lobby/session events    | Guest-session controls    | Phase 2       |
|     4 | Game rules          | Command/state flow  | Game/task schema        | Start/snapshot contract | Role secrecy              | Phase 3       |
|     5 | Evidence/privacy    | Storage/worker flow | Submission/job schema   | Upload/flag contract    | File-upload controls      | Phase 4       |
|     6 | Meeting/win rules   | Timer/race flow     | Meeting/vote schema     | Kill/vote contract      | Ballot/killer secrecy     | Phase 5       |
|     7 | Launch criteria     | Deployment topology | Migration/backup review | Contract freeze         | Full security review      | Phase 6       |

The [Master architecture plan](../MASTER_PLAN.md) owns product rules. [System architecture](../ARCHITECTURE.md) owns runtime boundaries. [Database design](../DATABASE_DESIGN.md), [API contract](../API_CONTRACT.md), and [Security design](../SECURITY.md) own their respective technical contracts. A completed phase context records what actually exists and overrides assumptions in later planning documents; any resulting discrepancy must also be reconciled in the master documents.
