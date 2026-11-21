// KMP-0 increment 1 (R368). The platform-free module. Kotlin Multiplatform with an Android target plus the
// iOS targets DECLARED now (iosArm64, iosSimulatorArm64), so the day iOS is built (R367) the shared engine,
// strings and dossier logic already compile for it. PACKAGE NAMES DO NOT CHANGE when code moves here from
// :app (ch.monreleve.app.calc stays ch.monreleve.app.calc), so no import in :app changes - the diff is file
// moves plus these build files.
//
// SETUP (R368/R136): com.android.library + org.jetbrains.kotlin.multiplatform, chosen for the reasons in
// the version catalog's comment on android-library. No version upgrade (the hard boundary): this reuses the
// AGP and Kotlin already on the classpath (2.0.21 when KMP-0 wrote this; the version catalog holds the
// current versions).
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.multiplatform)
    // KMP-1 increment 1 (R380). The kotlinx.serialization compiler plugin, applied to :shared so the moved
    // wire DTOs can be @Serializable. Nothing uses it yet in this increment - the DTOs land with the moves
    // (increments 4-6); applying it now, separately, keeps the toolchain change its own reviewable commit.
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    // KMP-2b increment 1 (R400). KSP, so Room's compiler can process @Entity/@Dao/@Database in this
    // module. Applied on its own, with NOTHING moved yet, so the toolchain change is reviewable
    // separately from the code that will depend on it. Version from the catalog (the ksp ref; KMP-UP2
    // moved it with Kotlin) - this line names no version, so it does not move with one.
    alias(libs.plugins.ksp)
    // IOS-1b-A R625. The Compose compiler (tracks the Kotlin version) and Compose Multiplatform 1.7.3, so the
    // shared Aujourd'hui screen compiles for Android and iOS from commonMain. Versions in the catalog.
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose.multiplatform)
}

// KMP-2b increment 1 (R400/R206). WHERE ROOM EXPORTS THIS MODULE'S SCHEMAS. The ksp-arg form, NOT the
// androidx.room Gradle plugin - :app chose the arg form deliberately (its own comment: "adds no second
// plugin, works under KSP1") and two modules declaring the same thing two ways is the drift R206 exists
// to prevent. The directory is created when the database actually moves here (R396); until then this
// module declares no @Database and Room exports nothing.
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

// KMP-0 increment 3 (R370). THE FIXTURES REACH COMMON TESTS WITHOUT FILE ACCESS. commonTest cannot read a
// file on iOS the way the JVM does, so each repo-root fixtures/*.json is turned into a Kotlin String constant
// that commonTest compiles. fixtures/ is the DECLARED INPUT (the same "sharedFixtures" rule :app's Test tasks
// use), so a fixture edit re-runs the generator and a stale constant cannot ship. The generated file lives
// under build/generated (ktlint/detekt skip it) and is wired into the commonTest source set below.
val sharedFixturesDir = rootProject.layout.projectDirectory.dir("../fixtures")
val generatedFixturesDir = layout.buildDirectory.dir("generated/fixtures/kotlin")

