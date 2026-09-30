plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    alias(libs.plugins.paparazzi)
}

// AN5 increment 1. exportSchema = true writes the room schema JSON here; R187
// makes it a contract with every device that installs a release, so it is
// committed and RoomSchemaContractTest reads it back in the JVM gate. The
// ksp-arg form (not the room-gradle-plugin) is deliberate: it adds no second
// plugin, works under KSP1 - which 2.0.21-1.0.28 selects by default - and the
// generated file is confirmed to land before the freeze test's expectations
// were written (advisor point 3; see REPORT-AN5.txt).
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
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
        debug {
            // AN4 increment 1 (AC3). The emulator reaches the host's `pnpm dev` at
            // 10.0.2.2; the port is a gradle property (default 3000) so a neighbour
            // holding 3000 moves this build rather than stopping theirs - R170's
            // shape on the Android side. Cleartext to this host is permitted only
            // by src/debug/res/xml/network_security_config.xml; the release sibling
            // denies all cleartext, proven by checkReleaseCleartext.
            val frontalierPort = (project.findProperty("frontalierPort") as String?) ?: "3000"
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:$frontalierPort\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // The real domain over HTTPS. No cleartext exists in this build
            // (src/release/res network security config denies it everywhere).
            buildConfigField("String", "API_BASE_URL", "\"https://monreleve.ch\"")
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
        // AN4 increment 1: BuildConfig.API_BASE_URL carries the per-build-type base URL.
        buildConfig = true
    }
    // AN5 increment 1: MigrationTestHelper reads the exported schema JSON at
    // runtime from the test APK's assets, so the schemas/ directory must be an
    // androidTest asset source. Without this the harness fails on-device with
    // "Cannot find the schema file" even though the JSON is committed.
    sourceSets {
        getByName("androidTest") {
            assets.srcDir("$projectDir/schemas")
        }
    }
}

