package ch.monreleve.app.fences

// AN3 increment 0 (R269, from AN2's close-out review). Kotlin port of
// web/tests/unit/calc-engine/no-magic-thresholds.test.ts, adapted to this
// project's file layout - matched mechanism for mechanism, not merely in
// spirit, so the two guards can be trusted to behave the same way.
//
// SPEC section 7.1: "A magic 0.4 or 240 anywhere in the code is a review
// rejection." SPEC section 7.7: "RuleSet is the only place a threshold may
// appear." calc/Rules.kt is the one exempt file - it is where the constants
// live. ui/ is scanned too, from AN3 onward: the rail's ticks sit at exactly
// 40 and 49.9, which makes ui/ the second most tempting place to write a
// bare literal once a rail component exists to draw them.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

private val CALC_DIR = File("src/main/kotlin/ch/monreleve/app/calc")
private val UI_DIR = File("src/main/kotlin/ch/monreleve/app/ui")

private val SCANNED_DIRS = listOf(CALC_DIR, UI_DIR)

/**
 * Scoped to a path, not a basename - the same reasoning the TS guard states
 * for itself: a bare 'Rules.kt' would exempt any file of that name anywhere
 * under either tree.
 */
private val EXEMPT = setOf(File(CALC_DIR, "Rules.kt").canonicalFile)

/** The RuleSet values, in the units RuleSet stores them (see Rules.kt). */
private val FORBIDDEN = setOf(0.4, 0.499, 240.0, 10.0)

/**
 * The same two ceilings in PERCENTAGE form - how they appear on the rail:
 * bands 0-40 / 40-49.9 / >= 49.9. Forbidden EVERYWHERE including Rules.kt,
 * because they are DERIVED (fiscalCeiling * 1e2) and never stored. A literal
 * 40 in ui/ would be a hardcoded copy of the threshold the whole product
 * turns on, in a unit the fraction list above cannot see.
 */
private val FORBIDDEN_PERCENT_FORMS = setOf(40.0, 49.9)

/**
 * Strips comments and string literals before matching, for the same reason
 * the TS guard does: Rules.kt documents its own formulae in prose ("40% of
 * annual working time"), and a threshold named in a citation string is the
 * opposite of a hardcoded one - only arithmetic can misuse a number.
 *
 * KNOWN LIMIT, matching the TS guard's own recorded one: a number built by
 * string interpolation - `"${40}"` - is inside the string-strip pass and
 * would not be caught either way, so this is not a new gap. No Kotlin file
 * in this codebase does that today; named here so the next person reaching
 * for this guard sees the limit before leaning on it.
 */
private fun strippedSource(file: File): String =
    file.readText()
        .replace(Regex("""/\*[\s\S]*?\*/"""), " ")
        .replace(Regex("""//[^\n]*"""), " ")
        .replace(Regex(""""(?:[^"\\\n]|\\.)*""""), " ")
        .replace(Regex("""'(?:[^'\\\n]|\\.)*'"""), " ")

private fun offendingLiterals(
    source: String,
    forbidden: Set<Double>,
): List<Double> {
    val literals = Regex("""\b\d+(?:\.\d+)?\b""").findAll(source).map { it.value.toDouble() }
    return literals.filter { it in forbidden }.toList()
}

/** Every scanned source file, minus the exempt one. Recursive, deliberately - see AN1's own fence idiom. */
private fun scannedFiles(): List<File> =
    SCANNED_DIRS
        .filter { it.exists() }
        .flatMap { dir -> dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList() }
        .filterNot { it.canonicalFile in EXEMPT }

/** Last three path segments, so a test name reads calc/Types.kt or ui/screens/aujourdhui/AujourdhuiScreen.kt. */
private fun label(file: File): String = file.path.replace('\\', '/').split('/').takeLast(3).joinToString("/")

class NoBareThresholdTest {
    @Test
    fun findsFilesToInspectSoTheGuardCannotPassVacuously() {
        val files = scannedFiles()
        assertTrue("expected at least one scanned file, found none", files.isNotEmpty())
        for (dir in SCANNED_DIRS) {
            if (!dir.exists()) continue
            val inDir = files.count { it.canonicalFile.path.startsWith(dir.canonicalFile.path) }
            assertTrue("expected at least one file under ${dir.path}, found none", inDir > 0)
        }
    }

    @Test
    fun noScannedFileCarriesABareForbiddenFraction() {
        val offenders =
            scannedFiles().associateWith { offendingLiterals(strippedSource(it), FORBIDDEN) }
                .filterValues { it.isNotEmpty() }

        assertTrue(
            "bare 0.4 / 0.499 / 240 / 10 outside Rules.kt:\n" +
                offenders.entries.joinToString("\n") { (file, values) -> "${label(file)}: $values" },
            offenders.isEmpty(),
        )
    }

    @Test
    fun rulesKtDoesCarryThemItIsTheSingleSource() {
        val source = strippedSource(File(CALC_DIR, "Rules.kt"))
        val found = offendingLiterals(source, FORBIDDEN).toSet()

        assertTrue(
            "expected Rules.kt to carry every FORBIDDEN value, found only $found",
            found.containsAll(FORBIDDEN),
        )
    }

    @Test
    fun noFileAnywhereCarriesABarePercentForm() {
        val files = scannedFiles() + File(CALC_DIR, "Rules.kt")
        val offenders =
            files.associateWith { offendingLiterals(strippedSource(it), FORBIDDEN_PERCENT_FORMS) }
                .filterValues { it.isNotEmpty() }

        assertTrue(
            "bare 40 / 49.9 (derived, never stored, forbidden everywhere):\n" +
                offenders.entries.joinToString("\n") { (file, values) -> "${label(file)}: $values" },
            offenders.isEmpty(),
        )
    }
}