val generateFixtureConstants by tasks.registering {
    inputs.dir(sharedFixturesDir)
        .withPropertyName("sharedFixtures")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.dir(generatedFixturesDir)
    doLast {
        val packageDir =
            generatedFixturesDir.get().asFile.resolve("ch/monreleve/app/shared/fixtures")
        packageDir.mkdirs()
        val jsonFiles =
            sharedFixturesDir.asFile
                .listFiles { f -> f.isFile && f.extension == "json" }
                ?.sortedBy { it.name }
                ?: emptyList()
        // R169 presence: the generator must not emit an empty object from a wrong directory.
        check(jsonFiles.isNotEmpty()) {
            "generateFixtureConstants: no *.json under ${sharedFixturesDir.asFile} - nothing to generate"
        }

        fun constName(file: File): String =
            file.nameWithoutExtension.replace(Regex("[^A-Za-z0-9]"), "_").uppercase() + "_JSON"

        // Escape the raw JSON into a single Kotlin string literal: backslash and quote first, then the
        // dollar sign (so Kotlin never reads $x as interpolation), then newlines/tabs; carriage returns are
        // dropped so the constant is identical on every OS.
        fun escape(raw: String): String =
            raw
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("$", "\\$")
                .replace("\r", "")
                .replace("\n", "\\n")
                .replace("\t", "\\t")

        val out = StringBuilder()
        out.appendLine("package ch.monreleve.app.shared.fixtures")
        out.appendLine()
        out.appendLine("// GENERATED by :shared's generateFixtureConstants task (KMP-0 R370). DO NOT EDIT.")
        out.appendLine("// Source of truth: the repo-root fixtures/*.json, the SAME files the TypeScript engine")
        out.appendLine("// reads (R206). Regenerated whenever fixtures/ changes, so a constant cannot go stale.")
        out.appendLine()
        out.appendLine("internal object FixtureJson {")
        jsonFiles.forEach { file ->
            out.appendLine("    const val ${constName(file)}: String = \"${escape(file.readText())}\"")
        }
        out.appendLine()
        out.appendLine("    val ALL: Map<String, String> =")
        out.appendLine("        mapOf(")
        jsonFiles.forEach { file ->
            out.appendLine("            \"${file.name}\" to ${constName(file)},")
        }
        out.appendLine("        )")
        out.appendLine("}")
        packageDir.resolve("FixtureJson.kt").writeText(out.toString())
    }
}

