# Imposter Game for Android

Native Kotlin/Jetpack Compose client for the in-person Imposter Game.

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
.\gradlew.bat validateStagingConfiguration
.\gradlew.bat validateReleaseConfiguration
```

Unix-like environments use `./gradlew` with the same task names.

## Local phone and tablet testing

Use Android SDK Platform 36, Build Tools 36.0.0, platform tools, the Android emulator,
and an API 36 Google APIs x86_64 system image. The configured local AVDs are
`medium_phone` and `imposter_tablet_api_36`. On machines with limited memory,
run only one AVD at a time.

The local Node backend listens on the development machine. Configure debug builds
with `DEBUG_API_BASE_URL=http://10.0.2.2:3000`; `10.0.2.2` is the Android emulator's
bridge to the host loopback interface. The debug source set permits cleartext traffic
for local development only. Staging and release builds remain HTTPS-only.

With the backend running and one AVD booted:

```powershell
$env:DEBUG_API_BASE_URL = "http://10.0.2.2:3000"
.\gradlew.bat installDebug
adb shell am start -n com.impostergame.android.debug/com.impostergame.android.MainActivity
```

For a physical device, enable USB debugging, authorize this computer, verify it with
`adb devices -l`, and use `adb reverse tcp:3000 tcp:3000`. Build with
`DEBUG_API_BASE_URL=http://127.0.0.1:3000` for that device. Never use the debug
cleartext configuration for staging or production acceptance.

## Environment and release builds

The app defines `debug`, `staging`, and `release` build types. Configure them with `DEBUG_API_BASE_URL`, `STAGING_API_BASE_URL`, and `PRODUCTION_API_BASE_URL` Gradle properties or environment variables. Staging and production validation requires an HTTPS origin without a trailing slash. Cleartext traffic is disabled outside explicitly enabled local debug use.

Release versioning uses `ANDROID_VERSION_CODE` and `ANDROID_VERSION_NAME`. A release build additionally requires `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`; the key and secrets must remain outside the repository. `release` always enables code/resource shrinking, and `bundleRelease` depends on the release configuration gate.

See [`context/phase-08-release.md`](context/phase-08-release.md) for CI, rollout, compatibility, monitoring, and acceptance policy and [`context/operations-runbook.md`](context/operations-runbook.md) for incident handling.

Start with [`plan/master-plan.md`](plan/master-plan.md), then continue from [`context/current-state.md`](context/current-state.md). The website's animal avatar artwork and labels are not Android design inputs.
