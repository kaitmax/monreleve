plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

android {
    namespace = "ch.monreleve.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ch.monreleve.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom("$rootDir/config/detekt/detekt.yml")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    testImplementation(libs.junit)
    // TEST-ONLY, justified by name (AN1 out-of-scope note): ThemeCensusTest.kt
    // reflects over androidx Typography/ColorScheme, library data classes with
    // too many properties for plain Java reflection to enumerate cleanly - the
    // project's own token objects (Radius) stay Map-based specifically to avoid
    // needing this in production code.
    testImplementation(libs.kotlin.reflect)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}

// R63 / R133 / R233 - the test-count floor. A canary per source set proves the
// source set RUNS; the floor proves the harness actually observed tests rather
// than exiting 0 having run none (the web project shipped a glob that matched no
// files while the suite went green). It reads the JUnit XML the run produced -
// its own output - and fails if fewer than the floor executed.
val unitTestFloor = 2

tasks.register("checkTestFloor") {
    dependsOn("testDebugUnitTest")
    doLast {
        val dir = layout.buildDirectory.dir("test-results/testDebugUnitTest").get().asFile
        val xmls = dir.listFiles { f -> f.extension == "xml" }?.toList() ?: emptyList()
        val total =
            xmls.sumOf { f ->
                Regex("""tests="(\d+)"""").find(f.readText())?.groupValues?.get(1)?.toInt() ?: 0
            }
        if (total < unitTestFloor) {
            throw GradleException(
                "test floor: expected >= $unitTestFloor unit tests, the run observed $total. " +
                    "A source set that runs no tests exits 0 and reads exactly like one that passed (R133).",
            )
        }
        println("test floor OK: $total unit tests observed (>= $unitTestFloor)")
    }
}
