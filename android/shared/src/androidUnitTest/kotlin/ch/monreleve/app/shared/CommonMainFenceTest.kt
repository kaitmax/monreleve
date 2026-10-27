package ch.monreleve.app.shared

// KMP-0 increment 2 (R369). THE PLATFORM-FREE FENCE. commonMain must compile for iOS the day those targets
// build (R367), so it may not reach for a JVM or Android API. Two layers guard this, not one:
//
//   1. compileCommonMainKotlinMetadata (in :app:gate) compiles commonMain AS COMMON code against the common
//      stdlib only, so an `import java.time.X` fails to resolve there. That is the primary, compiler-level proof.
//   2. THIS text scan. It exists because the Android target compiles commonMain WITH the JVM/Android classpath
//      (java.time IS available there via desugaring), so `import java.time` in a commonMain file compiles
//      cleanly for :shared:testDebugUnitTest even while it breaks the metadata and iOS compilations. A guard
//      that only watched the android compile would miss it; this reads the source as text and fails on the
//      import regardless of which target happens to accept it.
//
// It lives in the Android unit-test source set (not commonTest) because it reads files with java.io.File, which
// commonTest cannot do portably. src/commonMain/kotlin is a declared input of this test task (build.gradle.kts),
// so a new offending file re-runs it (R283). Proven able to fire by planting `import java.time.LocalDate` in a
// commonMain file (REPORT-KMP-0.txt increment 2, R180) and reverting.
//
// ------------------------------------------------------------------------------------------------
// KMP-2b (R394/R401). TWO androidx PREFIXES ARE NOW ALLOWED, AND EXACTLY TWO.
//
// The original rule read "androidx = Android", and at Room 2.6 that was simply true. It is no longer:
// androidx.room and androidx.sqlite publish MULTIPLATFORM artefacts at 2.7 - room-runtime ships
// -android, -iosarm64 and -iossimulatorarm64 klibs - which is the whole reason the database can live in
// commonMain at all. A text scan that still forbids them would forbid the thing the compiler proves is
// legal, and the compiler is the better witness: compileCommonMainKotlinMetadata resolves commonMain
// against the COMMON klibs only, so an androidx package with no common artefact fails there no matter
// what this file says.
//
// androidx.sqlite.db IS STILL FORBIDDEN, and that is the distinction worth keeping. That subpackage is
// the Android-only Support layer (SupportSQLiteDatabase, SupportSQLiteOpenHelper); androidx.sqlite
// itself (SQLiteConnection, SQLiteStatement, execSQL) is the common driver API the moved migrations are
// written against. One letter of package name separates "compiles for iOS" from "does not", so the
// narrower rule is named rather than left to the general prefix.
//
// THE EXEMPTION IS ASSERTED, NEVER MERELY CONFIGURED (R206's corollary). allowedPrefixes is read back
// by its own test below, so a third entry is a deliberate act that has to survive an argument rather
// than being the next item in an established habit - and the classifier is exercised on known-offending
// strings in both directions, so a regex that stopped matching anything would fail rather than report
// perfect compliance.
//
// ------------------------------------------------------------------------------------------------
// IOS-1b-A (R602c, R625). A THIRD androidx PREFIX: androidx.compose. - AND TWO ANDROID-ONLY HOLES IN IT.
//
// Compose Multiplatform 1.7.3 publishes Compose under its androidx package names on every target (R625), so the
// shared Aujourd'hui screen and its design system import androidx.compose.* from commonMain. The compiler is again
// the better witness (compileCommonMainKotlinMetadata resolves the common klibs only), and this scan follows it.
// TWO subpackages stay forbidden because they are Android-only inside a common package - the androidx.sqlite.db
// shape: androidx.compose.ui.res (painterResource(R.drawable.x), stringResource - Android resources; the shared
// screen reads Compose Multiplatform resources, R603) and androidx.compose.ui.tooling (@Preview tooling).
//
// AND ONE MATERIAL3 FAMILY IS FORBIDDEN BY NAME (R624, UNNUMBERED-6): Material3 1.7.3's date pickers. Its calendar
// model was compiled against kotlinx-datetime 0.6.0 and is UNLINKED on iOS against our 0.7.1 - the probe run
// 40408680643 threw IrLinkageError ('kotlinx.datetime/Instant.Companion') the moment rememberDatePickerState ran.
// No shared UI may reach it until the parked CMP upgrade; MaterialDatePickerCanaryTest (iosTest) asserts the break
// is still there, so the day it is gone this rule and that canary are deleted together.

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.fail

class CommonMainFenceTest {
    private val commonMain = File("src/commonMain/kotlin")

    // java., javax. (JVM), android., androidx. (Android) - every platform surface commonMain must not touch.
    private val forbiddenImport = Regex("""^\s*import\s+(java|javax|android|androidx)\.""")

