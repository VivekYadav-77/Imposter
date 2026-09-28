# Phase 8 release and acceptance record

**Status:** in progress; deterministic repository controls are implemented, external validation and approvals remain gated
**Last updated:** 2026-09-28

## Release identity and configuration

- The current application ID is `com.impostergame.android`. It is not final until the product owner confirms ownership and Play Console availability. Changing it after distribution creates a different application.
- `ANDROID_VERSION_CODE` is a positive, monotonically increasing integer. `ANDROID_VERSION_NAME` uses semantic version syntax. CI defaults are test values; the release workflow requires both inputs.
- Debug, staging, and production use separate `DEBUG_API_BASE_URL`, `STAGING_API_BASE_URL`, and `PRODUCTION_API_BASE_URL` inputs. Staging and production must be non-empty HTTPS origins without trailing slashes. Endpoints are configuration, not secrets.
- Release signing requires an external keystore and four environment/Gradle inputs. Keystores and build outputs are ignored. The production workflow materializes the keystore under the runner temporary directory, uses protected environment secrets, and uploads the signed AAB plus R8 mapping as a restricted artifact.
- Release builds always enable R8 and resource shrinking. Broad keep rules are forbidden; a keep rule must correspond to a reproduced release-only defect.
- CI generates a disposable short-lived signing key to prove the signed, shrunk bundle path without using production credentials.

## Compatibility and forced-update policy

- Android v1 speaks HTTP `/api/v1` and realtime schema version `1`. Additive server changes may ship within v1; a breaking server change requires a versioned contract and a compatible client rollout before activation.
- Minimum supported Android is API 26; compile/target is API 36.
- The frozen HTTP contract has no minimum-client-version or forced-update response. Android cannot invent an in-app force-update decision. Until a versioned server contract is approved, keep the prior backend compatible, stop rollout, and use Play Console availability controls.
- A future contract must provide minimum/latest version codes, store destination, effective time, and emergency bypass. It must cover offline bootstrap and resumable active games.

## Automated verification layers

| Layer | Repository implementation | Current evidence |
|---|---|---|
| Pure unit | Models, retry/backoff, redaction, colors, formatting, validation, operational privacy | Host suites exist; Phase 8 adds operations/privacy tests |
| Repository/contract | MockWebServer fixtures for auth, commands, conflicts, uploads; realtime fake transport | Existing `core:data` tests |
| Backend staging | Auth, idempotency, conflicts, upload, snapshot, realtime | Blocked pending approved staging origin and test accounts |
| Compose UI | Critical entry/lobby/game paths and authorization variants | Partial instrumentation coverage; full matrix pending SDK/device execution |
| Screenshot/golden | Compact portrait/landscape/expanded, themes, large font | Design-system instrumentation exists; feature goldens pending |
| Multi-device E2E | Phase 8 scenarios and lifecycle/failure variants | Not run; requires production-like infrastructure and devices |
| Release build | Lint/unit checks plus signed AAB with R8/resource shrinking | CI and protected release workflows added; first hosted run pending |

No row is “passed” until its run/artifact is recorded. A clean candidate must pass the full gate twice with separate clean outputs and no retry-masked failure.

## Privacy-safe observability

`core:data` exposes a fixed vocabulary for bootstrap, join, socket reconnect, resync, upload stages, command conflict, and session revocation. Events contain only metric and outcome enums. Crash breadcrumbs use the same type, so there is no field for room code, participant, role, target, ballot, evidence, URL, header, body, or token.

Support diagnostics retain at most five sanitized request IDs in memory and generate version, build, environment, network state, and request-ID text only after an explicit confirmation dialog. They never retain routes, response text, error details, or gameplay fields. Installing a crash/metrics vendor, retention/residency review, and wiring dashboards require owner/vendor approval and are release blockers.

Initial alert proposals, to be approved against staging baselines:

| Signal | Warning | Stop/incident |
|---|---:|---:|
| Crash-free users, rolling 24 h | below 99.8% | below 99.5% |
| ANR-free users, rolling 24 h | below 99.9% | below 99.7% |
| Bootstrap success, 15 min, at least 100 attempts | below 98% | below 95% |
| Join success excluding input errors, 15 min, at least 50 attempts | below 97% | below 93% |
| Reconnect success within 30 s, 15 min | below 95% | below 90% |
| Upload completion, 30 min, at least 25 attempts | below 95% | below 90% |
| Command conflicts | 2x seven-day baseline | 4x baseline |
| Session revocations | 2x seven-day baseline | 4x baseline or unexplained cluster |

Low-volume windows do not page; they create a review signal. Never segment by role, ballot, evidence content, room, nickname, participant ID, or room code.

## Store/privacy package

- Permission declaration: internet and camera only. Camera is requested just in time; existing photos use the system picker; there is no broad storage, contacts, location, microphone, notification, or background-location permission.
- Photo disclosure: selected/captured evidence is orientation-normalized, metadata-stripped, JPEG re-encoded, uploaded for game review, and governed by server-returned retention policy.
- Backups/device transfer are disabled; gameplay windows are screenshot/recent-preview protected; participant credentials are Keystore-protected.
- Privacy policy URL, data-safety answers, content rating, store copy, support contact, release countries, localized listing, and final screenshots require owner/legal approval in Play Console.
- Screenshots use synthetic data and never show a private role, ballot, room code, request ID, evidence image, real nickname, or production endpoint.
- Play Integrity is not included. Add it only after a threat-model decision and server verification contract.

## Acceptance and rollout

The ten scenarios in the Phase 8 plan must record backend build, Android commit/version, devices/API levels, visibility mode, result, run link, and defects. Mandatory variants include API 26/31/36, compact portrait/landscape, expanded width, light/dark, 200% font, and rotation/background/network loss/process death at every authoritative phase.

The product owner runs the production-like acceptance game. Accessibility and privacy reviewers sign separately. ADR-A-005 through ADR-A-009 and the final application ID/store scope must be resolved before general availability.

1. Internal: two clean release-gate passes, signed AAB/mapping retained, API 26/31/36 smoke tests, and no critical/high security/privacy or blocker accessibility issue.
2. Closed: the E2E ledger passes; monitor at least 48 hours. Stop for any incident threshold, session loss, unauthorized disclosure, upload data loss, or incompatibility.
3. Production: 5% for 24 hours, 20% for 24 hours, 50% for 48 hours, then 100% only with approved dashboards and no stop criterion.
4. Halt immediately for privacy/security disclosure, crash/ANR stop threshold, authentication/session loop, inability to join/resume, corrupt uploads, or incompatibility. Follow the operations runbook.

## Release evidence checklist

- [ ] Owner approves application ID, regions, store copy/screenshots, content rating, privacy policy, and data-safety form.
- [ ] Approved staging/production origins are reachable over TLS.
- [ ] Protected `android-production` environment and signing secrets are configured; recovery is tested.
- [ ] Dependency vulnerability/license reports have no unapproved critical/high finding.
- [ ] Full pyramid and all ten E2E scenarios pass on the recorded matrix.
- [ ] Accessibility, privacy/security, and usability sign-offs are attached.
- [ ] Dashboards route each alert to an owner; synthetic events reach on-call without private payloads.
- [ ] Rollback/halt exercise succeeds using the operations runbook.
- [ ] Exact candidate passes `clean quality bundleRelease` twice without flaky retry.
- [ ] Release notes list limitations, commit, versions, backend, AAB digest, mapping, and acceptance evidence.
