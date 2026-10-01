import java.io.ByteArrayOutputStream
import java.util.zip.ZipFile

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
        // AN14a increment 5. Google Play requires new apps and app updates to target Android 16 (API 36) or
        // higher, EFFECTIVE 2026-08-31 (already in force). Verified from Google's own page, not memory or the
        // prompt: https://developer.android.com/google/play/requirements/target-sdk - fetched 2026-10-01,
        // verbatim: "New apps and app updates must target Android 16 (API level 36) or higher to be submitted
        // to Google Play". An extension to 2026-11-01 is offered via Play Console; this app targets 36 now
        // rather than relying on it. The API 35 -> 36 runtime behaviour changes (edge-to-edge is already
        // handled from AN1's targetSdk 35) are OWED an emulator pass - the gate proves it compiles and the
        // unit/paparazzi suites pass, not that every 36 behaviour is exercised on a device.
        targetSdk = 36
        // AN14a increment 5. versionCode MUST strictly increase with every Play upload, forever (Play rejects
        // an upload whose code is <= the highest already uploaded), and the ceiling is 2_100_000_000. THE
        // SCHEME: a plain monotonic integer, +1 per uploaded build, never reused and never decreased - the
        // simplest rule that cannot be got wrong, and it leaves the whole 2.1-billion range. It is NOT derived
        // from versionName (a semver bump must not force a code jump) nor from the wall clock (opaque, and two
        // builds in one minute would collide). It stays 1 until the first upload (AN14b); reversible until
        // then. When AN14b wires CI, the counter can move to a CI build number, which is still monotonic.
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // AN14a increment 5 (R250 - NO KEY IS CREATED HERE). The release signing config reads the keystore from
    // Gradle properties OR the environment; when none is present it is NOT created and the release build gets
    // no signingConfig, so it stays UNSIGNED - app-release-unsigned.apk, exactly as before this task. The real
    // upload/signing key is the operator's to make (AN14b), supplied as RELEASE_STORE_FILE /
    // RELEASE_STORE_PASSWORD / RELEASE_KEY_ALIAS / RELEASE_KEY_PASSWORD (a gradle property or an env var).
    // gate:clone scrubs the environment and a clone carries no gradle.properties secret, so a clean checkout
    // is unsigned BY CONSTRUCTION. The seam exists; the key does not.
    val releaseStoreFile = (findProperty("RELEASE_STORE_FILE") as String?) ?: System.getenv("RELEASE_STORE_FILE")
    val releaseStorePassword =
        (findProperty("RELEASE_STORE_PASSWORD") as String?) ?: System.getenv("RELEASE_STORE_PASSWORD")
    val releaseKeyAlias = (findProperty("RELEASE_KEY_ALIAS") as String?) ?: System.getenv("RELEASE_KEY_ALIAS")
    val releaseKeyPassword =
        (findProperty("RELEASE_KEY_PASSWORD") as String?) ?: System.getenv("RELEASE_KEY_PASSWORD")
    val hasReleaseSigning =
        releaseStoreFile != null &&
            releaseStorePassword != null &&
            releaseKeyAlias != null &&
            releaseKeyPassword != null

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
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
            // AN14a increment 2. R8 ON for the first time (was false - the AN14 deferral AN-AUDIT parked as
            // PARKAN-31). isMinifyEnabled runs R8 (shrink + obfuscate + optimize); isShrinkResources prunes
            // unused resources (it requires minify). The keep rules live in proguard-rules.pro and each names
            // the failure it fixes (R306). mapping.txt lands under build/outputs/mapping/release and is NOT
            // committed - it is how a user-reported stack trace is deobfuscated (there is no crash SDK, by
            // design); where it is kept is documented in REPORT-AN14a.txt (increment 5).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // AN14a increment 5. Signed only when a key is supplied (above); otherwise null -> unsigned
            // (app-release-unsigned.apk). R250: no key is created here.
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release") else null
            // The real domain over HTTPS. No cleartext exists in this build
            // (src/release/res network security config denies it everywhere).
            buildConfigField("String", "API_BASE_URL", "\"https://monreleve.ch\"")
        }
        // AN-AUDIT increment 2 (AC1). The RELEASE configuration MADE RUNNABLE against the local server, so
        // the shipping config is exercised end to end for the first time (FW30's question). It INHERITS
        // release wholesale via initWith - the proguard files, debuggable false, and from AN14a increment 2
        // R8 ON (isMinifyEnabled/isShrinkResources are repeated below EXPLICITLY so the one variant we can
        // actually drive under minification states its own R8 status - it is the build whose mapping.txt
        // deobfuscates a drive trace). So the audit variant is minified exactly as release is, the whole point
        // of AN14a. It OVERRIDES only what a headless drive against `pnpm dev` needs:
        //   - the auto DEBUG signature, so it installs (R250 forbids the RELEASE key, not the debug one);
        //   - the LOCAL api url over cleartext to 10.0.2.2 (release points at https://monreleve.ch, which
        //     does not resolve - PARKAN-1).
        // It also REUSES src/debug wholesale (see sourceSets below): the injection (a real server session
        // with no typed email, AN5b), the seeder (increment 1's dataset), and the debug network security
        // config (cleartext to 10.0.2.2). Every difference from release is named in REPORT-AN-AUDIT.txt.
        // checkReleaseCleartext and checkReleaseNoDebugInjection read the RELEASE variant and are UNTOUCHED
        // by this variant - their green after this edit is the evidence that audit does not weaken them
        // (FW14). This is NOT a release artifact: increment 3 reads every declaration from assembleRelease.
        create("audit") {
            initWith(getByName("release"))
            // R8 ON (AN14a increment 2). Inherited from release via initWith; stated explicitly because this
            // is the variant AN14a drives under minification and reads a mapping.txt for.
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
            val frontalierPort = (project.findProperty("frontalierPort") as String?) ?: "3000"
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:$frontalierPort\"")
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
        // AN-AUDIT increment 2: the audit variant reuses the debug source set VERBATIM - one home, not
        // copies (R206). The injection, the seeder and the cleartext-to-10.0.2.2 network security config are
        // the debug files, compiled into the audit APK, so there is no second copy to drift from src/debug.
        getByName("audit") {
            kotlin.srcDir("src/debug/kotlin")
            res.srcDir("src/debug/res")
            manifest.srcFile("src/debug/AndroidManifest.xml")
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

// R284 guard (b). The debug-only tooling (SessionInjectionActivity and DebugSeederActivity, declared only in
// src/debug/AndroidManifest.xml) must never reach a release build. This reads the MERGED release manifest
// (processReleaseManifest's output - the merger or a library could introduce a component the source does not)
// and fails if any tooling marker is present anywhere in it. R182: it dependsOn the task that PRODUCES its
// subject, so it never runs before the merged manifest exists. The companion source scan is
// NoDebugInjectionInMainTest (guard a); this is the merged-output guard, exactly the shape of
// checkReleaseCleartext (AN4). Proven by planting each activity in src/main/AndroidManifest.xml and watching
// it go red (R180) - SessionInjection in REPORT-AN5c.txt, DebugSeeder in REPORT-AN-AUDIT.txt.
tasks.register("checkReleaseNoDebugInjection") {
    dependsOn("processReleaseManifest")
    doLast {
        // Strip XML comments before matching, the checkReleaseCleartext lesson: a guard that reads its
        // own documentation as a violation is the FW22 size-regex shape. The subject is the elements.
        val stripComments = { text: String -> text.replace(Regex("""(?s)<!--.*?-->"""), "") }
        // AN-AUDIT increment 1: two markers now. "SessionInjection" bypasses sign-in; "DebugSeeder" writes a
        // dataset straight into Room. Either in a release build is the R284 defect.
        val markers = listOf("SessionInjection", "DebugSeeder")

        val manifestDir = layout.buildDirectory.dir("intermediates/merged_manifest/release").get().asFile
        val mergedManifest = manifestDir.walkTopDown().firstOrNull { it.name == "AndroidManifest.xml" }
        if (mergedManifest == null) {
            throw GradleException(
                "checkReleaseNoDebugInjection: no merged release manifest under $manifestDir - " +
                    "processReleaseManifest did not produce its output",
            )
        }
        val manifestText = stripComments(mergedManifest.readText())
        val found = markers.filter { manifestText.contains(it) }
        if (found.isNotEmpty()) {
            throw GradleException(
                "checkReleaseNoDebugInjection FAILED - debug-only tooling ($found) is present in the " +
                    "merged RELEASE manifest ($mergedManifest). It must exist only in the debug source set " +
                    "(R284): a release build that could be handed a session bypasses sign-in entirely, and " +
                    "one that could be told to seed writes days no user recorded.",
            )
        }
        println("checkReleaseNoDebugInjection OK: no debug tooling ($markers) in the merged release manifest")
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

// AN-FIX F2/F6 (R304). The RELEASE build must declare NO location permission until detection ships
// (asking for one claims a feature this build does not expose, R282 - the item most likely to draw Play
// review). This reads the BUILT release APK's permissions with aapt2 (AC2: from the APK, not the source
// manifest - a library or the merger could introduce one), and fails on any ACCESS_*LOCATION. The
// permission lives in src/debug now, so the debug/audit builds keep it and only release drops it. R182:
// it dependsOn assembleRelease, the task that PRODUCES its subject, so it never runs before the APK
// exists. Proven by planting ACCESS_FINE_LOCATION back into src/main/AndroidManifest.xml and watching it
// go red (R180), recorded in REPORT-AN-FIX.txt.
tasks.register("checkReleaseNoLocationPermission") {
    dependsOn("assembleRelease")
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkReleaseNoLocationPermission: no release APK under $apkDir - assembleRelease produced none",
                )
        val buildToolsDir = File(android.sdkDirectory, "build-tools")
        val aapt2 =
            buildToolsDir.listFiles()
                ?.sortedByDescending { it.name }
                ?.firstNotNullOfOrNull { dir ->
                    sequenceOf("aapt2", "aapt2.exe").map { File(dir, it) }.firstOrNull { it.exists() }
                }
                ?: throw GradleException("checkReleaseNoLocationPermission: no aapt2 under $buildToolsDir")
        val stdout = ByteArrayOutputStream()
        project.exec {
            commandLine(aapt2.path, "dump", "permissions", apk.path)
            standardOutput = stdout
        }
        val permissions = stdout.toString("UTF-8")
        val location =
            Regex("""android\.permission\.ACCESS_[A-Z_]*LOCATION""")
                .findAll(permissions)
                .map { it.value }
                .toSortedSet()
        if (location.isNotEmpty()) {
            throw GradleException(
                "checkReleaseNoLocationPermission FAILED - the BUILT release APK declares location " +
                    "permission(s): $location (R304). The manual product must claim no location feature; the " +
                    "permission belongs in src/debug (the detection-capable builds), not src/main.\nAPK: $apk",
            )
        }
        println("checkReleaseNoLocationPermission OK: the built release APK declares no location permission ($apk)")
    }
}

// AN14a F1 (AC2 / R249). The RELEASE build must declare NO developer tooling component. The AN-AUDIT
// found four dev.* activities (GalleryActivity, SignInProbeActivity, DevRecorderActivity,
// DetectionReplayActivity) exported in the release APK - a launchable attack surface (F1). They now live
// in src/debug/AndroidManifest.xml, so the debug and audit variants keep them (the walkthrough drivers
// reach them by name) and the release the user installs declares none. This is the BUILT-APK partner of
// checkReleaseNoDebugInjection: that reads the merged manifest INTERMEDIATE, this reads what SHIPS -
// R249 says a claim about what ships is checked against the APK, not the source. It dumps the built
// release APK's manifest with aapt2 (the same tool and discovery as checkReleaseNoLocationPermission) and
// fails on any ch.monreleve.app.dev.* component. R182: it dependsOn assembleRelease, the task that
// PRODUCES its subject, so it never runs before the APK exists. Its FIRST run found the four live
// instances (R178 - the real proof F1 existed); proven still able to fire by planting one dev activity
// back into src/main and watching it go red (R180), recorded in REPORT-AN14a.txt.
tasks.register("checkReleaseNoDevComponent") {
    dependsOn("assembleRelease")
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkReleaseNoDevComponent: no release APK under $apkDir - assembleRelease produced none",
                )
        val buildToolsDir = File(android.sdkDirectory, "build-tools")
        val aapt2 =
            buildToolsDir.listFiles()
                ?.sortedByDescending { it.name }
                ?.firstNotNullOfOrNull { dir ->
                    sequenceOf("aapt2", "aapt2.exe").map { File(dir, it) }.firstOrNull { it.exists() }
                }
                ?: throw GradleException("checkReleaseNoDevComponent: no aapt2 under $buildToolsDir")
        val stdout = ByteArrayOutputStream()
        project.exec {
            commandLine(aapt2.path, "dump", "xmltree", "--file", "AndroidManifest.xml", apk.path)
            standardOutput = stdout
        }
        val manifest = stdout.toString("UTF-8")
        val devComponents =
            Regex("""ch\.monreleve\.app\.dev\.[A-Za-z0-9_]+""")
                .findAll(manifest)
                .map { it.value }
                .toSortedSet()
        if (devComponents.isNotEmpty()) {
            throw GradleException(
                "checkReleaseNoDevComponent FAILED - the BUILT release APK declares developer tooling " +
                    "component(s): $devComponents (F1). The dev.* activities (gallery, sign-in probe, " +
                    "recorder, detection replay) are a launchable attack surface and must live only in " +
                    "src/debug (the debug/audit variants), never in the release the user installs.\nAPK: $apk",
            )
        }
        println("checkReleaseNoDevComponent OK: the built release APK declares no dev.* component ($apk)")
    }
}

