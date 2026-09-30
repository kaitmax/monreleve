// AN-AUDIT increment 4. The cross-app read probe (see settings.gradle.kts). Deliberately MINIMAL: only the
// two android/kotlin plugins, ZERO dependencies (plain android.app.Activity + android.widget.TextView are
// framework classes), no Compose, no ktlint/detekt (those are applied in :app only). A different applicationId
// gives it a different Linux UID, which is the whole point - it is a real second app, not an adb-shell stand-in.
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
    kotlinOptions {
        jvmTarget = "17"
    }
}