kotlin {
    // KMP-2b increment 3 (R394/R400). Room 2.7 KMP builds a @Database around an `expect object`
    // RoomDatabaseConstructor whose `actual` its compiler GENERATES per target - the documented
    // form, and the only one that works on a platform with no reflection. Kotlin still marks
    // expect/actual CLASSES (objects included) Beta and warns once per declaration, so without this
    // flag every build carries two warnings: one for our declaration and one for Room's generated
    // actual, which is code we do not own and cannot annotate.
    //
    // R406 made the warning count an instrument - KMP-UP measured it going DOWN - and two permanent
    // warnings would quietly spend that. The flag silences the Beta notice and changes no codegen.
    compilerOptions {
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    // The Android target. matches :app's JVM target 17; its testDebugUnitTest runs commonTest + the
    // Android unit-test source set on the JVM (where moved Kotest specs live, R373).
    androidTarget {
        // KMP-2b: the SAME target, 17, through the compilerOptions DSL. compilations.all { kotlinOptions }
        // is deprecated and the Kotlin Gradle plugin says so on every build that configures compilerOptions
        // - which this file now does, for the flag above. R406 counts warnings; adding one while removing
        // two would be a wash nobody chose. The value does not move, only the DSL that sets it.
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }
    // R369: the iOS targets are DECLARED here; their klibs, Room's iOS code generation and the simulator
    // test run happen on a Mac (.github/workflows/ios-shared.yml). KMP-DT R575: a Windows host does NOT
    // compile the iOS klibs - kotlin.native.enableKlibsCrossCompilation=false in android/gradle.properties
    // turns off the cross-platform klib compilation Kotlin 2.2.20 made the default, so compileKotlinIos* is
    // SKIPPED here (between KMP-UP2 and R575 it ran, without Room's generated actual, proving nothing). The
    // proof the moved code is platform-free is the COMMON METADATA compilation
    // (compileCommonMainKotlinMetadata), which compiles commonMain against the common stdlib only and so
    // rejects any java./android. reference; that task runs in :app:gate. What only a Mac can prove is
    // printed in the gate's "skipped, with reason" list rather than silently omitted (R133).
    //
    // IOS-HOST R1210. THE iOS APP'S FRAMEWORK: both iOS targets build a STATIC framework named "Shared" (the Swift
    // module the app imports, ios/MonReleve/Sources). Static, as JetBrains' KMP and Compose templates declare it: it is
    // linked into the app binary rather than embedded, and Xcode's pre-build script (ios/project.yml) runs
    // embedAndSignAppleFrameworkForXcode, whose disabled-for-static action still pulls in the link and Compose's
    // resource sync into the .app. NOTHING IN THE ANDROID BUILD MOVES: on a Windows host the Apple link tasks are
    // registered but disabled and the Xcode tasks are not registered at all (REPORT-IOS-HOST-CENSUS R1203 item 2), and
    // neither :app:gate nor fastCheck names a link task - REPORT-IOS-HOST R1210 diffs both dry-run task lists.
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    sourceSets {
        // KMP-0 increment 6 (R371). kotlinx-datetime is api() so :app receives the shared calendar types
        // transitively: the moved dossier/forecast functions take kotlinx.datetime.LocalDate/DayOfWeek, and
        // :app maps its java.time values to them at the boundary (R372). The ONE new runtime dependency the
        // hard boundary permits; :app keeps java.time for everything that stays.
        commonMain.dependencies {
            api(libs.kotlinx.datetime)
            // KMP-1 increment 1 (R380). The JSON runtime for the moved wire code. implementation(), NOT api():
            // :app must not see kotlinx.serialization on its compile classpath (its remaining code keeps
            // org.json); only :shared's moved files use it. Nothing imports it yet - the DTOs arrive with the
            // moves (increments 4-6). It reaches :app's runtime classpath transitively, so the release APK
            // carries it and checkMinifiedWireContract (R307) exercises the minified result.
            implementation(libs.kotlinx.serialization.json)
            // KMP-2b increment 1 (R400). room-runtime IS the multiplatform artefact at 2.7 - it publishes
            // -android, -iosarm64 and -iossimulatorarm64 - so commonMain can hold the entities, DAOs and
            // the database itself. No new catalog entry and no version change: this is the same
            // androidx.room 2.7.2 :app already depends on.
            //
            // implementation(), not api(): :app declares room-runtime itself, so nothing about its
            // compile classpath changes when the database moves here.
            implementation(libs.androidx.room.runtime)
            // IOS-1b-A R625. Compose Multiplatform 1.7.3 - the toolkit the shared screen is written in. api(),
            // because :app hosts the shared composables and passes Modifier/Composable types across.
            api(libs.cmp.runtime)
            api(libs.cmp.ui)
            api(libs.cmp.foundation)
            api(libs.cmp.animation)
            api(libs.cmp.material3)
            // IOS-1b-A R603: the resources runtime the generated Res class compiles against (design/Glyph.kt). Only iOS
            // reads a resource through it; on Android its ContentProvider is removed from the merged manifest.
            implementation(libs.cmp.components.resources)
        }
        commonTest {
            // KMP-0 increment 3 (R370): the generated fixture constants are a commonTest source dir. Passing
            // the task provider wires both the directory and the task dependency, so the constants are
            // regenerated before commonTest compiles.
            kotlin.srcDir(generateFixtureConstants)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            // KMP-1 increment 4 (R383). runTest, to drive the moved AuthApi's suspend functions in commonTest
            // through an in-memory HttpTransport fake - so the auth client's behaviour is proven on COMMON code,
            // not only through the Android transport. TEST-ONLY, and NOT a new version: it reuses the coroutines
            // pin (1.8.1) :app already declares; runTest is kotlinx-coroutines-test's common API since 1.6.
            implementation(libs.kotlinx.coroutines.test)
        }
        // KMP-0 increment 2 (R369). The commonMain platform-free FENCE lives in the Android unit-test source
        // set, because it reads the commonMain source files as TEXT (java.io.File), which commonTest cannot do
        // portably. kotlin.test is declared here explicitly rather than relied on transitively from commonTest.
        // IOS-1b-A R606: the shared screen is composed and tapped on the simulator (pilot/AujourdhuiPilotIosTest).
        iosTest.dependencies {
            implementation(libs.cmp.ui.test)
        }
        iosMain.dependencies {
            // IOS-1a R567: the one approved new dependency, on iOS ONLY. Android keeps its own SQLite.
            implementation(libs.androidx.sqlite.bundled)
        }
        androidUnitTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

// KMP-2b increment 1 (R400). THE iOS TARGETS ARE DECLARED FOR ROOM, NOT BUILT. KSP runs per TARGET, not per
// source set, so the Room compiler is added to each target's own configuration - the documented Room KMP
// form. The two iOS entries do not run on this Windows host - KSP's iOS tasks are SKIPPED off a Mac, and since
// KMP-DT R575 so is the iOS klib compile itself (kotlin.native.enableKlibsCrossCompilation=false) - which is
// the point of declaring them NOW: the Mac in ios-shared.yml builds this with no build file changes.
//
// WHAT REMAINS UNPROVEN UNTIL A MAC RUNS IT, stated plainly rather than implied by silence (R133):
// that Room's compiler actually GENERATES a working implementation for iosArm64 and iosSimulatorArm64.
// This file declares the wiring; only a Mac executes it. The Android half is proven by the gate.
//
// NO KSP MODE CHANGE. The mode is KSP1, and since KMP-UP2 it is STATED rather than defaulted:
// ksp.useKSP2=false in android/gradle.properties, because from KSP 2.1.20-2.0.0 the default is KSP2 and an
// unset flag would have changed the mode silently with the version. It is not set here, and it is never
// flipped to reach green. Room 2.7 ADDED KSP2 support and recommends it; it does not require it, so KSP1
// stands. If Room's compiler ever demands KSP2, that is a STOP and a question, never a flag quietly flipped.
dependencies {
    add("kspAndroid", libs.androidx.room.compiler)
    add("kspIosArm64", libs.androidx.room.compiler)
    add("kspIosSimulatorArm64", libs.androidx.room.compiler)
}

// KMP-0 increment 2 (R369/R283). The fence test (CommonMainFenceTest) reads shared/src/commonMain as TEXT, so
// a NEW commonMain file carrying a forbidden import must RE-RUN the fence rather than leaving the test task
// UP-TO-DATE - the same R283 discipline :app applies to its source-scanning fences. Declaring the tree as a
// test input makes the text-scanning assertion re-run on any commonMain edit, not only the ones that recompile.
tasks.withType<Test>().configureEach {
    // IOS-1b-A R603: GlyphResourceGeneratorTest reads the generator's real output and the app drawables it copies.
    dependsOn("generateGlyphResources")
    inputs.dir(rootProject.layout.projectDirectory.dir("app/src/main/res/drawable"))
        .withPropertyName("appDrawablesForGlyphTest")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(layout.projectDirectory.dir("src/commonMain/kotlin"))
        .withPropertyName("commonMainSourceForFence")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // IOS-2f R889/R892, IOS-MOVE-TWINS R1242: MovedTwinsFenceTest (which replaced IosAndroidTwinsTest when the three
    // twins moved to commonMain) reads iosMain and every :app source set for a copy that came back, so an edit in
    // either tree must re-run it - the same R283 discipline, for both trees it reads.
    inputs.dir(layout.projectDirectory.dir("src/iosMain/kotlin"))
        .withPropertyName("iosMainSourceForTwins")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rootProject.layout.projectDirectory.dir("app/src"))
        .withPropertyName("appSourceForTwins")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-SHARED-FIXES R1092 (R283): FilenameOfServerNamesTest derives every export filename the server sends from
    // web/'s own source - each content-disposition template under web/app and web/lib, and the csvFilename names
    // web/'s csv.test.ts expects - so a server rename must re-run it rather than leave this task UP-TO-DATE.
    inputs.dir(rootProject.layout.projectDirectory.dir("../web/app"))
        .withPropertyName("webRoutesForFilenames")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rootProject.layout.projectDirectory.dir("../web/lib"))
        .withPropertyName("webLibForFilenames")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(rootProject.layout.projectDirectory.file("../web/tests/unit/export/csv.test.ts"))
        .withPropertyName("webCsvFilenameExpectations")
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
        layout.projectDirectory.dir("src/iosMain/kotlin"),
        layout.projectDirectory.dir("src/iosTest/kotlin"),
        layout.projectDirectory.dir("src/androidUnitTest/kotlin"),
    )
}