// AN5 increment 1: KSP writes Room's DAO/database implementations under
// build/generated/ksp, which the ktlint plugin would otherwise scan and fail on
// (generated code does not follow this project's style, and it is not ours to
// format). detekt's default source set does not include generated output, so it
// needs no equivalent.
ktlint {
    filter {
        exclude { element -> element.file.path.contains("generated") }
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
    // ANY FILE A TEST READS IS A DECLARED TASK INPUT (R283). A test reading a file Gradle does not
    // track as an input passes UP-TO-DATE after that file changes: the assertion goes unrun and a
    // divergence ships green. AN5b found this on the shared fixtures (the Kotlin task skipped at 3s
    // while the TypeScript suite went red); AN5c's increment 0 audited EVERY test that reads a file
    // outside its compiled classpath and declares each here. Proven the same way: planting a one-digit
    // change to web/lib/entries/schema.ts left this task UP-TO-DATE before this block listed it, and
    // re-ran it after (REPORT-AN5c.txt R283).
    //
    // The shared conformance fixtures (fixtures/*.json at the repo root) - the SAME files the
    // TypeScript side reads (R206) - read by the calc and dossier suites and AN5c's late-threshold
    // suite. This also closes the same latent gap for AN2's frozen geneva-cases.json.
    inputs.dir(rootProject.layout.projectDirectory.dir("../fixtures"))
        .withPropertyName("sharedFixtures")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // The frozen server contract (web/lib/entries/schema.ts), read by WireContractParityTest and
    // BatchLimitParityTest to derive the wire vocabulary and the batch/note limits from ONE home on
    // the server side (R181/R187). This was the live R283 gap: a schema change re-runs these now.
    inputs.file(rootProject.layout.projectDirectory.file("../web/lib/entries/schema.ts"))
        .withPropertyName("serverEntrySchema")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // The field-protocol doc (docs/field-protocol-AN6b.md), read by TierThresholdParityTest to keep
    // the human-facing tier thresholds and the code's in agreement.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/field-protocol-AN6b.md"))
        .withPropertyName("fieldProtocolDoc")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // In-module DATA read as text with no compile dependency: the exported Room schema
    // (RoomSchemaContractTest), the bundled border polygon (BorderPolygon/Classification/DetectionSession
    // tests), and the backup rules XML (BackupRulesTest). A manual edit to any of these recompiles
    // nothing, so without these it would leave this task UP-TO-DATE.
    inputs.dir("$projectDir/schemas")
        .withPropertyName("roomSchemas")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("$projectDir/src/main/assets")
        .withPropertyName("bundledAssets")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("$projectDir/src/main/res/xml")
        .withPropertyName("resXml")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // The source-scanning fences (FencesTest, LogFenceTest, the copy guards, NoBareThresholdTest) and
    // WarningsTest read src/main/kotlin as TEXT. A NEW violation is always a semantic change that
    // recompiles and re-runs this task; but a comment-only change (WarningsTest asserts the absence of
    // a "PROVISIONAL TRIGGER" comment, which it does NOT strip) recompiles nothing. Declaring the tree
    // makes every text-scanning assertion re-run on any source edit, so R283 holds literally, not only
    // for the cases that happen to recompile.
    inputs.dir("$projectDir/src/main/kotlin")
        .withPropertyName("scannedMainSource")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN10b (R294): the register (parking.md) and every REPORT-*.txt at the repo root, read by
    // RegisterCoverageTest to check that every PARK-/PARKAN- id a report cites has a real entry. The
    // report set is enumerated at configuration time (the repo root's direct children only - no
    // recursive walk into node_modules or build/), so a new report added tomorrow is declared the day
    // it lands, and REPORT-AN10b.txt itself joins the input set the moment it is written (R283/R182).
    val repoRootDir = rootProject.layout.projectDirectory.dir("..").asFile
    val reportFiles =
        repoRootDir
            .listFiles { f -> f.isFile && f.name.startsWith("REPORT-") && f.name.endsWith(".txt") }
            ?.toList()
            ?: emptyList()
    inputs.files(reportFiles + repoRootDir.resolve("parking.md"))
        .withPropertyName("registerAndReports")
        .withPathSensitivity(PathSensitivity.RELATIVE)
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
    // AN4 increment 1: the transport wraps the platform HttpsURLConnection in
    // withContext(Dispatchers.IO). Explicit rather than transitive (see catalog).
    implementation(libs.kotlinx.coroutines.android)
    // AN5 increment 1: the offline record store (data/local). room-ktx brings the
    // suspend/Flow DAO extensions; room-compiler runs as the KSP processor.
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    // AN5 increment 3: the offline-queue drain (data/sync). CoroutineWorker + the
    // unique, network-constrained, backing-off work request.
    implementation(libs.androidx.work.runtime.ktx)
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
    // AN2, TEST-ONLY: the real JVM org.json, so the conformance suites can
    // read fixtures/*.json under plain JVM unit tests, where android.jar's
    // own org.json classes are stubbed to throw "not mocked".
    testImplementation(libs.json.org)
    // AN4 increment 1, TEST-ONLY: runTest + StandardTestDispatcher for the
    // single-flight refresh proof (increment 5) and any suspend seam under test.
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    // AN5 increment 1: MigrationTestHelper (the R187 migration harness). On-device
    // only - it validates the exported schema against a real SQLite database, which
    // is why the JVM gate skips it with a reason, as it does connectedDebugAndroidTest.
    androidTestImplementation(libs.androidx.room.testing)
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
// AN4 increment 1 (AC3). The release build must permit cleartext NOWHERE. This
// reads the MERGED release manifest (processReleaseManifest's output, not the
// source - the merger or a library could introduce usesCleartextTraffic) AND the
// release network security config, and fails if cleartext is permitted anywhere.
// R182: it dependsOn the task that PRODUCES its subject, so it never runs before
// the merged manifest exists. Proven by planting cleartextTrafficPermitted="true"
// and watching it go red (R180), recorded in REPORT-AN4.txt.
tasks.register("checkReleaseCleartext") {
    dependsOn("processReleaseManifest")
    doLast {
        val problems = mutableListOf<String>()

        // Strip XML comments before matching. The first run of this task tripped
        // on its OWN documentation: the release config's comment names
        // cleartextTrafficPermitted="true" as the string to plant, and a guard
        // that reads its own prose as a violation is the FW22 size-regex shape
        // (a positive signal not specific enough that only the real thing produces
        // it). The subject is the elements, never the comments around them.
        val stripComments = { text: String -> text.replace(Regex("""(?s)<!--.*?-->"""), "") }

        val manifestDir = layout.buildDirectory.dir("intermediates/merged_manifest/release").get().asFile
        val mergedManifest = manifestDir.walkTopDown().firstOrNull { it.name == "AndroidManifest.xml" }
        if (mergedManifest == null) {
            throw GradleException(
                "checkReleaseCleartext: no merged release manifest under $manifestDir - " +
                    "processReleaseManifest did not produce its output",
            )
        }
        val manifestText = stripComments(mergedManifest.readText())
        if (Regex("""usesCleartextTraffic\s*=\s*"true"""").containsMatchIn(manifestText)) {
            problems += "merged release manifest sets android:usesCleartextTraffic=\"true\" ($mergedManifest)"
        }

        val nsc = file("src/release/res/xml/network_security_config.xml")
        if (!nsc.exists()) {
            problems += "release network security config missing at $nsc"
        } else {
            val nscText = stripComments(nsc.readText())
            if (Regex("""cleartextTrafficPermitted\s*=\s*"true"""").containsMatchIn(nscText)) {
                problems += "release network security config permits cleartext (cleartextTrafficPermitted=\"true\")"
            }
            if (!Regex("""cleartextTrafficPermitted\s*=\s*"false"""").containsMatchIn(nscText)) {
                problems +=
                    "release network security config does not EXPLICITLY deny cleartext - minSdk 26 " +
                    "defaults to permitted, so an absent cleartextTrafficPermitted=\"false\" is not a denial"
            }
        }

        if (problems.isNotEmpty()) {
            throw GradleException(
                "checkReleaseCleartext FAILED - cleartext must be permitted NOWHERE in the release build:\n" +
                    problems.joinToString("\n") { "  - $it" },
            )
        }
        println("checkReleaseCleartext OK: release permits cleartext nowhere (merged manifest + network security config)")
    }
}

// R284 guard (b). The debug session injection (SessionInjectionActivity, declared only in
// src/debug/AndroidManifest.xml) must never reach a release build. This reads the MERGED release
// manifest (processReleaseManifest's output - the merger or a library could introduce a component the
// source does not) and fails if the injection is present anywhere in it. R182: it dependsOn the task
// that PRODUCES its subject, so it never runs before the merged manifest exists. The companion source
// scan is NoDebugInjectionInMainTest (guard a); this is the merged-output guard, exactly the shape of
// checkReleaseCleartext (AN4). Proven by planting the activity in src/main/AndroidManifest.xml and
// watching it go red (R180), recorded in REPORT-AN5c.txt.
tasks.register("checkReleaseNoDebugInjection") {
    dependsOn("processReleaseManifest")
    doLast {
        // Strip XML comments before matching, the checkReleaseCleartext lesson: a guard that reads its
        // own documentation as a violation is the FW22 size-regex shape. The subject is the elements.
        val stripComments = { text: String -> text.replace(Regex("""(?s)<!--.*?-->"""), "") }
        val marker = "SessionInjection"

        val manifestDir = layout.buildDirectory.dir("intermediates/merged_manifest/release").get().asFile
        val mergedManifest = manifestDir.walkTopDown().firstOrNull { it.name == "AndroidManifest.xml" }
        if (mergedManifest == null) {
            throw GradleException(
                "checkReleaseNoDebugInjection: no merged release manifest under $manifestDir - " +
                    "processReleaseManifest did not produce its output",
            )
        }
        val manifestText = stripComments(mergedManifest.readText())
        if (manifestText.contains(marker)) {
            throw GradleException(
                "checkReleaseNoDebugInjection FAILED - the debug session injection ('$marker') is " +
                    "present in the merged RELEASE manifest ($mergedManifest). It must exist only in " +
                    "the debug source set (R284): a release build that could be handed a session " +
                    "bypasses sign-in entirely.",
            )
        }
        println("checkReleaseNoDebugInjection OK: no debug session injection in the merged release manifest")
    }
}

// R298 (answers PARKAN-29). The licences list stays HAND-WRITTEN (LicencesCopy), and this check DERIVES the
// obligation from the build: it resolves the app's RELEASE runtime dependencies and fails when one is not
// covered by a component named on the licences screen. No plugin, no new dependency - Gradle already resolves
// the classpath. The covered-prefix -> screen-phrase map is the ONE tie to the screen (R206): each phrase must
// appear in LicencesCopy.kt (so removing an attribution fails here too), and each resolved module must match a
// covered prefix (so a NEW dependency with no attribution fails here - which is how the first run found
// guava/annotations/jspecify bundled but uncredited, R178). The resolution runs at EXECUTION time, and the
// resolutionResult is used rather than resolvedArtifacts so no artifact is downloaded or transformed to read a
// coordinate. R182: nothing produces its subject, so it needs no dependsOn to be correctly ordered.
tasks.register("checkLicences") {
    val licencesCopy = layout.projectDirectory.file("src/main/kotlin/ch/monreleve/app/fr/LicencesCopy.kt").asFile
    val runtimeClasspath = configurations.named("releaseRuntimeClasspath")
    inputs.file(licencesCopy)
    inputs.files(runtimeClasspath)
    doLast {
        // A resolved module's group is covered by prefix P when group == P or group starts with "P." - a
        // segment boundary, so "org.jetbrains.kotlin" does not swallow "org.jetbrains.kotlinx".
        val covered =
            linkedMapOf(
                "androidx.compose" to "Jetpack Compose",
                "androidx" to "AndroidX",
                "com.google.guava" to "Guava",
                "org.jetbrains.kotlinx" to "kotlinx.coroutines",
                "org.jetbrains.kotlin" to "Kotlin",
                "org.jetbrains" to "JetBrains",
                "org.jspecify" to "JSpecify",
            )
        val copyText = licencesCopy.readText()

        val missingPhrases = covered.values.filter { it !in copyText }
        if (missingPhrases.isNotEmpty()) {
            throw GradleException(
                "checkLicences: LicencesCopy.kt no longer names " + missingPhrases.joinToString(", ") +
                    " - the check credits these components, so the screen must too (R206).",
            )
        }

        val modules =
            runtimeClasspath.get().incoming.resolutionResult.allComponents
                .map { it.id }
                .filterIsInstance<org.gradle.api.artifacts.component.ModuleComponentIdentifier>()
        val uncovered =
            modules
                .filter { id -> covered.keys.none { p -> id.group == p || id.group.startsWith("$p.") } }
                .map { "${it.group}:${it.module}" }
                .toSortedSet()
        if (uncovered.isNotEmpty()) {
            throw GradleException(
                "checkLicences FAILED - release runtime dependencies with no entry on the licences screen (R298):\n" +
                    uncovered.joinToString("\n") { "  - $it" } +
                    "\nAdd each to LicencesCopy and this task's covered map, or remove the dependency.",
            )
        }
        println("checkLicences OK: ${modules.size} release runtime modules, each attributed on the licences screen")
    }
}

tasks.register("gate") {
    dependsOn(
        "assembleDebug",
        "testDebugUnitTest",
        "checkTestFloor",
        "ktlintCheck",
        "detekt",
        "verifyPaparazziDebug",
        "checkReleaseCleartext",
        "checkReleaseNoDebugInjection",
        "checkLicences",
    )
    doLast {
        println(
            """
            |
            |ANDROID GATE
            |RAN: assembleDebug, testDebugUnitTest (includes the fences in
            |     FencesTest.kt and the theme/radius censuses), checkTestFloor,
            |     ktlintCheck, detekt, verifyPaparazziDebug (the screenshot
            |     baseline - a regression guard, never proof of correctness; R135),
            |     checkReleaseCleartext (AC3: the release build permits cleartext
            |     nowhere - merged manifest + network security config, R182),
            |     checkReleaseNoDebugInjection (R284 guard b: the debug session
            |     injection is absent from the merged release manifest),
            |     checkLicences (R298: every release runtime dependency is
            |     attributed on the licences screen, derived from the build).
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
