# Phase 1 — Android project foundation

## Goal

Create a reproducible Kotlin/Compose project whose architecture, build, testing, and secret-handling rules are enforceable before feature growth.

## Milestones

### 1.1 Toolchain and project creation

- Create the Android project inside `android app/` without moving the planning/context files.
- Use Kotlin DSL, version catalogs, Jetpack Compose, Material 3 foundations, and a single activity.
- Select current stable compatible versions only after checking official Android/Kotlin release guidance.
- Pin Gradle wrapper and Java toolchain.
- Define `debug`, `staging`, and `release` environments without committing production credentials.
- Add deterministic formatting, static analysis, lint, unit-test, and instrumented-test commands.

### 1.2 Architecture seams

- Create the minimal modules approved in the master plan.
- Establish dependency direction so features cannot depend on transport DTOs or other feature internals.
- Add dependency injection and injected clock/dispatcher/key-generation seams.
- Establish immutable UI-state and one-shot effect conventions.
- Create typed application-error categories before network errors spread through UI code.

### 1.3 Build and CI

- Make clean checkout build/test commands work on CI and Windows development environments.
- Enable release shrinking/resource optimization early enough to catch serialization/reflection issues.
- Add secret scanning and dependency/license review.
- Cache build inputs safely without caching secrets.
- Produce a debug APK from CI.

### 1.4 Observability baseline

- Create a redacted logging facade with debug/release behavior.
- Define crash-reporting and analytics allowlists; collect no sensitive payload by default.
- Establish correlation/request ID support without recording bearer tokens or private state.

## Required tests

- Architecture dependency test or equivalent enforcement.
- Build-configuration tests for environment selection.
- Logger redaction tests for authorization headers, tokens, evidence URLs, role/vote fields, and query parameters.
- Basic Compose launch test in light and dark themes.

## Deliverables

- Reproducible project and build instructions.
- CI checks for formatting, lint, static analysis, unit tests, and debug build.
- Architecture README or decision entry covering module/dependency rules.
- No game feature implementation beyond a safe bootstrap shell.

## Exit criteria

- Clean checkout builds without local undocumented setup.
- Release configuration contains no debug logging or cleartext HTTP allowance.
- Tests can replace clock, transports, dispatchers, and ID generation.
- CI failure blocks merge.
