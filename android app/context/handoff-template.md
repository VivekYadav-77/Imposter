# Android implementation handoff template

Copy the following into `current-state.md` at the end of a session, replacing the prior active-work sections. Keep it factual and concise.

```markdown
## Session handoff

**Date/time:** YYYY-MM-DD HH:MM timezone
**Agent/session:** identifier if available
**Active phase:** phase and link
**Milestone:** exact bounded outcome
**Status:** complete / partial / blocked

### Changed

- `absolute or repo-relative path`: concise reason

### Verified

- `exact command` — pass/fail
- Manual/device check — result and device/configuration

### Decisions added

- ADR-A-### — title, or “none”

### Remaining issues

- Exact defect/blocker, evidence, and impact

### Next action

One concrete action that can be started without rediscovery.
```

## Handoff quality rules

- “Done” means verified, not merely edited.
- Include exact failing test/error for a blocker.
- Link to code/tests instead of pasting large output.
- Do not include speculative summaries of files not inspected.
- Do not include secrets or private game/evidence data.
- If work changed a public contract, identify the approved decision and backend coordination explicitly.