// AN14a increment 4 - R307 (the STATIC half). The server rejects unknown keys (FW23), so if R8 renamed a
// serialised /v1 field or an enum constant on the wire, every payload the MINIFIED build sends carries the
// wrong key and the server refuses it - a loud failure (R296 isolates it) but a lost sync. A JVM unit test
// cannot see this: it runs on UNMINIFIED code. This reads the MINIFIED release dex's string pool and asserts
// every /v1 field key and enum value the contract names is PRESENT - the tokens that go on the wire are
// org.json string-literal keys and `enum.name` <clinit> literals, neither of which R8 rewrites, so their
// survival in the minified dex is the static evidence the wire held.
//
// R206 - the expected tokens are DERIVED from docs/api-v1.md at execution time, never retyped: the field
// KEYS from the first column of the <!-- fields:write --> and <!-- fields:read --> marked tables, and the
// enum VALUES (backtick ALL-CAPS tokens) from the write region, which lists every value of all four enums
// (the read region adds the trail words CREATED/MODIFIED, which are not wire values, so enums come from
// write only). Change a field name in the doc and this goes red until the client follows (R187). R283:
// docs/api-v1.md is a declared input. R133/R178: proven able to fire by renaming "dayDate" in EntriesWire.kt,
// confirming "day_date" lands and "dayDate" leaves the built dex, and seeing RED (R180) - recorded in
// REPORT-AN14a.txt. This is PRESENCE in the shipping artifact; USE is the owed runtime half (dev.WireDumpActivity
// driven on the minified audit variant), which the emulator RAM budget defers.
tasks.register("checkMinifiedWireContract") {
    dependsOn("assembleRelease")
    val apiDoc = rootProject.layout.projectDirectory.file("../docs/api-v1.md").asFile
    inputs.file(apiDoc)
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkMinifiedWireContract: no release APK under $apkDir - assembleRelease produced none",
                )

        // The minified dex string pool: each dex string is a printable run bounded by its (non-printable,
        // for our short tokens) ULEB128 length byte and its 0x00 terminator, so a maximal printable-ASCII
        // run is one dex string - exact-matched, never substring-matched (which would let "portion" hide
        // inside "proportional" and mask a rename).
        val dexStrings = mutableSetOf<String>()
        ZipFile(apk).use { zip ->
            zip.entries().asSequence()
                .filter { it.name.matches(Regex("""classes\d*\.dex""")) }
                .forEach { entry ->
                    val bytes = zip.getInputStream(entry).use { it.readBytes() }
                    val run = StringBuilder()
                    for (byte in bytes) {
                        val code = byte.toInt() and 0xFF
                        if (code in 0x20..0x7E) {
                            run.append(code.toChar())
                        } else {
                            if (run.isNotEmpty()) {
                                dexStrings += run.toString()
                                run.setLength(0)
                            }
                        }
                    }
                    if (run.isNotEmpty()) dexStrings += run.toString()
                }
        }
        if (dexStrings.isEmpty()) {
            throw GradleException("checkMinifiedWireContract: no strings read from $apk - the dex scan is vacuous")
        }

        val doc = apiDoc.readText()

        fun region(tag: String): String =
            Regex("""<!-- $tag -->(.*?)<!-- /$tag -->""", RegexOption.DOT_MATCHES_ALL)
                .find(doc)
                ?.groupValues?.get(1)
                ?: throw GradleException(
                    "checkMinifiedWireContract: the <!-- $tag --> marked region is not in docs/api-v1.md - " +
                        "the field list cannot be derived (R206); a renamed marker must fail, not pass vacuously",
                )
        val write = region("fields:write")
        val read = region("fields:read")

        fun keysOf(region: String): Set<String> =
            Regex("""(?m)^\|\s*`([a-z][A-Za-z]+)`""")
                .findAll(region)
                .map { it.groupValues[1] }
                .toSet()
        val expectedKeys = keysOf(write) + keysOf(read)
        val expectedEnums =
            Regex("""`([A-Z][A-Z_]+)`""")
                .findAll(write)
                .map { it.groupValues[1] }
                .toSet()
        // F7's lesson: a scan that found nothing passes vacuously. The doc has 10+ write keys and 15 enum
        // values; far fewer means the parse broke, not that the contract shrank.
        if (expectedKeys.size < 10 || expectedEnums.size < 15) {
            throw GradleException(
                "checkMinifiedWireContract: derived only ${expectedKeys.size} keys and ${expectedEnums.size} " +
                    "enum values from docs/api-v1.md - the field-list parse is vacuous (expected >= 10 and >= 15)",
            )
        }

        val expected = (expectedKeys + expectedEnums).toSortedSet()
        val missing = expected.filter { it !in dexStrings }
        if (missing.isNotEmpty()) {
            throw GradleException(
                "checkMinifiedWireContract FAILED - the MINIFIED release dex is missing /v1 contract token(s) " +
                    "R8 must not have renamed or removed: $missing. The server rejects unknown keys (FW23), so a " +
                    "renamed field or enum value would make every payload the minified build sends unfilable " +
                    "(R307).\nDerived from docs/api-v1.md; APK: $apk",
            )
        }
        println(
            "checkMinifiedWireContract OK: all ${expected.size} /v1 contract tokens (${expectedKeys.size} field " +
                "keys + ${expectedEnums.size} enum values, derived from docs/api-v1.md) survive in the minified " +
                "release dex",
        )
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
        "checkReleaseNoLocationPermission",
        "checkReleaseNoDevComponent",
        "checkMinifiedWireContract",
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
            |     checkReleaseNoLocationPermission (R304: the BUILT release APK
            |     declares no location permission, read with aapt2 - AC2),
            |     checkReleaseNoDevComponent (AN14a F1: the BUILT release APK
            |     declares no ch.monreleve.app.dev.* component, read with aapt2 -
            |     AC2/R249), the built-APK partner of checkReleaseNoDebugInjection,
            |     checkMinifiedWireContract (AN14a R307 static half: every /v1 field
            |     key and enum value, derived from docs/api-v1.md, survives in the
            |     MINIFIED release dex - the wire R8 could have renamed on the server),
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
