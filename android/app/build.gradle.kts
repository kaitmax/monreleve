import com.android.aapt.Resources.XmlNode
import com.android.tools.idea.insights.proto.BuildStamp
import com.android.tools.idea.insights.proto.RepositoryInfo
import com.android.tools.idea.insights.proto.VersionControlSystem
import com.google.protobuf.TextFormat
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.zip.ZipFile

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    alias(libs.plugins.paparazzi)
}

// AN-PLAY-PACK (R1124). THE MANUAL-ONLY FALLBACK IS ONE BUILD PROPERTY AWAY. docs/play-background-location.md names
// "manual mode only" as the designed answer if Play refuses ACCESS_BACKGROUND_LOCATION; -PmanualOnly=true produces it:
// every variant merges src/manualOnly/AndroidManifest.xml (which only REMOVES the location permissions, kept in step
// with src/main by ManualOnlyOverlayTest), and the app reads "detection available" from the permissions its own
// package requests (detection/DetectionAvailability.kt) - so the manifest and the entry points cannot disagree.
// A PROJECT property on the command line only, never an environment variable: a machine-wide setting would make every
// gate on that machine build the fallback. Anything but absent / true / false is refused: a typo that silently built
// the detection release would be the one mistake this property exists to make impossible.
val manualOnly: Boolean =
    when (val raw = (findProperty("manualOnly") as String?)?.trim()) {
        null, "false" -> false
        "true" -> true
        else -> throw GradleException("manualOnly must be true or false, not \"$raw\" (R1124)")
    }

// R1124 / R206: THE ONE DEFINITION of the location permissions a release declares, read by both built-artifact
// checks - checkReleaseLocationPermissions (the APK) and checkReleaseBundle (the .aab Play takes). Detection ships
// (R316): exactly FINE + BACKGROUND. The manual-only fallback: none. Each check asserts its variant's set EXACTLY, both
// directions (R196), and requires android.permission.INTERNET in the same read first, because an empty set is also
// what a failed or empty dump would produce (R133).
val releaseLocationPermissions: Set<String> =
    if (manualOnly) {
        sortedSetOf()
    } else {
        sortedSetOf("android.permission.ACCESS_BACKGROUND_LOCATION", "android.permission.ACCESS_FINE_LOCATION")
    }
val locationPermissionPattern = Regex("""android\.permission\.ACCESS_[A-Z_]*LOCATION""")

/** The R1124 comparison both checks share; null when [declared] is exactly the variant's set. */
fun locationPermissionProblem(
    declared: Set<String>,
    allDeclared: Set<String>,
): String? =
    when {
        "android.permission.INTERNET" !in allDeclared ->
            "NO RESULT - the permission read found no android.permission.INTERNET, so it read nothing usable " +
                "(found: $allDeclared)"
        declared != releaseLocationPermissions ->
            "location permissions are $declared, expected exactly $releaseLocationPermissions " +
                "(manualOnly=$manualOnly); missing ${releaseLocationPermissions - declared}, " +
                "extra ${declared - releaseLocationPermissions}"
        else -> null
    }

// R1124: THE OVERLAY, merged into EVERY variant when -PmanualOnly=true and into none otherwise (AGP's variant API adds
// it last, so it overrides src/main's two <uses-permission>). Every variant, not only release, so the debug and audit
// builds of the fallback show on a phone exactly what the release would.
androidComponents {
    onVariants { variant ->
        if (manualOnly) variant.sources.manifests.addStaticManifestFile("src/manualOnly/AndroidManifest.xml")
    }
}

