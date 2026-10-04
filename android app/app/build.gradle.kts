import java.net.URI
import org.gradle.api.DefaultTask
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

fun org.gradle.api.provider.ProviderFactory.releaseValue(name: String, fallback: String = "") =
    providers.gradleProperty(name).orElse(providers.environmentVariable(name)).orElse(fallback)

fun String.asBuildConfigString() = replace("\\", "\\\\").replace("\"", "\\\"")

val versionCodeValue = providers.releaseValue("ANDROID_VERSION_CODE", "1").get().toInt()
val versionNameValue = providers.releaseValue("ANDROID_VERSION_NAME", "0.1.0").get()
val debugApiBaseUrl = providers.releaseValue("DEBUG_API_BASE_URL").get().asBuildConfigString()
val stagingApiBaseUrlValue = providers.releaseValue("STAGING_API_BASE_URL").get()
val productionApiBaseUrlValue = providers.releaseValue("PRODUCTION_API_BASE_URL").get()
val googleWebClientIdValue = providers.releaseValue("GOOGLE_WEB_CLIENT_ID").get()
val accountFeatureEnabled =
    providers.releaseValue("ANDROID_ACCOUNT_FEATURE_ENABLED", "false").get().toBooleanStrict()
val stagingApiBaseUrl = stagingApiBaseUrlValue.asBuildConfigString()
val productionApiBaseUrl = productionApiBaseUrlValue.asBuildConfigString()
val keystorePath = providers.releaseValue("ANDROID_KEYSTORE_PATH").orNull
val keystorePassword = providers.releaseValue("ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.releaseValue("ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.releaseValue("ANDROID_KEY_PASSWORD").orNull
val releaseSigningConfigured =
    listOf(keystorePath, keystorePassword, releaseKeyAlias, releaseKeyPassword).all {
        !it.isNullOrBlank()
    }

abstract class ValidateStagingConfigurationTask : DefaultTask() {
    @get:Input abstract val endpoint: Property<String>
    @get:Input abstract val accountFeatureEnabled: Property<Boolean>
    @get:Input abstract val googleWebClientId: Property<String>

    @TaskAction
    fun validate() {
        val uri = runCatching { URI(endpoint.get()) }.getOrNull()
        require(
            uri?.scheme == "https" &&
                !uri.host.isNullOrBlank() &&
                uri.rawPath.isNullOrEmpty() &&
                uri.rawQuery == null &&
                uri.rawFragment == null &&
                uri.userInfo == null
        ) {
            "STAGING_API_BASE_URL must be a non-empty HTTPS origin without path, query, " +
                "credentials, or fragment"
        }
        if (accountFeatureEnabled.get()) {
            require(
                Regex("[0-9]+-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com")
                    .matches(googleWebClientId.get())
            ) {
                "GOOGLE_WEB_CLIENT_ID must be a Google OAuth web client ID"
            }
        }
    }
}

val accountFeatureFlag = accountFeatureEnabled
val validateStagingConfiguration =
    tasks.register<ValidateStagingConfigurationTask>("validateStagingConfiguration") {
        group = "verification"
        description = "Validates the non-secret staging endpoint configuration."
        endpoint.set(stagingApiBaseUrlValue)
        this.accountFeatureEnabled.set(accountFeatureFlag)
        googleWebClientId.set(googleWebClientIdValue)
    }

val validateReleaseConfiguration =
    tasks.register("validateReleaseConfiguration") {
        group = "verification"
        description = "Validates version, endpoint, and external signing inputs for a release."
        notCompatibleWithConfigurationCache("Validates externally supplied deployment inputs")
        doLast {
            require(versionCodeValue > 0) { "ANDROID_VERSION_CODE must be positive" }
            require(
                Regex("[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?").matches(versionNameValue)
            ) {
                "ANDROID_VERSION_NAME must use semantic version syntax"
            }
            val uri = runCatching { URI(productionApiBaseUrlValue) }.getOrNull()
            require(
                uri?.scheme == "https" &&
                    !uri.host.isNullOrBlank() &&
                    uri.rawPath.isNullOrEmpty() &&
                    uri.rawQuery == null &&
                    uri.rawFragment == null &&
                    uri.userInfo == null
            ) {
                "PRODUCTION_API_BASE_URL must be a non-empty HTTPS origin without path, query, " +
                    "credentials, or fragment"
            }
            require(releaseSigningConfigured) {
                "Release signing requires ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, " +
                    "ANDROID_KEY_ALIAS, and ANDROID_KEY_PASSWORD outside the repository"
            }
            if (accountFeatureEnabled) {
                require(
                    Regex("[0-9]+-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com")
                        .matches(googleWebClientIdValue)
                ) {
                    "GOOGLE_WEB_CLIENT_ID must be a Google OAuth web client ID"
                }
            }
            require(file(requireNotNull(keystorePath)).isFile) {
                "ANDROID_KEYSTORE_PATH must identify a readable keystore file"
            }
        }
    }

android {
    namespace = "com.impostergame.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.impostergame.android"
        minSdk = 26
        targetSdk = 36
        versionCode = versionCodeValue
        versionName = versionNameValue

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        buildConfigField(
            "String",
            "GOOGLE_WEB_CLIENT_ID",
            "\"${googleWebClientIdValue.asBuildConfigString()}\"",
        )
        buildConfigField("boolean", "ACCOUNT_FEATURE_ENABLED", accountFeatureEnabled.toString())
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("releaseExternal") {
                storeFile = file(requireNotNull(keystorePath))
                storePassword = keystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            buildConfigField("String", "ENVIRONMENT", "\"debug\"")
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        }
        create("staging") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            isDebuggable = false
            matchingFallbacks += listOf("debug")
            buildConfigField("String", "ENVIRONMENT", "\"staging\"")
            buildConfigField("String", "API_BASE_URL", "\"$stagingApiBaseUrl\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            if (releaseSigningConfigured)
                signingConfig = signingConfigs.getByName("releaseExternal")
            buildConfigField("String", "ENVIRONMENT", "\"release\"")
            buildConfigField("String", "API_BASE_URL", "\"$productionApiBaseUrl\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        jvmToolchain(17)
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }

    lint {
        abortOnError = true
        checkDependencies = true
        disable += setOf("AndroidGradlePluginVersion", "GradleDependency", "OldTargetApi")
        warningsAsErrors = true
    }
}

tasks.configureEach {
    when (name) {
        "assembleStaging",
        "bundleStaging",
        "lintStaging" -> dependsOn(validateStagingConfiguration)
        "assembleRelease",
        "bundleRelease",
        "lintRelease" -> dependsOn(validateReleaseConfiguration)
    }
}

dependencies {
    implementation(project(":core:data"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:session"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.exifinterface)
    implementation(libs.okhttp)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.animation)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
