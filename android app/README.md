# Imposter Game for Android

Native Kotlin/Jetpack Compose client for the in-person Imposter Game. The current implementation is a safe bootstrap shell; gameplay features have not been started.

## Prerequisites

- JDK 17, provisioned automatically through Gradle's pinned toolchain resolver when it is not installed.
- Android SDK Platform 36 and a compatible SDK Build Tools package.
- No Gradle installation is needed; use the checked-in wrapper.

Set `sdk.dir` in an untracked `local.properties` file, or set `ANDROID_HOME`. Do not place credentials or private endpoints in project files.

## Commands

Run these from this directory.

```powershell
.\gradlew.bat spotlessApply        # deterministic formatting
.\gradlew.bat staticAnalysis      # formatting check + Android lint
.\gradlew.bat testDebugUnitTest   # local unit tests
.\gradlew.bat connectedDebugAndroidTest # device/emulator tests
.\gradlew.bat assembleDebug       # debug APK
.\gradlew.bat quality             # standard local verification gate
```

Unix-like environments use `./gradlew` with the same task names.

## Environment builds

The app defines `debug`, `staging`, and `release` build types. All base URLs are intentionally blank until approved environment endpoints are supplied through a later, non-secret build configuration mechanism. Cleartext traffic is disabled for every build. Release builds enable code and resource shrinking.

Start with [`plan/master-plan.md`](plan/master-plan.md), then continue from [`context/current-state.md`](context/current-state.md). The website's animal avatar artwork and labels are not Android design inputs.