// AN5 increment 1 / KMP-2b (R396). exportSchema = true writes the room schema JSON, and R187 makes
// it a contract with every device that installs a release, so it is committed and
// RoomSchemaContractTest reads it back in the JVM gate.
//
// THE DIRECTORY MOVED WITH THE DATABASE. @Database now lives in :shared commonMain, so :shared owns
// room.schemaLocation (its own build file says so) and writes android/shared/schemas. :app declares
// no Room annotation at all any more, so it exports nothing and the arg that used to sit here would
// name a directory nothing writes - a stale instruction reads as a current one (R181), so it is gone
// rather than repointed. The two places :app still READS those files - the androidTest asset source
// set and the Test task's declared inputs - follow the directory below.
//
// AN-POLISH (R439) REMOVED :app's KSP PLUGIN AND room-compiler, which PARK-B3 had left in place. KMP-2b
// left them with nothing to process and no evidence either way; the check this task ran is that evidence.
// A comment-blind scan for Room annotations (@Dao/@Database/@Entity/@Query/@Upsert/@TypeConverter/...) over
// EVERY :app source set finds ZERO, and the SAME scan over shared/src finds 27 - so the scan works and the
// absence is real, rather than a scanner pointed at nothing (R133/R154).

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
        // rather than relying on it. The API 35 -> 36 runtime behaviour changes were OWED an emulator pass,
        // which AN-API36-PASS ran. Edge-to-edge was NOT already handled, as this comment used to say: that was
        // true of MainShell's Scaffold screens only (A3's N1, Android Ruling 8). AN-EDGE-INSETS handles the
        // system bars at ONE root, ui/shell/AppRoot.kt, held by fences/EdgeToEdgeCensusTest (R1170/R1171).
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

        // AN-FCM-CLIENT (R1150). THE FIREBASE APP CONFIG, FROM BUILD PROPERTIES - NEVER FROM A COMMITTED FILE.
        // No google-services plugin and no google-services.json: FirebaseApp is built at run time from
        // FirebaseOptions (push/PushRuntime.kt) whose four values are these fields. Each is a Gradle property OR
        // an environment variable of the same name (RELEASE_STORE_FILE's pattern above), supplied by the operator
        // from the Firebase console (REPORT-AN-FCM-CLIENT.txt, WHAT THE OPERATOR MUST SUPPLY). UNSET IS THE
        // DEFAULT AND IS INERT: an empty field reads as "push not configured" (push/PushConfig.kt), the app
        // builds and runs as it did before this task, and push is UNAVAILABLE - fail closed for push, open for
        // the app. There is deliberately NO placeholder default: a value that looks like a key is worse than
        // none (R205). A clean checkout and gate:clone carry none, by construction.
        val fcmValues = listOf("PROJECT_ID", "APPLICATION_ID", "API_KEY", "SENDER_ID").map { "FCM_ANDROID_$it" }
        fcmValues.forEach { name ->
            val value = ((findProperty(name) as String?) ?: System.getenv(name) ?: "").trim()
            if (value.any { it == '"' || it == '\\' || it.isISOControl() }) {
                throw GradleException("$name carries a quote, a backslash or a control character: not a Firebase value")
            }
            buildConfigField("String", name, "\"$value\"")
        }
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
            //
            // R321 (AN-NEXT): the host is a gradle property too, defaulting to 10.0.2.2
            // so the emulator path is unchanged. A PHYSICAL device has no 10.0.2.2 alias,
            // so the device drive overrides it with -PfrontalierHost=127.0.0.1 and bridges
            // with `adb reverse tcp:3000 tcp:3000` - exactly as the audit variant already
            // does. This replaces the two-build workaround (audit to reach the server, then
            // debug over it to read the DB with run-as): one DEBUGGABLE build now does both,
            // because run-as needs debuggable and a physical device needs the host override.
            // The 127.0.0.1 cleartext exception already lives in src/debug's network config
            // (added in AN14a increment 6); the RELEASE build is untouched and still denies
            // all cleartext (checkReleaseCleartext reads the release variant, not this one).
            val frontalierPort = (project.findProperty("frontalierPort") as String?) ?: "3000"
            val frontalierHost = (project.findProperty("frontalierHost") as String?) ?: "10.0.2.2"
            buildConfigField("String", "API_BASE_URL", "\"http://$frontalierHost:$frontalierPort\"")
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
            // AN14a increment 6. The host defaults to 10.0.2.2 (the emulator's host alias); a PHYSICAL
            // device has no such alias, so the device drive overrides it with -PfrontalierHost=127.0.0.1 and
            // bridges the host with `adb reverse tcp:3000 tcp:3000` (device 127.0.0.1 -> host 127.0.0.1).
            // Same MINIFIED code either way - only the endpoint differs; this is still never the release (which
            // points at https://monreleve.ch and denies all cleartext). The matching cleartext exception for
            // 127.0.0.1 is in src/debug/res/xml/network_security_config.xml.
            val frontalierPort = (project.findProperty("frontalierPort") as String?) ?: "3000"
            val frontalierHost = (project.findProperty("frontalierHost") as String?) ?: "10.0.2.2"
            buildConfigField("String", "API_BASE_URL", "\"http://$frontalierHost:$frontalierPort\"")
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
    // R308 (AN-STATE increment 0). Android Lint's NewApi check, wired into :app:gate PERMANENTLY. The crash
    // DEVICE-LOOP fixed was an API 34 method (LocalDate.ofInstant) called on an API 29 phone; ApiLevelFenceTest
    // is the cheap forever regression guard for THAT member, but R211's warning stands - a guard against one
    // mistake is not a guard against its class. NewApi catches EVERY platform member used above minSdk (26),
    // which no curated source scan can. Two layers, not duplication: the fence runs on the JVM in milliseconds
    // on every testDebugUnitTest; this is the comprehensive sweep DEVICE-LOOP ran once as a diagnostic.
    //
    // SCOPED TO NewApi (checkOnly), deliberately. DEVICE-LOOP's diagnostic lintDebug found three pre-existing,
    // non-NewApi lint errors (a src/debug CoarseFineLocation, a Compose UnusedBoxWithConstraintsScope, and a
    // local.properties PropertyEscape - the last exists on THIS machine but not in a clean clone, which would
    // make the gate's verdict machine-dependent). checkOnly runs NewApi and nothing else, so the gate fails on
    // a late-API call and on nothing pre-existing; broadening lint to the whole rule set is its own task.
    lint {
        checkOnly += "NewApi"
        error += "NewApi"
        abortOnError = true
    }
    // AN5 increment 1: MigrationTestHelper reads the exported schema JSON at
    // runtime from the test APK's assets, so the schemas/ directory must be an
    // androidTest asset source. Without this the harness fails on-device with
    // "Cannot find the schema file" even though the JSON is committed.
    sourceSets {
        getByName("androidTest") {
            // KMP-2b (R396): the schemas moved to :shared with the @Database, so the asset source
            // follows them. MigrationTestHelper reads them out of the test APK at runtime.
            assets.srcDir("$projectDir/../shared/schemas")
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

// AN5 increment 1, REWORDED BY AN-POLISH (R439): generated output is not ours to
// format, so ktlint does not scan it. This used to name KSP's build/generated/ksp
// specifically; :app no longer applies KSP (R439), and a comment naming a
// mechanism that is gone reads as a current instruction (R181). The filter STAYS
// and is unchanged - AGP generates into build/generated whether KSP runs or not,
// and :shared carries the identical filter. detekt's default source set does not
// include generated output, so it needs no equivalent.
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
    // KMP-2 (R395). Gradle FORKS a JVM for tests, so a -D on the Gradle command line does not reach
    // them. MigrationSqlVerbatimTest regenerates its fixture only on an explicit opt-in, so that
    // opt-in has to be forwarded deliberately - without this line the flag is silently ignored and
    // the recording run looks like an ordinary failure.
    // A PROJECT property (-P), not a -D: this build file already uses project.findProperty for the
    // device-drive overrides, and a -D does not reliably survive the daemon into a forked test JVM.
    if (project.findProperty("recordMigrationSql") == "true") {
        systemProperty("migration.sql.record", "true")
    }
    // R283, the same discipline the block below applies to every other file a test reads: the
    // migration SQL fixture is a DECLARED INPUT, so editing it re-runs the comparison instead of
    // leaving the task UP-TO-DATE with the assertion unrun.
    // inputs.files, not inputs.file: a REQUIRED input that does not exist makes Gradle refuse to run
    // the task - including the recording run that creates it. The TEST asserts the fixture is present,
    // with a message naming how to generate it (R133), which is the better place for that failure.
    inputs.files(layout.projectDirectory.file("src/test/resources/migration-sql.txt"))
        .withPropertyName("migrationSqlFixture")
        .withPathSensitivity(PathSensitivity.RELATIVE)
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
    // The field-protocol doc (docs/field-protocol-AN6b.md). It was declared for TierThresholdParityTest,
    // WHICH NO LONGER EXISTS - AN-FENCE-ROOTS (R462) found it: the test was replaced by
    // VoteThresholdParityTest, which reads a DIFFERENT document (docs/detection-model.md), and the
    // replacement's document was never declared while the deleted test's stayed. The declaration is kept
    // (a stale input only costs a re-run; removing it is a build decision with no defect behind it, R156,
    // PARK-V1) and the comment is corrected, because a comment naming a mechanism that is gone reads as a
    // current instruction (R181). TODAY NO TEST READS THIS FILE.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/field-protocol-AN6b.md"))
        .withPropertyName("fieldProtocolDoc")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-FENCE-ROOTS (R462/R283). docs/detection-model.md, read by VoteThresholdParityTest, which derives
    // every vote and near-border constant from the document rather than transcribing it (R181). Undeclared
    // until now: editing the document changed nothing in :app's test inputs, so the parity assertion went
    // unrun and a tuned threshold could have diverged from the frozen model in a green build.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/detection-model.md"))
        .withPropertyName("detectionModelDoc")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-FENCE-ROOTS (R462/R283). docs/lucide-icons.md, the licences screen's source of truth for icon
    // attribution, read by AnswerIconDrawablesTest. R167's instrument: rename a glyph there and the test
    // must re-run rather than certify an attribution nobody re-read.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/lucide-icons.md"))
        .withPropertyName("lucideIconsDoc")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-LINKS (R283/R246): the website's route tree (web/app), walked for page.tsx by AppSiteLinksTest to
    // derive every page the site serves and fail if an app -> site link points at one that no longer exists.
    // Declared so that renaming or removing a web page re-runs the test rather than leaving it UP-TO-DATE -
    // which is the whole guarantee (rename a page, break this build, not a link in someone's hand).
    inputs.dir(rootProject.layout.projectDirectory.dir("../web/app"))
        .withPropertyName("websiteRoutes")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // In-module DATA read as text with no compile dependency: the exported Room schema
    // (RoomSchemaContractTest), the bundled border polygon (BorderPolygon/Classification/DetectionSession
    // tests), and the backup rules XML (BackupRulesTest). A manual edit to any of these recompiles
    // nothing, so without these it would leave this task UP-TO-DATE.
    inputs.dir("$projectDir/../shared/schemas")
        .withPropertyName("roomSchemas")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // KMP-3 (R452/R283). :shared's commonMain, read AS TEXT by three of :app's source-scanning
    // fences now that the code they guard lives there: AccountCaptureFenceTest (the account is
    // never captured as a value at construction), SyncWorkerResultMappingTest (it derives the
    // SyncOutcome case list from SyncEngine.kt, which moved) and OnDeviceFormatGoldenTest.
    //
    // WITHOUT THIS LINE THE FENCES WOULD BE WORSE THAN ABSENT. Editing a commonMain file
    // recompiles :shared and :app, but nothing in :app's TEST inputs changes - so
    // testDebugUnitTest is UP-TO-DATE, the fence does not run, and the build is green over source
    // it never read. That is R283's defect exactly, and the fences only became exposed to it in
    // THIS task: before KMP-3 everything they scanned was inside this module's own tree.
    inputs.dir("$projectDir/../shared/src/commonMain/kotlin")
        .withPropertyName("sharedCommonMainSourceForFences")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // IOS-1a R592. ExperimentalTimeOptInAllowlistTest now reads EVERY :shared source set (iosMain, iosTest,
    // androidUnitTest, a future androidMain) as text, so an opt-in planted in an iOS file must re-run it. Without
    // this line that edit leaves testDebugUnitTest UP-TO-DATE and the widened fence passes over what it was
    // widened to see (R283 again, found while planting the RED).
    inputs.dir("$projectDir/../shared/src")
        .withPropertyName("sharedEverySourceSetForOptInAllowlist")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("$projectDir/src/main/assets")
        .withPropertyName("bundledAssets")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("$projectDir/src/main/res/xml")
        .withPropertyName("resXml")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-FENCE-ROOTS (R462/R283). THE CENSUS FOUND FOUR MORE ROOTS A TEST READS AND THE GATE DID NOT TRACK.
    // Each is read AS DATA with no compile dependency, so an edit recompiles nothing and would leave this
    // task UP-TO-DATE with the assertion unrun - R283's defect, in four more places.
    //   res/drawable            AnswerIconDrawablesTest: the five answer glyphs, their Lucide names and
    //                           version, and the 24-unit/stroke-2/round conversion the other 23 share.
    //   src/main/AndroidManifest.xml and src/debug/AndroidManifest.xml
    //                           BatteryOptimisationTest (R317): neither manifest may request a
    //                           battery-optimisation exemption. res/xml above covered the backup rules
    //                           but never the manifests themselves.
    //   src/debug/kotlin        ApiLevelFenceTest scans it beside src/main - the debug and audit variants
    //                           both run on the phone, so a late-API call in either is the same crash.
    inputs.dir("$projectDir/src/main/res/drawable")
        .withPropertyName("resDrawable")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.files(
        layout.projectDirectory.file("src/main/AndroidManifest.xml"),
        layout.projectDirectory.file("src/debug/AndroidManifest.xml"),
        // AN-PLAY-PACK (R1124): ManualOnlyOverlayTest reads the overlay beside src/main.
        layout.projectDirectory.file("src/manualOnly/AndroidManifest.xml"),
    ).withPropertyName("sourceManifests")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-PLAY-PACK (R1123/R283): StoreListingCopyTest reads the store listing's French texts from the document
    // the operator pastes into Play, so an edit to that document re-runs the binding rules instead of leaving
    // this task UP-TO-DATE.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/play-store-listing.md"))
        .withPropertyName("playStoreListing")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-COPY-TRUTH-2 (R1230/R283): PlayDeclarationCopyTest reads the background-location declaration's English
    // texts from the document the operator pastes them from, for the same reason.
    inputs.file(rootProject.layout.projectDirectory.file("../docs/play-release.md"))
        .withPropertyName("playReleaseDeclaration")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("$projectDir/src/debug/kotlin")
        .withPropertyName("scannedDebugSource")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // src/release/kotlin is scanned by NoDebugInjectionInMainTest and DOES NOT EXIST (:app has no
    // release-only Kotlin). inputs.files, not inputs.dir, for exactly the reason the migration-sql fixture
    // uses it above: a REQUIRED input that is absent makes Gradle refuse to run the task. As a file
    // collection it contributes nothing today and starts tracking the tree the day somebody creates it.
    inputs.files(layout.projectDirectory.dir("src/release/kotlin"))
        .withPropertyName("scannedReleaseSource")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // AN-FENCE-ROOTS (R462), MEASURED RATHER THAN ASSUMED. CleanWorktreeGuardTest reads app/build.gradle.kts
    // to assert R393's clean-worktree guard is still WIRED - and a build-script edit did NOT re-run this
    // task: appending one comment line to app/build.gradle.kts and re-running left
    // `:app:testDebugUnitTest UP-TO-DATE`. So the test whose whole job is to notice that guard block being
    // deleted could not have noticed, and deleting it would have left a stale green. Declaring the script
    // closes it. The cost is that every build-script edit re-runs the unit suite, which is what the guard
    // it protects is worth (R393 exists because two commits put java.time into commonMain with every check
    // green).
    inputs.file(layout.projectDirectory.file("build.gradle.kts"))
        .withPropertyName("appBuildScript")
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
    // KMP-2b (R283/R401). ErasureCensusTest now reads :shared's commonMain as TEXT too, because the
    // database name moved there with the @Database. Without this the census would be UP-TO-DATE after
    // a :shared edit that added a store, and the assertion would go unrun - which is the whole
    // guarantee. Declared for the same reason, and in the same words, as the line above it.
    inputs.dir("$projectDir/../shared/src/commonMain/kotlin")
        .withPropertyName("scannedSharedCommonMainSource")
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
    // R327: RegisterCoverageTest now shells out to the ONE definition of the register-coverage check,
    // web/scripts/register-coverage.mjs, which gate:clone also runs - so an edit to the script re-runs
    // this test rather than leaving it UP-TO-DATE (R283).
    inputs.file(repoRootDir.resolve("web/scripts/register-coverage.mjs"))
        .withPropertyName("registerCoverageScript")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    // ENGINE-PARITY (R348): FixtureCoverageTest shells out to the ONE definition of the
    // fixture-section coverage census, web/scripts/fixture-coverage.mjs, which gate:clone also runs. The
    // census scans the web test tree (web/tests) to decide which fixture sections that engine consumes;
    // fixtures/ is already declared above (sharedFixtures), and the Android test tree is a source input
    // of this task by compilation. Declaring the script and web/tests makes an edit to either re-run this
    // rather than leaving it UP-TO-DATE (R283) - derived from the files, never a list (R246).
    inputs.file(repoRootDir.resolve("web/scripts/fixture-coverage.mjs"))
        .withPropertyName("fixtureCoverageScript")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(repoRootDir.resolve("web/tests"))
        .withPropertyName("webTestTree")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}

dependencies {
    // KMP-0 increment 1 (R368). The platform-free Kotlin Multiplatform module. :app resolves its Android
    // target variant. Package names are unchanged across the move, so code that moves into :shared keeps its
    // ch.monreleve.app.* package and no import in :app changes.
    implementation(project(":shared"))
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
    // suspend/Flow DAO extensions. The RUNTIME stays - :app opens the database
    // (MonReleveDatabaseBuilder) and names its migrations - but room-compiler went
    // with the KSP plugin in AN-POLISH (R439): the @Database, the DAOs and the
    // entities all live in :shared now (KMP-2b), so there is nothing here to process.
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    // AN5 increment 3: the offline-queue drain (data/sync). CoroutineWorker + the
    // unique, network-constrained, backing-off work request.
    implementation(libs.androidx.work.runtime.ktx)
    // AN-LINKS (R136): Android Custom Tabs for the app -> website links. The page opens in the app's context
    // with the brand colour in the toolbar; a device with no Custom Tabs provider falls back to its browser
    // (a Custom Tab is an ACTION_VIEW intent), and with no browser at all openLegalLink shows the address (R299).
    implementation(libs.androidx.browser)
    // AN-FCM-CLIENT (R1150, Android Ruling 4 - the SPEC section 20 "Ask first" item, answered by the operator):
    // the Firebase Cloud Messaging client, the one artefact that receives a push and yields a registration
    // token. :app ONLY, never :shared. Its auto-init and every analytics/metrics collection are turned OFF in
    // src/main/AndroidManifest.xml, and FirebaseInitProvider is removed there: FirebaseApp exists only when the
    // four FCM_ANDROID_* values above are supplied (push/PushRuntime.kt).
    implementation(libs.firebase.messaging)
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
    // KMP-4 (R457, R471), TEST-ONLY: kotlin.test, the same catalogue entry and version :shared's commonTest
    // uses. It lands with its first user - CalendarDayGoldenTest, pinned here on the java.time CalendarDay
    // and then moved to :shared's commonTest by `git mv`, unedited, when CalendarDay moves. A kotlin.test
    // file needs no rewrite to cross; a JUnit4 or Kotest one does (PARK-D4).
    testImplementation(libs.kotlin.test)
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
        println(
            "checkReleaseCleartext OK: release permits cleartext nowhere (merged manifest + network security config)",
        )
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
    // KMP-0 increment 5: the French copy (incl. LicencesCopy) moved to :shared's commonMain. The check still
    // lives in :app (it resolves :app's RELEASE runtime classpath), reading the copy file from its new home.
    val licencesCopy =
        rootProject.layout.projectDirectory
            .file("shared/src/commonMain/kotlin/ch/monreleve/app/fr/LicencesCopy.kt")
            .asFile
    val runtimeClasspath = configurations.named("releaseRuntimeClasspath")
    inputs.file(licencesCopy)
    // KMP-0 increment 1. :shared is now on this classpath - a Kotlin Multiplatform project dependency whose
    // android variant exposes many secondary artifact variants with NO single default, so a plain
    // inputs.files(releaseRuntimeClasspath) cannot pick one and fails resolution (AGP's own tasks use artifact
    // views; this custom task did not). The licence CHECK below is unaffected: it reads the dependency GRAPH
    // (resolutionResult.allComponents), which resolves unambiguously, and it already excludes project
    // dependencies (it filters ModuleComponentIdentifier), so :shared is not an attribution obligation. Only
    // the up-to-date INPUT tracking forced artifact resolution; a lenient artifact view keeps that tracking
    // (a dependency change still re-runs this, R283) while skipping the one ambiguous project artifact. This
    // weakens nothing - the obligation is still derived from every EXTERNAL module in the graph.
    inputs.files(runtimeClasspath.get().incoming.artifactView { lenient(true) }.files)
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
                // AN-FCM-CLIENT (R1150): Firebase Cloud Messaging (Apache 2.0) and what it brings - its DataTransport
                // libraries, Okio (through androidx.datastore), javax.inject, Error Prone's annotations (Apache 2.0)
                // and Google Play services (the Android SDK licence, which LicencesCopy names as such).
                "com.google.firebase" to "Firebase Cloud Messaging",
                "com.google.android.datatransport" to "Firebase Cloud Messaging",
                "com.google.android.gms" to "Google Play",
                "com.google.errorprone" to "Error Prone",
                "com.squareup.okio" to "Okio",
                "javax.inject" to "javax.inject",
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

// AN-AUTO (R316, REVERSES R304). Detection ships (opt-in, beta), so the RELEASE build DOES declare the
// location permission - but it must declare EXACTLY what coordinate-free background detection needs and
// NOTHING MORE. This reads the BUILT release APK's permissions with aapt2 (AC2: from the APK, not the
// source manifest - a library or the merger could introduce one) and asserts the set of ACCESS_*LOCATION
// permissions is EXACTLY {ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION}:
//   - a MISSING one is a feature that cannot work (background sampling needs BACKGROUND; the buffer needs FINE);
//   - an EXTRA one (e.g. ACCESS_COARSE_LOCATION) is scope the product does not need and Play scrutinises.
// Both directions, because a check that only forbids extras passes an APK missing BACKGROUND, and one that
// only requires the two passes an APK that also declares COARSE (R196's both-directions shape). R182: it
// dependsOn assembleRelease, the task that PRODUCES its subject, so it never runs before the APK exists.
tasks.register("checkReleaseLocationPermissions") {
    dependsOn("assembleRelease")
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkReleaseLocationPermissions: no release APK under $apkDir - assembleRelease produced none",
                )
        val buildToolsDir = File(android.sdkDirectory, "build-tools")
        val aapt2 =
            buildToolsDir.listFiles()
                ?.sortedByDescending { it.name }
                ?.firstNotNullOfOrNull { dir ->
                    sequenceOf("aapt2", "aapt2.exe").map { File(dir, it) }.firstOrNull { it.exists() }
                }
                ?: throw GradleException("checkReleaseLocationPermissions: no aapt2 under $buildToolsDir")
        val stdout = ByteArrayOutputStream()
        project.exec {
            commandLine(aapt2.path, "dump", "permissions", apk.path)
            standardOutput = stdout
        }
        val permissions = stdout.toString("UTF-8")
        // AN-PLAY-PACK (R1124): the expected set is the VARIANT's - {FINE, BACKGROUND} for the detection release,
        // none for -PmanualOnly=true - from the one definition at the top of this file, shared with checkReleaseBundle.
        val allDeclared = Regex("""android\.permission\.[A-Z_]+""").findAll(permissions).map { it.value }.toSortedSet()
        val declaredLocation = allDeclared.filter { locationPermissionPattern.matches(it) }.toSortedSet()
        locationPermissionProblem(declaredLocation, allDeclared)?.let { problem ->
            throw GradleException(
                "checkReleaseLocationPermissions FAILED (R316/R1124) - the BUILT release APK must declare EXACTLY " +
                    "the location permissions its variant needs: $problem.\n" +
                    "  A missing one is a feature that cannot work; an extra one is scope the build does not need.\n" +
                    "APK: $apk",
            )
        }
        println(
            "checkReleaseLocationPermissions OK (manualOnly=$manualOnly): the built release APK declares exactly " +
                "$releaseLocationPermissions of the location permissions, and INTERNET ($apk)",
        )
    }
}