// IOS-1a R565. THE KEYCHAIN NEEDS A BOOTED SIMULATOR. The Kotlin Gradle plugin runs the iOS test binary with
// `xcrun simctl spawn --standalone <device>`, a bare process with no launchd, no securityd and therefore no
// keychain: every SecItem call answered errSecNotAvailable (-25291) in IOS-1a's first cloud run. When the workflow
// passes a device (it boots one first), the tests run non-standalone INSIDE that booted simulator instead. Nothing
// changes on any other machine: with no property set, the plugin's defaults apply untouched.
providers.gradleProperty("iosSimulatorDevice").orNull?.let { udid ->
    tasks.withType<org.jetbrains.kotlin.gradle.targets.native.tasks.KotlinNativeSimulatorTest>().configureEach {
        device.set(udid)
        standalone.set(false)
    }
}

// IOS-1a R565 (second half). With the simulator booted the Keychain answers - but an UNSIGNED test binary has no
// keychain access group and every call fails errSecMissingEntitlement (-34018). The simulator reads a binary's
// entitlements from a Mach-O section (__TEXT,__entitlements), which is how Xcode embeds them for simulator builds,
// so in CI only (the same property) the test executable is linked with ios-test.entitlements in that section. The
// linker's own ad-hoc signature then covers it. Test binary only: it never reaches an app, no Apple account.
// (Signing it afterwards with `codesign --entitlements` was tried first and the simulator refused to spawn it:
// "Codesigning issue", launchd code 162.)
providers.gradleProperty("iosSimulatorDevice").orNull?.let {
    val entitlements = layout.projectDirectory.file("ios-test.entitlements").asFile.absolutePath
    kotlin.iosSimulatorArm64().binaries.getTest("DEBUG").linkerOpts(
        "-sectcreate",
        "__TEXT",
        "__entitlements",
        entitlements,
    )
}

