package ch.monreleve.app.register

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

// AN10b increment 1 (R294). The reports and the register (parking.md) describe the same decisions
// from two sides, and until this test nothing checked the space between them (R175): a report could
// cite a PARK-<n> / PARKAN-<n> the register never contained, so a reader following the citation up
// hit nothing. That is precisely what happened - REPORT-AN5b/AN5c cited PARKAN-16/17/18 that were
// never written here (the 4 -> 19 gap), and AN10's own report named it NOTICED BUT NOT TOUCHING.
//
// THE SCOPE IS DERIVED FROM THE REPORTS ON DISK, NEVER A HAND-KEPT LIST. A listed scope goes stale
// the same way the citations it is meant to check do; the whole point is that a new report added
// tomorrow is scanned the day it lands. Every REPORT-*.txt at the repo root is read, every
// PARK-<n> and PARKAN-<n> it cites is collected, and the register must cover each - both that a
// heading exists AND that the entry under it is real rather than a "Not transcribed" placeholder,
// because a heading with no content is a citation that resolves to a promise, not an entry.
//
// R283: parking.md and the repo-root reports are declared task inputs (app/build.gradle.kts), so an
// edit to either re-runs this rather than leaving it UP-TO-DATE. REPORT-AN10b.txt enters this scan
// the moment it is written, so this test is re-run after the report and before the final commit
// (R182: a check runs after the thing it checks for can exist).
//
// The PARK4-<n> series (Phase4parking.md) is a DIFFERENT register and is deliberately not matched:
// "PARK4-2" has a digit where PARK-<n> and PARKAN-<n> have a hyphen, so the pattern below excludes
// it. The published "P<n>" register (`/sources`, `#lecture-P1`) is likewise not "PARK-<n>" and is
// out of scope, exactly as PARK-9's mapping note intends.
class RegisterCoverageTest {
    private val root: File = repoRoot()

    private val parking: String by lazy {
        val file = File(root, "parking.md")
        check(file.exists()) { "parking.md not found at ${file.absolutePath}" }
        file.readText()
    }

    private val reports: List<File> by lazy {
        (
            root.listFiles { f -> f.isFile && f.name.startsWith("REPORT-") && f.name.endsWith(".txt") }
                ?: emptyArray()
        ).sortedBy { it.name }
    }

    // PARK-12 or PARKAN-18, never PARK4-2 (a different series) and never the published P<n>.
    private val citation = Regex("""\bPARKAN?-\d+\b""")

    @Test
    fun everyCitedRegisterEntryHasARealEntry() {
        check(reports.isNotEmpty()) {
            "no REPORT-*.txt found at ${root.absolutePath} - the derived scan scope is empty, " +
                "which would let this test pass by finding nothing (R133)"
        }

        // Which report(s) cite each id, for a failure message that points at the source.
        val citedBy = linkedMapOf<String, MutableSet<String>>()
        for (report in reports) {
            citation.findAll(report.readText()).forEach { m ->
                citedBy.getOrPut(m.value) { linkedSetOf() }.add(report.name)
            }
        }

        val problems = mutableListOf<String>()
        for ((id, who) in citedBy) {
            if (!hasHeading(id)) {
                problems += "$id is cited by ${who.joinToString(", ")} but has no \"## $id -\" heading in parking.md"
            }
        }
        // An entry that exists as a heading but still carries the placeholder is not yet an entry.
        for (id in placeholderEntries()) {
            val who = citedBy[id]?.joinToString(", ") ?: "no report"
            problems += "$id carries the \"Not transcribed\" placeholder in parking.md (cited by $who) - " +
                "a heading with no content is a citation that resolves to a promise, not an entry"
        }

        if (problems.isNotEmpty()) {
            fail(
                "R294: parking.md does not cover every cited register entry:\n" +
                    problems.joinToString("\n") { "  - $it" },
            )
        }
    }

    private fun hasHeading(id: String): Boolean = headingRegex(id).containsMatchIn(parking)

    private fun headingRegex(id: String): Regex = Regex("""(?m)^##\s+${Regex.escape(id)}\s+-""")

    // Split parking.md into sections at each "## PARK<...> -" heading; a section still carrying the
    // "Not transcribed" placeholder is named by its heading id. The STATUS LEDGER row's lowercase
    // "not transcribed" sits under "## STATUS LEDGER", which is not a PARK heading, so it is not a
    // false positive - only a real placeholder BODY under a PARK/PARKAN heading is flagged.
    private fun placeholderEntries(): List<String> {
        val headings = Regex("""(?m)^##\s+(PARKAN?-\d+)\s+-.*$""").findAll(parking).toList()
        val flagged = mutableListOf<String>()
        for ((i, m) in headings.withIndex()) {
            val start = m.range.first
            val end = if (i + 1 < headings.size) headings[i + 1].range.first else parking.length
            if (parking.substring(start, end).contains("Not transcribed")) {
                flagged += m.groupValues[1]
            }
        }
        return flagged
    }
}