// AN14a F1 (AC2 / R249). The RELEASE build must declare NO developer tooling component. The AN-AUDIT
// found four dev.* activities (GalleryActivity, SignInProbeActivity, DevRecorderActivity,
// DetectionReplayActivity) exported in the release APK - a launchable attack surface (F1). They now live
// in src/debug/AndroidManifest.xml, so the debug and audit variants keep them (the walkthrough drivers
// reach them by name) and the release the user installs declares none. This is the BUILT-APK partner of
// checkReleaseNoDebugInjection: that reads the merged manifest INTERMEDIATE, this reads what SHIPS -
// R249 says a claim about what ships is checked against the APK, not the source. It dumps the built
// release APK's manifest with aapt2 (the same tool and discovery as checkReleaseLocationPermissions) and
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

// AN-FCM-CLIENT (R1150, R249). FIREBASE CLOUD MESSAGING SHIPS AS A CLIENT AND NOTHING MORE - read from the BUILT
// release APK's manifest with aapt2 (the same tool and discovery as checkReleaseNoDevComponent), because a claim about
// what ships is checked against what ships. It fails unless, in the APK:
//   - FirebaseInitProvider is ABSENT (tools:node="remove" in src/main: no Firebase code at process start, and no
//     FirebaseApp at all without the four FCM_ANDROID_* values);
//   - firebase_messaging_auto_init_enabled is false (no token until the app asks), and the analytics and
//     delivery-metrics flags are off;
//   - the app's own ch.monreleve.app.push.MonRelevePushService is declared (a receipt path that does not exist in
//     the APK is not a receipt path - R154's positive half);
//   - no analytics, measurement or crash-reporting component is declared (SPEC D32: FCM is the only third-party SDK).
// R182: it dependsOn assembleRelease, the task that PRODUCES its subject.
tasks.register("checkReleasePushManifest") {
    dependsOn("assembleRelease")
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkReleasePushManifest: no release APK under $apkDir - assembleRelease produced none",
                )
        val buildToolsDir = File(android.sdkDirectory, "build-tools")
        val aapt2 =
            buildToolsDir.listFiles()
                ?.sortedByDescending { it.name }
                ?.firstNotNullOfOrNull { dir ->
                    sequenceOf("aapt2", "aapt2.exe").map { File(dir, it) }.firstOrNull { it.exists() }
                }
                ?: throw GradleException("checkReleasePushManifest: no aapt2 under $buildToolsDir")
        val stdout = ByteArrayOutputStream()
        project.exec {
            commandLine(aapt2.path, "dump", "xmltree", "--file", "AndroidManifest.xml", apk.path)
            standardOutput = stdout
        }
        val manifest = stdout.toString("UTF-8")
        if (!manifest.contains("ch.monreleve.app")) {
            throw GradleException("checkReleasePushManifest: the manifest dump names no app component (R133)")
        }
        // Each <meta-data> element's block of the dump: its android:name and its android:value.
        val metaValue =
            manifest.split(Regex("""\n\s*E: """))
                .filter { it.startsWith("meta-data") }
                .mapNotNull { block ->
                    val name = Regex(""":name\(0x01010003\)="([^"]+)"""").find(block)?.groupValues?.get(1)
                    val value = Regex(""":value\(0x01010024\)=(\S+)""").find(block)?.groupValues?.get(1)
                    if (name == null || value == null) null else name to value.trim('"')
                }.toMap()
        val expectedFlags =
            mapOf(
                "firebase_messaging_auto_init_enabled" to "false",
                "firebase_analytics_collection_enabled" to "false",
                "firebase_analytics_collection_deactivated" to "true",
                "delivery_metrics_exported_to_big_query_enabled" to "false",
            )
        val problems = mutableListOf<String>()
        expectedFlags.forEach { (name, expected) ->
            val found = metaValue[name]
            if (found == null || !found.startsWith(expected, ignoreCase = true)) {
                problems += "meta-data $name is ${found ?: "ABSENT"}, expected $expected"
            }
        }
        if (manifest.contains("com.google.firebase.provider.FirebaseInitProvider")) {
            problems += "FirebaseInitProvider is declared - Firebase would start at every launch"
        }
        if (!manifest.contains("ch.monreleve.app.push.MonRelevePushService")) {
            problems += "ch.monreleve.app.push.MonRelevePushService is not declared - no push could be received"
        }
        val forbidden =
            Regex("""com\.google\.(android\.gms\.measurement|firebase\.(analytics|crashlytics))[\w.]*""")
                .findAll(manifest)
                .map { it.value }
                .toSortedSet()
        if (forbidden.isNotEmpty()) problems += "analytics/crash components declared: $forbidden"
        if (problems.isNotEmpty()) {
            throw GradleException(
                "checkReleasePushManifest FAILED (R1150) - the BUILT release APK:\n" +
                    problems.joinToString("\n") { "  - $it" } + "\nAPK: $apk",
            )
        }
        println(
            "checkReleasePushManifest OK: no FirebaseInitProvider, auto-init and analytics off (${metaValue.size} " +
                "meta-data read), MonRelevePushService declared, no analytics/crash component ($apk)",
        )
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

// AN-RELEASE-VCS (R1100-R1101) - THE FIX. AGP 8.10.1's ExtractVersionControlInfoTask (read in its own source)
// looks for `<Gradle rootDir>/.git/HEAD` and a LOOSE `.git/refs/heads/<branch>` only, and both properties are
// disallowChanges(), so no setting points it elsewhere. Our Gradle root is android/, and the repository root is
// its PARENT - so android/.git exists in no checkout at all (main, clone, worktree) and every release APK said
// NO_SUPPORTED_VCS_FOUND. The worktree was not the cause: a `git clone --local` with a real .git directory said
// the same. Measured further (REPORT-AN-RELEASE-VCS.txt): with android/ as its own git root AGP names the commit;
// as a WORKTREE of that root it says NO_VALID_GIT_FOUND (.git is a file); after `git pack-refs` it says
// NO_VALID_GIT_FOUND too. So reading .git by hand is the fragile part, and git itself is asked instead.
//
// This keeps AGP's task and AGP's wiring - the same artifact feeds the APK (PackageAndroidArtifact) and the
// bundle (PerModuleBundleTask) - and REPLACES ITS OUTPUT with the same proto AGP writes (AGP's own BuildStamp
// classes and TextFormat printer, so the format is AGP's by construction, R181), carrying `git rev-parse HEAD`.
// It matches every extract*VersionControlInfo task by name (release, and audit via initWith). The revision is a
// declared INPUT: the task's own inputs are paths under android/.git that never exist, so without it the task
// would stay UP-TO-DATE after a commit and the APK would name the previous one. If git prints no 40-hex commit,
// AGP's error output is left as it is and checkReleaseVcsInfo refuses the build. If a future AGP renames the
// task, nothing is matched, the APK keeps AGP's own answer, and checkReleaseVcsInfo refuses that too (R133).
val gitHeadRevision: Provider<String> =
    providers.exec {
        commandLine("git", "rev-parse", "HEAD")
        isIgnoreExitValue = true
    }.standardOutput.asText.map { it.trim() }

tasks.named { it.startsWith("extract") && it.endsWith("VersionControlInfo") }.configureEach {
    inputs.property("gitRevParseHead", gitHeadRevision)
    doLast {
        val outputFiles = outputs.files.files
        if (outputFiles.size != 1) {
            throw GradleException(
                "$name: expected exactly one output (AGP's version-control-info.textproto), found $outputFiles " +
                    "- refusing to write (R211)",
            )
        }
        val head = gitHeadRevision.get()
        if (!head.matches(Regex("[0-9a-f]{40}"))) {
            logger.warn("$name: `git rev-parse HEAD` printed no 40-hex commit (\"$head\"); AGP's output kept")
            return@doLast
        }
        val stamp =
            BuildStamp.newBuilder()
                .addRepositories(
                    RepositoryInfo.newBuilder()
                        .setSystem(VersionControlSystem.GIT)
                        .setLocalRootPath("\$PROJECT_DIR")
                        .setRevision(head),
                ).build()
        outputFiles.single().writeText(TextFormat.printer().printToString(stamp))
    }
}

// AN-RELEASE-VCS (R1100-R1102). A release APK names the commit it was built from, and this proves it on the
// BUILT APK: META-INF/version-control-info.textproto must carry exactly one 40-hex `revision` equal to
// `git rev-parse HEAD`, read when this task runs (R171 - the commit is DERIVED, never typed). It fails on
// a missing entry, on AGP's `generate_error_reason` (NO_SUPPORTED_VCS_FOUND, NO_VALID_GIT_FOUND), and on a
// revision that is not HEAD. A positive signal (R133): an entry that merely EXISTS proves nothing, because
// AGP writes one even when it found no repository - which every release APK before this task carried.
// Its FIRST run found that live (R178): NO_SUPPORTED_VCS_FOUND on 6f9dbc05. R182: it dependsOn
// assembleRelease, the task that PRODUCES its subject. If HEAD cannot be read, that is NO RESULT and it
// fails rather than passing on nothing. Equality with HEAD says nothing about UNCOMMITTED changes in the
// tree that was built; the gate's R393 refusal (below) covers unstaged edits, not untracked files.
tasks.register("checkReleaseVcsInfo") {
    dependsOn("assembleRelease")
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val apk =
            apkDir.walkTopDown().firstOrNull { it.isFile && it.extension == "apk" }
                ?: throw GradleException(
                    "checkReleaseVcsInfo: no release APK under $apkDir - assembleRelease produced none",
                )
        val entryName = "META-INF/version-control-info.textproto"
        val textproto =
            ZipFile(apk).use { zip ->
                zip.getEntry(entryName)?.let { entry -> zip.getInputStream(entry).use { it.readBytes() } }
            }?.toString(Charsets.UTF_8)
                ?: throw GradleException(
                    "checkReleaseVcsInfo FAILED - the BUILT release APK carries no $entryName, so it cannot " +
                        "name the commit it was built from.\nAPK: $apk",
                )
        val head =
            providers.exec {
                commandLine("git", "rev-parse", "HEAD")
                isIgnoreExitValue = true
            }.standardOutput.asText.get().trim()
        if (!head.matches(Regex("[0-9a-f]{40}"))) {
            throw GradleException(
                "checkReleaseVcsInfo: NO RESULT - `git rev-parse HEAD` did not print a 40-hex commit " +
                    "(got \"$head\"), so there is nothing to compare the APK against (R391).",
            )
        }
        vcsInfoProblem(textproto, head)?.let { problem ->
            throw GradleException(
                "checkReleaseVcsInfo FAILED (R1101) - the BUILT release APK does not name the commit it " +
                    "was built from.\n$problem\n  $entryName:\n" +
                    textproto.lines().joinToString("\n") { "    $it" } +
                    "\nAPK: $apk",
            )
        }
        println("checkReleaseVcsInfo OK: the built release APK names HEAD $head in $entryName ($apk)")
    }
}

