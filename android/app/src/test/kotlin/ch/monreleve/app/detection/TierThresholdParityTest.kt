package ch.monreleve.app.detection

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN6a increment 4, R276/R181. The tier thresholds are the field protocol's, DERIVED from
 * docs/field-protocol-AN6b.md section 3, not chosen here and not transcribed. This reads the six
 * percentages back out of that table and fails if the encoded constants drift from it - so a
 * threshold cannot be quietly tuned in the code after the document froze it, nor the document
 * edited without the code following.
 */
class TierThresholdParityTest {
    private val doc: String by lazy {
        val file = File(repoRoot(), "docs/field-protocol-AN6b.md")
        check(file.exists()) { "the field protocol was not found at ${file.absolutePath}" }
        file.readText()
    }

    // The three percentages on the tier's table row, in order (samples, buffer, side).
    private fun rowPercentages(tier: String): List<Int> {
        val line =
            doc.lineSequence().firstOrNull { it.contains("**$tier**") && it.contains("%") }
                ?: error("no `$tier` row with percentages found in the field protocol tier table")
        return Regex("""(\d+)\s*%""").findAll(line).map { it.groupValues[1].toInt() }.toList()
    }

    private fun asPercent(share: Double): Int = (share * 100).toInt()

    @Test
    fun highThresholdsMatchTheFieldProtocol() {
        assertEquals(
            listOf(asPercent(HIGH_SAMPLES_SHARE), asPercent(HIGH_BUFFER_SHARE), asPercent(HIGH_SIDE_SHARE)),
            rowPercentages("HIGH"),
        )
    }

    @Test
    fun mediumThresholdsMatchTheFieldProtocol() {
        assertEquals(
            listOf(asPercent(MEDIUM_SAMPLES_SHARE), asPercent(MEDIUM_BUFFER_SHARE), asPercent(MEDIUM_SIDE_SHARE)),
            rowPercentages("MEDIUM"),
        )
    }
}
