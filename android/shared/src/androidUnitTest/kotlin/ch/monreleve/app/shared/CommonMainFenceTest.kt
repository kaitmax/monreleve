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
    private val allowedPrefixes = listOf("androidx.room.", "androidx.sqlite.")

    // The Android-only Support layer inside an otherwise-common package.
    private val forbiddenPrefixes = listOf("androidx.sqlite.db.")

    private fun importedPackage(line: String): String? =
        Regex("""^\s*import\s+([A-Za-z0-9_.]+)""").find(line)?.groupValues?.get(1)

    /** True when this source line is an import commonMain may not carry. */
    internal fun offends(line: String): Boolean {
        if (!forbiddenImport.containsMatchIn(line)) return false
        val imported = importedPackage(line)
        return imported == null ||
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
                    "androidx.room and androidx.sqlite (NOT androidx.sqlite.db), so it compiles for iOS. " +
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
            "import androidx.compose.runtime.Composable",
            "import androidx.work.WorkManager",
            "import androidx.annotation.RestrictTo",
            // the one-letter distinction: the Android-only Support layer inside a common package
            "import androidx.sqlite.db.SupportSQLiteDatabase",
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
        ).forEach { line ->
            assertFalse(offends(line), "the fence must allow: $line")
        }
    }

    @Test
    fun theExemptionListIsExactlyTheTwoMultiplatformAndroidxPackages() {
        // R206's corollary - asserted beats merely present. A third exemption has to change this line and
        // argue for itself, rather than arriving as the next entry in a list nobody reads back.
        assertEquals(listOf("androidx.room.", "androidx.sqlite."), allowedPrefixes)
        assertEquals(listOf("androidx.sqlite.db."), forbiddenPrefixes)
    }
}
