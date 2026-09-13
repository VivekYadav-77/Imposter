# Website frontend documentation

This folder is the source of truth for the Imposter Game website experience.

## Required reading order for an implementation agent

1. `FRONTEND_MASTER_PLAN.md`
2. `imposter-game-design-system.md`
3. `../CLIENT_INTEGRATION.md`
4. The current phase section in `FRONTEND_PHASE_PLAN.md`
5. `context/CURRENT_CONTEXT.md`

The backend's machine-readable contracts remain authoritative: `../../openapi/openapi.json` and `../../contracts/realtime-v1.schema.json`.

## Continuation rule

At the end of every phase, replace `context/CURRENT_CONTEXT.md` with a complete handoff using `context/CONTEXT_TEMPLATE.md`. The next agent should understand completed work, decisions, files, verification, limitations, and the exact next step from that context. It should **not** review all code from previous phases. It may inspect an earlier implementation only when the current context identifies an unresolved defect, a contract mismatch, or a failing verification command that cannot be understood from the handoff.

## Documents

- `FRONTEND_MASTER_PLAN.md` — product boundary, architecture, quality bar, and overall delivery strategy.
- `FRONTEND_PHASE_PLAN.md` — dependency-ordered implementation phases and completion criteria.
- `imposter-game-design-system.md` — approved visual, responsive, interaction, motion, copy, and accessibility system.
- `context/CURRENT_CONTEXT.md` — current frontend state and next starting point.
- `context/CONTEXT_TEMPLATE.md` — mandatory handoff structure for every completed phase.
