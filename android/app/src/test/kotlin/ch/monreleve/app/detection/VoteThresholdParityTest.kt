package ch.monreleve.app.detection

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * R320 / R276 / R181. The vote and near-border thresholds are PROPOSED and recorded in
 * docs/detection-model.md; they are DERIVED from that document, not chosen in the code and not transcribed. This
 * reads each threshold back out of the document and fails if the encoded constant drifts from it - so a threshold
 * cannot be quietly tuned in the code after the document froze it, nor the document edited without the code
 * following. (It replaces TierThresholdParityTest, which pinned the removed continuous-era tier table.)
 */
class VoteThresholdParityTest {
    private val doc: String by lazy {
        val file = File(repoRoot(), "docs/detection-model.md")
        check(file.exists()) { "the detection model was not found at ${file.absolutePath}" }
        file.readText()
    }

    private val numbered = Regex("""\*\*(\d+)\*\*""")

    // The number recorded for a named constant: the first `**<digits>**` that follows the backticked name on the
    // first line naming it. "After the name" matters because one line can record two constants (`A` = **3** ... `B`
    // = **5**), and the first number on the line would otherwise be attributed to both.
    private fun recorded(constant: String): Int {
        val afterName =
            doc.lineSequence()
                .map { it.substringAfter("`$constant`", missingDelimiterValue = "") }
                .firstOrNull { it.isNotEmpty() && numbered.containsMatchIn(it) }
                ?: error("no line in docs/detection-model.md records `$constant` with a following **number**")
        return numbered.find(afterName)!!.groupValues[1].toInt()
    }

    @Test
    fun theVoteConstantsMatchTheDocument() {
        assertEquals(recorded("CHECK_WINDOW_RADIUS_MINUTES"), CHECK_WINDOW_RADIUS_MINUTES)
        assertEquals(recorded("VOTE_MIN_CHECKS"), VOTE_MIN_CHECKS)
        assertEquals(recorded("MEDIUM_MAX_DISSENT"), MEDIUM_MAX_DISSENT)
    }

    @Test
    fun theNearBorderConstantsMatchTheDocument() {
        assertEquals(recorded("NEAR_BORDER_STRIP_CHECKS"), NEAR_BORDER_STRIP_CHECKS)
        assertEquals(recorded("NEAR_BORDER_DAYS_THRESHOLD"), NEAR_BORDER_DAYS_THRESHOLD)
        assertEquals(recorded("NEAR_BORDER_WINDOW_DAYS"), NEAR_BORDER_WINDOW_DAYS)
    }
}