// IOS-1b-A R603. iOS DRAWS THE APP'S OWN GLYPH FILES (design/Glyph.kt; REPORT-IOS-1b-A DEVIATION 4 / Q2).
//
// The Lucide drawables' one home stays app/src/main/res/drawable, because Aujourd'hui's instrumented tests assert
// literal ch.monreleve.app.R.drawable ids (a hard boundary). This task COPIES them - every ic_*.xml except the
// launcher's - into a generated directory registered below as iosMain's Compose Multiplatform resources, so iOS
// renders the very same path data Android does. Derived at build time, never a second hand-kept copy (R181/R206);
// GlyphResourceGeneratorTest proves the copy delivered each file's paths unchanged (R154). The XML is Android's
// vector-drawable format, which Compose Multiplatform's resource loader reads as is - no conversion step exists to
// change a path.
val appDrawables = rootProject.layout.projectDirectory.dir("app/src/main/res/drawable")
val generatedGlyphResources = layout.buildDirectory.dir("generated/glyphResources")

val generateGlyphResources by tasks.registering(Sync::class) {
    from(appDrawables) {
        include("ic_*.xml")
        exclude("ic_launcher*")
    }
    into(generatedGlyphResources.map { it.dir("drawable") })
}

compose.resources {
    packageOfResClass = "ch.monreleve.app.shared.resources"
    generateResClass = always
    customDirectory(
        sourceSetName = "iosMain",
        directoryProvider = generatedGlyphResources,
    )
}

// Every Compose resource task may read the generated directory, so each runs after the copy that fills it (Gradle
// refuses an undeclared dependency - measured: copyNonXmlValueResourcesForIosMain was the first to trip it).
tasks.configureEach {
    if (name != "generateGlyphResources" && name.contains("Resource")) {
        dependsOn(generateGlyphResources)
    }
}
