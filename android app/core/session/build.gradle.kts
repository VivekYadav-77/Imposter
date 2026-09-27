plugins { alias(libs.plugins.android.library) }

android {
    namespace = "com.impostergame.session"
    compileSdk = 36

    defaultConfig { minSdk = 26 }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin { jvmToolchain(17) }

    lint {
        abortOnError = true
        warningsAsErrors = true
    }
}

dependencies {
    implementation(project(":core:data"))
    implementation(libs.kotlinx.coroutines.core)
}