// AN-PLAY-PACK (R1120, R206): the ONE reading of a version-control-info textproto, shared by checkReleaseVcsInfo (the
// APK) and checkReleaseBundle (the .aab). Null when it names exactly one 40-hex revision equal to [head] and carries no
// generate_error_reason; otherwise the lines that say why not.
fun vcsInfoProblem(
    textproto: String,
    head: String,
): String? {
    val revisions =
        Regex("""(?m)^\s*revision:\s*"([0-9a-f]{40})"\s*$""")
            .findAll(textproto)
            .map { it.groupValues[1] }
            .toList()
    val error = Regex("""generate_error_reason:\s*(\S+)""").find(textproto)?.groupValues?.get(1)
    return if (error != null || revisions.size != 1 || revisions.single() != head) {
        "  HEAD (git rev-parse HEAD): $head\n" +
            "  revision(s) found:         $revisions\n" +
            "  generate_error_reason:     ${error ?: "(none)"}"
    } else {
        null
    }
}

/** `git rev-parse HEAD` read when a check RUNS (R171); a non-40-hex answer is NO RESULT and fails (R391). */
fun headRevisionOrFail(check: String): String {
    val head =
        providers.exec {
            commandLine("git", "rev-parse", "HEAD")
            isIgnoreExitValue = true
        }.standardOutput.asText.get().trim()
    if (!head.matches(Regex("[0-9a-f]{40}"))) {
        throw GradleException("$check: NO RESULT - `git rev-parse HEAD` printed \"$head\", not a 40-hex commit (R391)")
    }
    return head
}

