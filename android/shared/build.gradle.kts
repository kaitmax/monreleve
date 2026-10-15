// KMP-0 increment 1 (R368). The platform-free module. Kotlin Multiplatform with an Android target plus the
// iOS targets DECLARED now (iosArm64, iosSimulatorArm64), so the day iOS is built (R367) the shared engine,
// strings and dossier logic already compile for it. PACKAGE NAMES DO NOT CHANGE when code moves here from
// :app (ch.monreleve.app.calc stays ch.monreleve.app.calc), so no import in :app changes - the diff is file
// moves plus these build files.
//
// SETUP (R368/R136): com.android.library + org.jetbrains.kotlin.multiplatform, chosen for the reasons in
// the version catalog's comment on android-library. No version upgrade (the hard boundary): this reuses the
// AGP 8.10.1 and Kotlin 2.0.21 already on the classpath.
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

kotlin {
    // The Android target. matches :app's JVM target 17; its testDebugUnitTest runs commonTest + the
    // Android unit-test source set on the JVM (where moved Kotest specs live, R373).
    androidTarget {
        compilations.all {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }
    // R369: the iOS targets are DECLARED now but NOT compiled on this Windows host - Kotlin/Native cannot
    // produce iOS binaries off a Mac. The proof the moved code is platform-free is the COMMON METADATA
    // compilation (compileCommonMainKotlinMetadata), which compiles commonMain against the common stdlib only
    // and so rejects any java./android. reference; that task runs in :app:gate. The iOS compile tasks are
    // printed in the gate's "skipped, with reason" list rather than silently omitted (R133).
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
        // KMP-0 increment 2 (R369). The commonMain platform-free FENCE lives in the Android unit-test source
        // set, because it reads the commonMain source files as TEXT (java.io.File), which commonTest cannot do
        // portably. kotlin.test is declared here explicitly rather than relied on transitively from commonTest.
        androidUnitTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

// KMP-0 increment 2 (R369/R283). The fence test (CommonMainFenceTest) reads shared/src/commonMain as TEXT, so
// a NEW commonMain file carrying a forbidden import must RE-RUN the fence rather than leaving the test task
// UP-TO-DATE - the same R283 discipline :app applies to its source-scanning fences. Declaring the tree as a
// test input makes the text-scanning assertion re-run on any commonMain edit, not only the ones that recompile.
tasks.withType<Test>().configureEach {
    inputs.dir(layout.projectDirectory.dir("src/commonMain/kotlin"))
        .withPropertyName("commonMainSourceForFence")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}

android {
    namespace = "ch.monreleve.app.shared"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// ktlint skips generated output, matching :app (KMP-1 and the fixtures generator will write generated Kotlin
// under build/generated; it is not ours to format).
ktlint {
    filter {
        exclude { element -> element.file.path.contains("generated") }
    }
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom("$rootDir/config/detekt/detekt.yml")
    // A KMP module does not use the JVM src/main layout detekt's default `detekt` task scans, so without
    // this the task reports NO-SOURCE and silently checks nothing (the FW-class defect of a guard that
    // passes vacuously). Point it at the multiplatform source sets explicitly. Dirs that do not exist yet
    // (androidMain, androidUnitTest) are harmless - detekt just finds no files there until code moves in.
    source.setFrom(
        layout.projectDirectory.dir("src/commonMain/kotlin"),
        layout.projectDirectory.dir("src/commonTest/kotlin"),
        layout.projectDirectory.dir("src/androidMain/kotlin"),
        layout.projectDirectory.dir("src/androidUnitTest/kotlin"),
    )
}