    // The multiplatform androidx packages, and the only ones. See the header.
    private val allowedPrefixes = listOf("androidx.room.", "androidx.sqlite.", "androidx.compose.")

    // The Android-only layers inside otherwise-common packages.
    private val forbiddenPrefixes =
        listOf("androidx.sqlite.db.", "androidx.compose.ui.res.", "androidx.compose.ui.tooling.")

    // R624 / UNNUMBERED-6: Material3 1.7.3's date pickers are unlinked on iOS - any import that reaches them.
    private val forbiddenMaterialDate = Regex("""^\s*import\s+androidx\.compose\.material3\.\w*Date\w*""")

    private fun importedPackage(line: String): String? =
        Regex("""^\s*import\s+([A-Za-z0-9_.]+)""").find(line)?.groupValues?.get(1)

    /** True when this source line is an import commonMain may not carry. */
    internal fun offends(line: String): Boolean {
        if (!forbiddenImport.containsMatchIn(line)) return false
        val imported = importedPackage(line)
        return forbiddenMaterialDate.containsMatchIn(line) ||
            imported == null ||
            forbiddenPrefixes.any { imported.startsWith(it) } ||
            allowedPrefixes.none { imported.startsWith(it) }
    }

    @Test
    fun commonMainImportsNoPlatformApis() {
        // R169 presence: assert the subject exists and is non-empty before asserting anything about it, so the
        // scan cannot pass vacuously against a wrong working directory or an empty tree.
        check(commonMain.isDirectory) {
            "fence: ${commonMain.absolutePath} is not a directory - the working directory is not :shared"
        }
        val kotlinFiles =
            commonMain.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        check(kotlinFiles.isNotEmpty()) {
            "fence: no .kt files under ${commonMain.absolutePath} - the scan would pass vacuously (R169)"
        }

        val offenders =
            kotlinFiles.flatMap { file ->
                file.readLines().mapIndexedNotNull { index, line ->
                    if (offends(line)) "${file.path}:${index + 1}: ${line.trim()}" else null
                }
            }

        if (offenders.isNotEmpty()) {
            fail(
                "commonMain must be platform-free (R369): no java./javax./android./androidx. imports except " +
                    "androidx.room, androidx.sqlite (NOT .db) and androidx.compose (NOT .ui.res, .ui.tooling, nor " +
                    "Material3's date pickers), so it compiles and links for iOS. " +
                    "Offending imports:\n" + offenders.joinToString("\n"),
            )
        }
    }

    @Test
    fun theClassifierFiresOnPlatformImportsAndSparesTheTwoMultiplatformOnes() {
        // R133/R154: the scan above reports an ABSENCE. It is evidence only if the classifier that produced
        // it is shown to fire where it must - a regex that matched nothing would report perfect compliance.
        listOf(
            "import java.time.LocalDate",
            "import javax.crypto.Cipher",
            "import android.content.Context",
            "import androidx.work.WorkManager",
            "import androidx.annotation.RestrictTo",
            // the one-letter distinction: the Android-only Support layer inside a common package
            "import androidx.sqlite.db.SupportSQLiteDatabase",
            // IOS-1b-A: Android resources and tooling inside Compose, and the unlinked Material3 date pickers
            "import androidx.compose.ui.res.painterResource",
            "import androidx.compose.ui.tooling.preview.Preview",
            "import androidx.compose.material3.DatePicker",
            "import androidx.compose.material3.rememberDatePickerState",
            "import androidx.compose.material3.DateRangePicker",
        ).forEach { line ->
            assertTrue(offends(line), "the fence must reject: $line")
        }

        listOf(
            "import androidx.room.Entity",
            "import androidx.room.migration.Migration",
            "import androidx.sqlite.SQLiteConnection",
            "import androidx.sqlite.execSQL",
            "import kotlin.jvm.JvmInline",
            "import kotlinx.datetime.LocalDate",
            // IOS-1b-A: Compose Multiplatform under its androidx names
            "import androidx.compose.runtime.Composable",
            "import androidx.compose.ui.graphics.Color",
            "import androidx.compose.material3.Text",
            "import androidx.compose.material3.TextButton",
        ).forEach { line ->
            assertFalse(offends(line), "the fence must allow: $line")
        }
    }

    @Test
    fun theExemptionListIsExactlyTheThreeMultiplatformAndroidxPackages() {
        // R206's corollary - asserted beats merely present. A third exemption has to change this line and
        // argue for itself, rather than arriving as the next entry in a list nobody reads back.
        assertEquals(listOf("androidx.room.", "androidx.sqlite.", "androidx.compose."), allowedPrefixes)
        assertEquals(
            listOf("androidx.sqlite.db.", "androidx.compose.ui.res.", "androidx.compose.ui.tooling."),
            forbiddenPrefixes,
        )
    }
}
