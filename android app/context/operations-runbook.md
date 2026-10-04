# Android operations runbook

Use this with an approved release, named incident lead, and access-controlled dashboards/Play Console. Record timestamps, app version, backend deployment, affected percentage, and safe request IDs. Never paste tokens, roles, ballots, room codes, nicknames, evidence, signed URLs, headers, or bodies into tickets or chat.

## Common first response

1. Acknowledge the alert, assign incident lead and scribe, and freeze Android/backend rollout changes.
2. Check the stop thresholds in [`phase-08-release.md`](phase-08-release.md). If one is met, halt the staged rollout immediately.
3. Correlate only by version, environment, coarse network status, operation/outcome, and consented request IDs.
4. Preserve the signed AAB, R8 mapping, commit, backend build, dashboards, and timeline under access control.
5. Prefer rollback or rollout halt to speculative client-state repair. The server remains authoritative.

## Bad Android release

- Halt promotion and keep the previous known-good artifact available.
- Play cannot downgrade updated clients. Publish a higher-version-code corrective release where needed.
- Verify the correction twice, run targeted regression plus bootstrap/join/resume smoke tests, then restart at internal testing.
- Never reuse a version code or production signing identity.

## Backend incompatibility

- Halt both rollouts. Restore an API v1-compatible backend or disable the incompatible server behavior.
- Verify bootstrap, room/game snapshots, idempotent mutation, conflict refresh, realtime schema 1, and revocation.
- Do not force-update without the approved server contract described in the release policy.

## Evidence upload/storage outage

- Preserve server authority; never mark evidence complete locally.
- Locate whether intent creation, object PUT, or confirmation is failing using aggregate stage/outcome metrics and safe request IDs.
- Disable evidence-dependent server configuration only through an approved control. Never log or request evidence bytes/URLs from users.
- After recovery, test a new upload and confirmation. Replace expired signed instructions; do not replay them.

## Websocket outage

- Confirm HTTP snapshot health. The visible client may poll authoritative state.
- Restore `/realtime` and monitor reconnect/resync rates. Do not reduce backoff or increase heartbeat frequency during the incident.
- Verify state-version gaps close after resync and private fields remain participant-authorized.

## Credential/session incident

- Treat unexpected revocation clusters or suspected token exposure as security incidents. Halt rollout, revoke affected server sessions, and preserve access-controlled audit evidence.
- The client clears credentials and sensitive state on revocation. Never request a token or encrypted preference file from a user.
- Assess Keystore, backup, logs, crash reports, analytics, clipboard, screenshots, and signed-upload scopes before resuming.
- Identify account and participant sessions separately. Account revocation may clear dashboard state,
  but must not terminate an independently valid live-game participant session.
- For Google failures, compare only fixed challenge/completion outcomes and configuration state.
  Never collect ID tokens, nonces, transaction tokens, email addresses, Google subjects, or account IDs.
- If native account auth loops or claims the wrong identity, turn off the Android account feature for
  subsequent builds/rollout, preserve guest play and API v1 cookie compatibility, and investigate
  Google client ID/package/certificate configuration before reenabling.

## Rollout halt/rollback exercise

Before closed testing, an authorized operator must demonstrate: halt a staged rollout; identify the last known-good version; create a higher-version-code corrective candidate; locate its mapping file; restore an API v1-compatible backend; fire and acknowledge a synthetic privacy-safe alert; and record recovery time. Attach evidence to the release ledger.

## Closure

Close after recovery is verified, stop signals remain below warning levels for the agreed observation window, users have a safe support path, retained sensitive data is reviewed/deleted, and follow-ups have owners/deadlines. Update this runbook when an exercise reveals a gap.
