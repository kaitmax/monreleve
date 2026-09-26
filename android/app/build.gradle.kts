plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    alias(libs.plugins.paparazzi)
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

// AN2: Kotest's runner requires the JUnit Platform. Without this, Gradle's
// default JUnit 4 runner would simply not discover Kotest specs at all -
// zero of them would run, silently, with a green build (R133) - which is
// exactly why checkTestFloor below reads the real count rather than trusting
// the exit code.
tasks.withType<Test> {
    useJUnitPlatform()
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
    // AN2, TEST-ONLY (same precedent as kotlin-reflect above): the engine's
    // conformance suite and its eight SPEC 7.6 property invariants, matching
    // the web engine's own fast-check property tests. Kotest requires the
    // JUnit Platform (see useJUnitPlatform() below); junit-vintage-engine
    // bridges the existing JUnit 4 test files onto it so none of them go
    // silently unrun.
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.kotest.property)
    testRuntimeOnly(libs.junit.vintage.engine)
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
// its own output - and fails if fewer than the floor executed. Raised from 2 to
// 10 in increment 6: the real count is 15 (2 canary, 3 radius, 2 theme census,
// 7 fences, 1 screenshot); 2 protected against zero but not against a config
// regression that silently dropped most of a source set while two canaries
// kept passing.
val unitTestFloor = 10

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

// AN1 increment 6: one command for everything the Android gate governs,
// printing what it ran AND WHAT IT SKIPPED with reasons (R133 - gate:clone,
// the web equivalent, once reported PASSED having silently skipped every
// database suite; only the printed selection caught it).
tasks.register("gate") {
    dependsOn("assembleDebug", "testDebugUnitTest", "checkTestFloor", "ktlintCheck", "detekt", "verifyPaparazziDebug")
    doLast {
        println(
            """
            |
            |ANDROID GATE
            |RAN: assembleDebug, testDebugUnitTest (includes the six fences in
            |     FencesTest.kt and the theme/radius censuses), checkTestFloor,
            |     ktlintCheck, detekt, verifyPaparazziDebug (the screenshot
            |     baseline - a regression guard, never proof of correctness; R135).
            |SKIPPED, with reason:
            |  - scripts/emulator.sh / screenshot.sh / walkthrough.sh (the AC2
            |    instrument): needs a real AVD with hardware acceleration. Not a
            |    Gradle task by construction - its whole point is a person driving
            |    it and looking at the PNG (R176/R177), which an unattended gate
            |    task cannot do.
            |  - connectedDebugAndroidTest (the instrumented canary,
            |    CanaryInstrumentedTest.kt): same reason, needs a running device.
            |    Exercised by the emulator instrument, not this gate.
            """.trimMargin(),
        )
    }
}
