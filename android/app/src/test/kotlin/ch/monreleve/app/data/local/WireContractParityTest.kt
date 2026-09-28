package ch.monreleve.app.data.local

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN5 increment 1. The client's wire vocabulary is DERIVED from the server's,
 * never transcribed (R181). This reads the four enum arrays straight out of
 * web/lib/entries/schema.ts - the file that freezes the contract (R187) - and
 * fails if any Kotlin enum's constant names diverge from it.
 *
 * WHY NOT JUST TRUST THE CONSTANTS. A hand-kept Kotlin list is correct the day it
 * is written and silently wrong the day the server adds a sixth kind, with every
 * other test green. This is the same cross-language idiom the calc conformance
 * suites use to read fixtures/ (FixturePaths.kt): one home for the fact, on the
 * server side, and a test that goes red the moment the two drift.
 */
class WireContractParityTest {
    private val schemaSource: String by lazy {
        val file = File(repoRoot(), "web/lib/entries/schema.ts")
        check(file.exists()) {
            "the server's entry schema was not found at ${file.absolutePath} - the wire " +
                "vocabulary cannot be verified against a file that is not there"
        }
        file.readText()
    }

    /** Extracts the string tokens of `const NAME = ['A', 'B', ...] as const;`. */
    private fun serverArray(name: String): List<String> {
        val array =
            Regex("""const\s+$name\s*=\s*\[(.*?)]\s*as const;""", RegexOption.DOT_MATCHES_ALL)
                .find(schemaSource)
                ?: error("array `$name` not found in web/lib/entries/schema.ts")
        return Regex("""'([^']+)'""")
            .findAll(array.groupValues[1])
            .map { it.groupValues[1] }
            .toList()
    }

    private fun <E : Enum<E>> assertParity(
        arrayName: String,
        values: Array<E>,
    ) {
        assertEquals(
            "the Kotlin enum for `$arrayName` must equal the server's set, in order",
            serverArray(arrayName),
            values.map { it.name },
        )
    }

    @Test
    fun entryKindsMatchTheServer() {
        assertParity("ENTRY_KINDS", EntryKind.entries.toTypedArray())
    }

    @Test
    fun absenceReasonsMatchTheServer() {
        assertParity("ABSENCE_REASONS", AbsenceReason.entries.toTypedArray())
    }

    @Test
    fun portionsMatchTheServer() {
        assertParity("PORTIONS", Portion.entries.toTypedArray())
    }

    @Test
    fun provenancesMatchTheServer() {
        assertParity("PROVENANCES", Provenance.entries.toTypedArray())
    }
}