fun sha256Of(file: File): String =
    MessageDigest.getInstance("SHA-256").let { digest ->
        file.inputStream().use { input ->
            val buffer = ByteArray(1 shl 16)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        digest.digest().joinToString("") { "%02x".format(it) }
    }

/** Every permission a proto-format manifest (the .aab's base/manifest/AndroidManifest.xml) declares. */
fun protoManifestPermissions(manifest: XmlNode): Set<String> =
    manifest.element.childList
        .filter { it.hasElement() && it.element.name in setOf("uses-permission", "uses-permission-sdk-23") }
        .mapNotNull { child -> child.element.attributeList.firstOrNull { it.name == "name" }?.value }
        .toSortedSet()

// AN-PLAY-PACK (R1120; A2's Q3, Android Ruling 6). THE BUNDLE PLAY TAKES IS CHECKED, NOT ONLY THE APK. Play is
// uploaded an .aab (bundleRelease), and every other release check reads the APK - two artifacts AGP packages from the
// same inputs but by different tasks. This reads the BUILT .aab and fails unless:
//   - exactly one entry ending META-INF/version-control-info.textproto exists and names HEAD (R171: derived from
//     `git rev-parse HEAD` when this runs; the same reading as checkReleaseVcsInfo, vcsInfoProblem above);
//   - its base/manifest/AndroidManifest.xml (protobuf, which aapt2 dump does not read inside a bundle; parsed with
//     AGP's own aapt2 proto classes, as checkReleaseVcsInfo uses AGP's BuildStamp) declares INTERNET and EXACTLY the
//     location permissions releaseLocationPermissions names for this variant (R1124, both directions);
//   - the R8 mapping is inside it (BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map, non-empty) -
//     which is how Play deobfuscates a crash in a minified release with no separate mapping upload.
// A missing entry fails (R133): an absent textproto, manifest or mapping is never read as a pass. R182: it dependsOn
// bundleRelease, the task that PRODUCES its subject.
tasks.register("checkReleaseBundle") {
    dependsOn("bundleRelease")
    doLast {
        val bundleDir = layout.buildDirectory.dir("outputs/bundle/release").get().asFile
        val bundles = bundleDir.walkTopDown().filter { it.isFile && it.extension == "aab" }.toList()
        if (bundles.size != 1) {
            throw GradleException("checkReleaseBundle: expected exactly one .aab under $bundleDir, found $bundles")
        }
        val aab = bundles.single()
        val head = headRevisionOrFail("checkReleaseBundle")
        val problems = mutableListOf<String>()
        ZipFile(aab).use { zip ->
            val names = zip.entries().asSequence().map { it.name }.toList()
            val read = { name: String -> zip.getInputStream(zip.getEntry(name)).use { it.readBytes() } }

            val vcsEntries = names.filter { it.endsWith("META-INF/version-control-info.textproto") }
            if (vcsEntries.size != 1) {
                problems += "expected exactly one */META-INF/version-control-info.textproto, found $vcsEntries"
            } else {
                vcsInfoProblem(read(vcsEntries.single()).toString(Charsets.UTF_8), head)?.let {
                    problems += "${vcsEntries.single()} does not name HEAD:\n$it"
                }
            }

            val manifestEntry = "base/manifest/AndroidManifest.xml"
            if (manifestEntry !in names) {
                problems += "no $manifestEntry in the bundle"
            } else {
                val all = protoManifestPermissions(XmlNode.parseFrom(read(manifestEntry)))
                val location = all.filter { locationPermissionPattern.matches(it) }.toSortedSet()
                locationPermissionProblem(location, all)?.let { problems += "$manifestEntry: $it" }
            }

            val mappingEntry = "BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map"
            val mappingSize = zip.getEntry(mappingEntry)?.size ?: -1L
            if (mappingSize <= 0L) problems += "no non-empty R8 mapping at $mappingEntry (size $mappingSize)"
        }
        if (problems.isNotEmpty()) {
            throw GradleException(
                "checkReleaseBundle FAILED (R1120) - the BUILT .aab:\n" +
                    problems.joinToString("\n") { "  - $it" } + "\nAAB: $aab",
            )
        }
        println(
            "checkReleaseBundle OK (manualOnly=$manualOnly): the built .aab names HEAD $head, declares exactly " +
                "$releaseLocationPermissions of the location permissions and INTERNET, and carries its R8 mapping " +
                "($aab)",
        )
    }
}

// AN-PLAY-PACK (R1120). THE RELEASE-BUILD PROCEDURE'S ONE COMMAND (docs/play-release.md): every built-artifact check
// on the APK and on the .aab, from a tree that IS the commit. The dirty-tree refusal is not a dependency but a
// whenReady guard below (it must refuse before anything is built, the R393 shape). It is NOT in :app:gate, which runs
// from working trees by design (staged and untracked files allowed); the bundle CHECK is in the gate, the refusal is
// this command's. It prints what to sign and upload, and never prints a Firebase or signing value.
tasks.register("playRelease") {
    group = "release"
    description = "R1120: the release bundle Play takes, every built-artifact check, from a clean tree."
    dependsOn(
        "checkReleaseBundle",
        "checkReleaseVcsInfo",
        "checkReleaseLocationPermissions",
        "checkReleaseNoDevComponent",
        "checkReleasePushManifest",
        "checkReleaseCleartext",
        "checkReleaseNoDebugInjection",
        "checkMinifiedWireContract",
        "checkLicences",
    )
    doLast {
        val aab =
            layout.buildDirectory.dir("outputs/bundle/release").get().asFile
                .walkTopDown().single { it.isFile && it.extension == "aab" }
        val fcmSupplied =
            listOf("PROJECT_ID", "APPLICATION_ID", "API_KEY", "SENDER_ID").count { suffix ->
                val name = "FCM_ANDROID_$suffix"
                ((findProperty(name) as String?) ?: System.getenv(name) ?: "").isNotBlank()
            }
        val signed = android.buildTypes.getByName("release").signingConfig != null
        println(
            """
            |
            |PLAY RELEASE (R1120) - built from HEAD ${headRevisionOrFail("playRelease")}, a clean tree
            |  bundle:  $aab
            |  size:    ${aab.length()} bytes
            |  sha256:  ${sha256Of(aab)}
            |  variant: ${if (manualOnly) "MANUAL-ONLY fallback (no location permission, no detection)" else "detection beta (FINE + BACKGROUND)"}
            |  push:    ${if (fcmSupplied == 4) "configured (4 of 4 FCM_ANDROID_* values supplied)" else "NOT configured - push unavailable in this release (valid; the 19:00 fallback stands in)"}
            |  signed:  ${if (signed) "yes, with the RELEASE_* upload key supplied" else "NO - Play refuses an unsigned bundle; supply the RELEASE_* values to upload this"}
            |  mapping: inside the bundle (BUNDLE-METADATA/.../proguard.map); also build/outputs/mapping/release/mapping.txt
            """.trimMargin(),
        )
    }
}

// AN-PLAY-PACK (R1120; A2's Q2, Android Ruling 6). A RELEASE FOR DISTRIBUTION IS BUILT FROM A TREE THAT IS EXACTLY
// ITS COMMIT, or it does not start. checkReleaseVcsInfo/checkReleaseBundle prove the artifact NAMES HEAD; they cannot
// see an uncommitted change that went into it (A2's N1). So when :app:playRelease is in the graph, before any task
// runs (whenReady, R393's shape - "refuses to start", not "fails eventually"):
//   - `git status --porcelain --untracked-files=all` at the repository root must print nothing: no staged, unstaged
//     or untracked change ANYWHERE in the repository (web/ and docs/ included - the API contract the minified-wire
//     check reads lives in docs/);
//   - no IGNORED file may sit inside a source set (android/app/src, android/shared/src): .gitignore patterns are
//     unanchored and have swallowed new Kotlin files here before - a file that compiles into the release but can
//     never be committed.
// It names every dirty path. Ignored files elsewhere (build outputs, local.properties, a session lock) are not the
// release's sources and are not refused - the stated limit. A git that cannot answer is NO RESULT and refuses too.
gradle.taskGraph.whenReady {
    if (allTasks.none { it.path == ":app:playRelease" }) return@whenReady
    val repoRoot = rootDir.parentFile

    fun gitLines(vararg args: String): List<String> {
        val run =
            providers.exec {
                workingDir = repoRoot
                commandLine("git", *args)
                isIgnoreExitValue = true
            }
        if (run.result.get().exitValue != 0) {
            throw GradleException("PLAY RELEASE REFUSED TO START: NO RESULT - `git ${args.joinToString(" ")}` failed")
        }
        return run.standardOutput.asText.get().lines().filter { it.isNotBlank() }
    }
    val dirty = gitLines("status", "--porcelain=v1", "--untracked-files=all")
    val ignoredInSources =
        gitLines(
            "status",
            "--porcelain=v1",
            "--ignored=matching",
            "--untracked-files=all",
            "--",
            "android/app/src",
            "android/shared/src",
        ).filter { it.startsWith("!! ") }
    if (dirty.isNotEmpty() || ignoredInSources.isNotEmpty()) {
        throw GradleException(
            buildString {
                appendLine("")
                appendLine("PLAY RELEASE REFUSED TO START (R1120): the tree is not exactly its commit.")
                appendLine("A release names HEAD; built from this tree it would also carry what HEAD does not.")
                if (dirty.isNotEmpty()) {
                    appendLine("${dirty.size} path(s) differ from HEAD (git status --porcelain):")
                    dirty.forEach { appendLine("    $it") }
                }
                if (ignoredInSources.isNotEmpty()) {
                    appendLine(
                        "${ignoredInSources.size} IGNORED file(s) inside a source set (compiled, never committed):",
                    )
                    ignoredInSources.forEach { appendLine("    $it") }
                }
                appendLine("Build from a fresh worktree of the commit (docs/play-release.md, step 1).")
            },
        )
    }
    logger.lifecycle("[play-release] OK: the tree is exactly HEAD (nothing staged, unstaged or untracked) (R1120)")
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
        "checkReleaseLocationPermissions",
        "checkReleaseNoDevComponent",
        "checkReleasePushManifest",
        "checkMinifiedWireContract",
        // AN-RELEASE-VCS (R1101): the BUILT release APK names HEAD in version-control-info.textproto.
        "checkReleaseVcsInfo",
        // AN-PLAY-PACK (R1120): the BUILT .aab (what Play takes) names HEAD, declares the variant's exact location
        // set and carries its R8 mapping. The dirty-tree refusal is :app:playRelease's, never the gate's.
        "checkReleaseBundle",
        "checkLicences",
        // R308 (AN-STATE): Android Lint's NewApi check, scoped to NewApi only (lint{} above). The
        // comprehensive partner of ApiLevelFenceTest - it catches every platform member used above minSdk 26,
        // which the curated fence cannot. DEVICE-LOOP ran it once as a diagnostic; this makes it permanent.
        "lintDebug",
        // KMP-2 (R251/R269): COMPILE the androidTest source set. RUNNING it needs a device, which is
        // why connectedDebugAndroidTest is skipped-with-reason below - but COMPILING it does not, and
        // nothing in this gate did. That gap is not hypothetical: KMP-2 found TWO defects sitting in
        // this source set, both invisible for exactly this reason.
        //   - StatePreservationInstrumentedTest passed no employerStore argument, so the source set
        //     had not compiled since that parameter was added;
        //   - MonReleveMigrationTest never supplied MIGRATION_5_6 though DATABASE_VERSION is 6, so
        //     all four of its tests died at builder time with "A migration from N to 6 was required
        //     but not found" - the migration suite unable to run at all, on the one component whose
        //     mistakes survive a reinstall.
        // A suite this gate cannot RUN is still a suite it can COMPILE. R251: where no suite covers
        // a file, the answer is a suite rather than an exemption.
        "compileDebugAndroidTestKotlin",
        // KMP-0 increment 1 (R368/R369): the platform-free :shared module is governed by the SAME gate the
        // app is, so a session cannot red the shared engine and still commit. CI runs `./gradlew gate` and
        // gate:clone is unchanged, so both pick these up WITHOUT a web or CI edit (the hard boundary: they
        // call the Android gate exactly as before).
        //   - compileCommonMainKotlinMetadata: compiles commonMain as COMMON code against the common stdlib
        //     only, which rejects any java./android. reference - the platform-free proof on this Windows host
        //     (the iOS klibs, Room's iOS generation and the iOS test run happen on a Mac and are printed as
        //     skipped; KMP-UP2 to KMP-DT R575 the klibs compiled here too, without Room's generated code,
        //     until kotlin.native.enableKlibsCrossCompilation=false in gradle.properties stopped it).
        //   - testDebugUnitTest: runs :shared's commonTest + Android unit-test source set on the JVM.
        //   - ktlintCheck, detekt: the same style and static-analysis fences :app runs, over :shared's sources.
        ":shared:compileCommonMainKotlinMetadata",
        ":shared:testDebugUnitTest",
        ":shared:ktlintCheck",
        ":shared:detekt",
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
            |     checkReleaseLocationPermissions (R316: the BUILT release APK
            |     declares EXACTLY {ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION}
            |     and nothing more, read with aapt2 - AC2),
            |     checkReleaseNoDevComponent (AN14a F1: the BUILT release APK
            |     declares no ch.monreleve.app.dev.* component, read with aapt2 -
            |     AC2/R249), the built-APK partner of checkReleaseNoDebugInjection,
            |     checkReleasePushManifest (AN-FCM-CLIENT R1150: the BUILT release APK
            |     has no FirebaseInitProvider, FCM auto-init and analytics flags off,
            |     MonRelevePushService declared, no analytics/crash component - aapt2),
            |     checkMinifiedWireContract (AN14a R307 static half: every /v1 field
            |     key and enum value, derived from docs/api-v1.md, survives in the
            |     MINIFIED release dex - the wire R8 could have renamed on the server),
            |     checkReleaseVcsInfo (AN-RELEASE-VCS R1101: the BUILT release APK's
            |     META-INF/version-control-info.textproto names exactly one 40-hex
            |     revision equal to `git rev-parse HEAD` - never AGP's
            |     NO_SUPPORTED_VCS_FOUND),
            |     checkReleaseBundle (AN-PLAY-PACK R1120: the BUILT .aab Play takes
            |     names HEAD, declares INTERNET and exactly the variant's location
            |     permissions - protobuf manifest read with AGP's aapt2 classes -
            |     and carries its R8 mapping),
            |     checkLicences (R298: every release runtime dependency is
            |     attributed on the licences screen, derived from the build),
            |     lintDebug (R308: Android Lint's NewApi check, scoped to NewApi,
            |     catches every platform member used above minSdk 26 - the
            |     comprehensive partner of ApiLevelFenceTest's curated scan),
            |     :shared:compileCommonMainKotlinMetadata (KMP-0 R369: the
            |     platform-free module's commonMain compiled AS COMMON code,
            |     rejecting any java./android. reference - the platform-free proof
            |     on this Windows host), :shared:testDebugUnitTest (its commonTest
            |     + Android unit-test source set on the JVM), :shared:ktlintCheck
            |     and :shared:detekt (the same style and static-analysis fences,
            |     over the shared sources),
            |     compileDebugAndroidTestKotlin (KMP-2 R251: the androidTest
            |     source set COMPILED - not run, which needs a device - so a
            |     test that no longer builds fails HERE rather than rotting
            |     unseen, which is how two defects survived in it).
            |SKIPPED, with reason:
            |  - scripts/emulator.sh / screenshot.sh / walkthrough.sh (the AC2
            |    instrument): needs a real AVD with hardware acceleration. Not a
            |    Gradle task by construction - its whole point is a person driving
            |    it and looking at the PNG (R176/R177), which an unattended gate
            |    task cannot do.
            |  - connectedDebugAndroidTest (the instrumented canary,
            |    CanaryInstrumentedTest.kt; MonReleveMigrationTest; the state
            |    preservation tests): EXECUTION needs a running device, so it is
            |    exercised by the emulator instrument and by a device run, not by
            |    this gate. COMPILATION needs no device and is NOT skipped - see
            |    compileDebugAndroidTestKotlin above. The distinction is the whole
            |    point: while the gate skipped both, this source set stopped
            |    compiling and nothing said so (KMP-2).
            |  - :shared on iOS (KMP-0 R369/R133; KMP-DT R575): the iOS klibs
            |    (compileKotlinIosArm64, compileKotlinIosSimulatorArm64), Room's iOS
            |    code generation (kspKotlinIosArm64, kspKotlinIosSimulatorArm64),
            |    the test link and the simulator run (linkDebugTestIosSimulatorArm64,
            |    iosSimulatorArm64Test). They run on a Mac, in
            |    .github/workflows/ios-shared.yml, and appear above as SKIPPED:
            |    kotlin.native.enableKlibsCrossCompilation=false (gradle.properties)
            |    turns off the cross-platform klib compilation Kotlin 2.2.20 made
            |    the default, so this host neither downloads Kotlin/Native nor
            |    compiles iOS klibs that would lack Room's generated actual of
            |    MonReleveDatabaseConstructor. The platform-free guarantee here is
            |    the metadata compilation above; the iOS one is ios-shared.yml's,
            |    run on any branch touching :shared before it merges (R573).
            """.trimMargin(),
        )
    }
}

// ============================================================================
// R393: THE GATE REFUSES TO START WHEN THE TREE IT WOULD BUILD IS NOT THE TREE
// THAT WILL BE COMMITTED
// ============================================================================
//
// KMP-0 commits d808d05 and dfffee9 committed `java.time` imports into
// commonMain - exactly what the platform-free fence (R369) exists to forbid -
// and every check was green while they did it.
//
// Nothing was wrong with the fence. The sequence was:
//
//     git mv <file> shared/...                  the move is STAGED
//     <edit it to use kotlinx-datetime>         the edit is UNSTAGED
//     ./gradlew :app:gate                       compiles the WORKING TREE: green
//     git commit                                commits the INDEX: no edit
//
// Gradle compiled what was on disk; git committed what was in the index. Each
// tool was correct about its own input, and no single one of them was in a
// position to notice they had diverged.
//
// IT RUNS IN whenReady, NOT AS A dependsOn TASK, and that is the difference
// between "refuses to start" and "fails eventually". dependsOn gives no
// ordering guarantee against the gate's other dependencies, so a compile could
// run - and a stale build directory be produced - before a doLast ever fired.
// The task graph is resolved before ANY task executes, so this is the last
// moment at which nothing has happened yet.
//
// UNTRACKED FILES ARE NOT A FAILURE: local.properties, .kotlin/, a session
// lock and a scratch APK are all untracked, all normal, and none can reach a
// commit by accident. `git diff` with no arguments is precisely "tracked files
// whose working-tree content differs from the index", which is the gap that
// produced the defect. STAGED changes are not a failure either - once staged,
// the tree and the index agree, which is the whole point.
gradle.taskGraph.whenReady {
    val gateIsRunning = allTasks.any { it.path == ":app:gate" || it.name == "gate" }

    if (!gateIsRunning) return@whenReady

    val out = ByteArrayOutputStream()
    val result =
        providers.exec {
            commandLine("git", "diff", "--name-only")
            isIgnoreExitValue = true
        }

    val dirty =
        result.standardOutput.asText
            .get()
            .lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() }

    out.close()

    if (dirty.isNotEmpty()) {
        throw GradleException(
            buildString {
                appendLine("")
                appendLine("GATE REFUSED TO START (R393): unstaged changes to tracked files.")
                appendLine("")
                appendLine("Gradle compiles the WORKING TREE. A commit writes the INDEX. While")
                appendLine("these differ, \"the gate passed\" is a statement about code that is")
                appendLine("not the code being committed - which is how KMP-0 (d808d05, dfffee9)")
                appendLine("committed java.time into commonMain with every check green.")
                appendLine("")
                appendLine("${dirty.size} file(s) differ from the index:")
                dirty.forEach { appendLine("    $it") }
                appendLine("")
                appendLine("Stage them (git add) and run the gate again. Untracked files are not")
                appendLine("the problem and are not listed.")
            },
        )
    }

    logger.lifecycle("[clean-worktree] OK: no unstaged changes to tracked files (R393)")
}

// ============================================================================
// R390: THE FAST CHECK IS A TASK, BECAUSE AS PROSE IT LOST A STEP
// ============================================================================
//
// The "RAM-adapted fast-check mode" is the operator's R156 adaptation for a
// machine that cannot hold the full gate: a per-increment subset, with the FULL
// :app:gate run at checkpoints. It had no mechanical definition at all - it
// lived as a sentence in each session's report, retyped from the last one.
//
// IT LOST A STEP IN TRANSCRIPTION, and that is the whole argument for this task.
//
//   REPORT-KMP-0 DEVIATION 2:  ":shared:compileCommonMainKotlinMetadata +
//                               :shared:testDebugUnitTest + (ktlint/detekt) +
//                               :app:compileDebugKotlin ..."
//
//   REPORT-KMP-1 DEVIATION 6:  ":shared:compileCommonMainKotlinMetadata +
//                               :shared:testDebugUnitTest +
//                               :app:compileDebugKotlin ..."
//
// The "(ktlint/detekt)" is gone. KMP-1 then shipped three lint failures its
// per-increment checks could not have seen - two ktlint, one detekt - and they
// surfaced only when the full gate finally ran. KMP-0's own report had ALREADY
// recorded that gap biting once (6b's line length, ":app detekt not in the fast
// check"), so this is the same defect twice, the second time because a list was
// copied by hand.
//
// WHAT IS IN IT AND WHY. The cheap checks that would have caught all three, plus
// the compile and unit steps the mode always had. Lint is CHEAP - it is static
// analysis over source, it starts no emulator and builds no APK - so there is no
// reason it was ever the thing dropped for memory.
//
// WHAT IS DELIBERATELY NOT IN IT: assembleDebug, verifyPaparazziDebug, lintDebug,
// and the release-variant checks. Those are what make the full gate expensive,
// and they are what the checkpoints are for. A fast check that grows into the
// gate is a fast check nobody runs.
tasks.register("fastCheck") {
    group = "verification"
    description = "The per-increment subset (R390). The FULL :app:gate still runs at checkpoints."

    dependsOn(
        ":shared:compileCommonMainKotlinMetadata",
        ":shared:testDebugUnitTest",
        ":shared:ktlintCheck",
        ":shared:detekt",
        "compileDebugKotlin",
        "ktlintCheck",
        "detekt",
    )

    doLast {
        println(
            """
            |
            |FAST CHECK (R390) - the per-increment subset, NOT the gate.
            |RAN: :shared:compileCommonMainKotlinMetadata, :shared:testDebugUnitTest,
            |     :shared:ktlintCheck, :shared:detekt, :app:compileDebugKotlin,
            |     :app:ktlintCheck, :app:detekt
            |NOT RUN, and therefore NOT CLAIMED: assembleDebug, testDebugUnitTest (:app),
            |     verifyPaparazziDebug, lintDebug, and every release-variant check
            |     (checkReleaseCleartext, checkMinifiedWireContract, ...).
            |
            |A GREEN FAST CHECK IS NOT A GREEN GATE (R391). Report it as
            |"increments green under fast check. FULL GATE NOT RUN on <sha>."
            """.trimMargin(),
        )
    }
}
