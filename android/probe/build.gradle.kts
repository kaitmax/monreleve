// AN-AUDIT increment 4. The cross-app read probe (see settings.gradle.kts). Deliberately MINIMAL: only the
// two android/kotlin plugins, ZERO dependencies (plain android.app.Activity + android.widget.TextView are
// framework classes), no Compose, no ktlint/detekt (those are applied in :app only). A different applicationId
// gives it a different Linux UID, which is the whole point - it is a real second app, not an adb-shell stand-in.
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "ch.monreleve.probe"
    compileSdk = 35

    defaultConfig {
        applicationId = "ch.monreleve.probe"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// KMP-UP2. The SAME target, 17, through the compilerOptions DSL - the form :shared already uses (KMP-2b).
// With the Kotlin Gradle plugin at 2.2.21 this file's old android { kotlinOptions { jvmTarget = "17" } }
// compiled with
//   w: probe/build.gradle.kts:27:9: 'jvmTarget: String' is deprecated. Please migrate to the compilerOptions DSL.
// and at 2.1.10 without it (both measured by forcing the script to recompile). The value does not move,
// only the DSL that sets it. Valid on both versions, so it lands BEFORE the version bump (R544).
kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
