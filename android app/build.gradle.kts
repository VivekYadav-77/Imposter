plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("**/*.kt")
        targetExclude("**/build/**")
        ktfmt(libs.versions.ktfmt.get()).kotlinlangStyle()
        trimTrailingWhitespace()
        endWithNewline()
    }
    kotlinGradle {
        target("**/*.gradle.kts")
        targetExclude("**/build/**")
        ktfmt(libs.versions.ktfmt.get()).kotlinlangStyle()
        trimTrailingWhitespace()
        endWithNewline()
    }
    format("misc") {
        target("**/*.md", "**/*.xml", "**/*.yml", "**/*.yaml", "**/*.properties", "**/*.toml")
        targetExclude("**/build/**", "gradle/wrapper/gradle-wrapper.properties")
        trimTrailingWhitespace()
        endWithNewline()
    }
}

tasks.register("staticAnalysis") {
    group = "verification"
    description = "Runs deterministic formatting checks and Android lint."
    dependsOn(
        "spotlessCheck",
        ":app:lintDebug",
        ":core:designsystem:lintDebug",
        ":core:session:lintDebug",
    )
}

tasks.register("quality") {
    group = "verification"
    description = "Runs all local Phase 1 quality checks."
    dependsOn(
        "staticAnalysis",
        ":app:testDebugUnitTest",
        ":core:data:test",
        ":core:designsystem:testDebugUnitTest",
        ":core:session:testDebugUnitTest",
    )
}

tasks.register("connectedQuality") {
    group = "verification"
    description = "Runs Android instrumentation tests on every connected device."
    dependsOn(
        ":app:connectedDebugAndroidTest",
        ":core:designsystem:connectedDebugAndroidTest",
    )
}
