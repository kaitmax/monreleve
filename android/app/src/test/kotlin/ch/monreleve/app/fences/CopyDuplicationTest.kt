package ch.monreleve.app.fences

// AN3 increment 0 (R269, from AN2's close-out review, R126's shape). No two
// DIFFERENT copy constants under fr/ hold the identical French string.
//
// R206 - one text, one home. R268's own close-out finding was two test
// files asserting the same fixture at different coverage; this is the copy
// equivalent one layer earlier: two constant NAMES holding the same VALUE
// means a future edit to one leaves the other silently unchanged, and a
// reader who finds either has no way to know a second one exists.
//
// R126's own history (CLAUDE.md) is a retyped French string that evaded a
// substring-match guard because the retyping used a different apostrophe.
// This guard does not have that gap: it compares the STRING VALUE exactly,
// after Kotlin's own escape rules are read the same way the compiler reads
// them, so a duplicate is caught regardless of which apostrophe character
// produced it.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// KMP-0 increment 5: the French copy moved to :shared's commonMain, EXCEPT the two files that call the JVM
// formatters (ComparisonCopy, NotificationCopy) and fr/format itself, which stay in :app. So fr copy now lives
// in TWO places and this repo-wide duplication guard scans both, catching a duplicate that spans the split.
// AN-FENCE-ROOTS (R460): each root is asserted SEPARATELY and pinned by a file only it holds. The
// `.filter { it.exists() }` this replaces turned "the copy moved again" into "there was nothing to find"
// - and a COMBINED constant count stays comfortably over any threshold with :app's two files gone (R452).
private val FR_DIRS =
    listOf(
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/fr"), pin = "Fr.kt"),
        // IOS-2d R816/R819: ComparisonCopy moved to :shared fr (read by the root above); NotificationCopy is the one
        // copy file left in :app, so it pins this root now (R460).
        FenceRoot(File("src/main/kotlin/ch/monreleve/app/fr"), pin = "NotificationCopy.kt"),
    )

private fun frFiles(): List<File> {
    FR_DIRS.assertFound("copy duplication guard")
    return FR_DIRS.ktFiles()
}

/** A top-level or object-member `const val NAME = "value"` declaration. */
private val CONST_STRING = Regex("""const\s+val\s+(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"""")

/**
 * Kotlin's own escapes, read the way the compiler reads them - so two
 * constants that spell the same character differently (a literal U+2019
 * apostrophe versus its \u escape) are still recognised as the same value.
 * Only the handful of escapes this codebase's copy actually uses are
 * handled; an escape outside this set is left as-is, which fails toward
 * treating two strings as DIFFERENT rather than silently declaring a false
 * match.
 */
private fun unescape(raw: String): String =
    raw
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\\"", "\"")
        .replace("\\\\", "\\")
        .replace(Regex("""\\u([0-9a-fA-F]{4})""")) { it.groupValues[1].toInt(16).toChar().toString() }

/** (qualified name, value) for every const-string declaration found. */
private fun copyConstants(): List<Pair<String, String>> =
    frFiles().flatMap { file ->
        CONST_STRING.findAll(file.readText()).map { match ->
            "${file.nameWithoutExtension}.${match.groupValues[1]}" to unescape(match.groupValues[2])
        }
    }

class CopyDuplicationTest {
    @Test
    fun findsConstantsToInspectSoTheGuardCannotPassVacuously() {
        assertTrue("expected at least one copy constant under fr/, found none", copyConstants().isNotEmpty())
    }

    @Test
    fun noTwoDifferentConstantsShareAValue() {
        val duplicates =
            copyConstants()
                .groupBy({ it.second }, { it.first })
                .filterValues { names -> names.toSet().size > 1 }

        assertTrue(
            "two or more copy constants share the same string - fold into one and reference it:\n" +
                duplicates.entries.joinToString("\n") { (value, names) -> "\"$value\" <- ${names.joinToString(", ")}" },
            duplicates.isEmpty(),
        )
    }
}
