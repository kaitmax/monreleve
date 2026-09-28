package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyEntity
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN6a increment 6. The field export the scorer consumes: the proposed kind is derived the same
 * way the app proposes it, and NO coordinate is ever written (R277).
 */
class FieldExportTest {
    private fun tally(
        dayDate: String,
        tier: String?,
        ch: Int,
        elsewhere: Int,
    ) = TallyEntity(
        dayDate = dayDate,
        minutesSwitzerland = ch,
        minutesElsewhere = elsewhere,
        fixCount = 40,
        bufferFixCount = 2,
        windowStartMinuteOfDay = 420,
        windowEndMinuteOfDay = 1140,
        tier = tier,
    )

    private fun exportOf(tallies: List<TallyEntity>): JSONArray = JSONArray(exportFieldRun(tallies))

    @Test
    fun proposedKindMatchesWhatTheAppWouldPropose() {
        val export =
            exportOf(
                listOf(
                    tally("2027-06-01", "HIGH", ch = 480, elsewhere = 0),
                    tally("2027-06-02", "HIGH", ch = 0, elsewhere = 480),
                    tally("2027-06-03", "LOW", ch = 100, elsewhere = 80),
                ),
            )
        assertEquals("CH", export.getJSONObject(0).getString("proposedKind"))
        assertEquals("HOME", export.getJSONObject(1).getString("proposedKind"))
        assertTrue("a LOW day proposes nothing", export.getJSONObject(2).isNull("proposedKind"))
    }

    @Test
    fun theExportCarriesNoCoordinate() {
        val export = exportOf(listOf(tally("2027-06-01", "HIGH", ch = 480, elsewhere = 0)))
        val keys = export.getJSONObject(0).keys().asSequence().toList()
        val coordinate = Regex("""(?i)(lat|lng|longitude|coord|location|geo)""")
        val offenders = keys.filter { coordinate.containsMatchIn(it) }
        assertFalse("the export must carry no coordinate-shaped key, found $offenders", offenders.isNotEmpty())
    }

    @Test
    fun theExportCarriesTheKeysTheScorerReads() {
        val export = exportOf(listOf(tally("2027-06-01", "HIGH", ch = 480, elsewhere = 0)))
        val keys = export.getJSONObject(0).keys().asSequence().toSet()
        assertEquals(
            setOf(
                "dayDate",
                "tier",
                "proposedKind",
                "minutesSwitzerland",
                "minutesElsewhere",
                "fixCount",
                "bufferFixCount",
            ),
            keys,
        )
    }
}
