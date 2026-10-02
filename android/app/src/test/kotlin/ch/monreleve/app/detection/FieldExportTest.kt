package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyEntity
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * R320. The field export the scorer consumes: the tier and proposed kind are derived by the SAME vote the app uses
 * (the measurement build tests what ships), and NO coordinate is ever written (R277).
 */
class FieldExportTest {
    private fun tally(
        dayDate: String,
        c1: Classification?,
        c2: Classification?,
        c3: Classification?,
        c4: Classification?,
    ) = TallyEntity(
        dayDate = dayDate,
        check1 = c1?.name,
        check2 = c2?.name,
        check3 = c3?.name,
        check4 = c4?.name,
    )

    private fun exportOf(tallies: List<TallyEntity>): JSONArray = JSONArray(exportFieldRun(tallies))

    @Test
    fun tierAndKindMatchTheVote() {
        val i = Classification.INSIDE
        val o = Classification.OUTSIDE
        // 06-01: 4 INSIDE -> HIGH CH; 06-02: 4 OUTSIDE -> HIGH HOME; 06-03: 2/2 split -> LOW.
        val export =
            exportOf(
                listOf(
                    tally("2027-06-01", i, i, i, i),
                    tally("2027-06-02", o, o, o, o),
                    tally("2027-06-03", i, i, o, o),
                ),
            )
        assertEquals("HIGH", export.getJSONObject(0).getString("tier"))
        assertEquals("CH", export.getJSONObject(0).getString("proposedKind"))
        assertEquals("HOME", export.getJSONObject(1).getString("proposedKind"))
        assertEquals("LOW", export.getJSONObject(2).getString("tier"))
        assertTrue("a LOW day proposes nothing", export.getJSONObject(2).isNull("proposedKind"))
    }

    @Test
    fun theExportCarriesNoCoordinate() {
        val i = Classification.INSIDE
        val export = exportOf(listOf(tally("2027-06-01", i, i, i, i)))
        val keys = export.getJSONObject(0).keys().asSequence().toList()
        val coordinate = Regex("""(?i)(lat|lng|longitude|coord|location|geo)""")
        val offenders = keys.filter { coordinate.containsMatchIn(it) }
        assertFalse("the export must carry no coordinate-shaped key, found $offenders", offenders.isNotEmpty())
    }

    @Test
    fun theExportCarriesTheKeysTheScorerReads() {
        val i = Classification.INSIDE
        val export = exportOf(listOf(tally("2027-06-01", i, i, null, Classification.BUFFER)))
        val day = export.getJSONObject(0)
        assertEquals(
            setOf(
                "dayDate",
                "tier",
                "proposedKind",
                "check1",
                "check2",
                "check3",
                "check4",
                "checksTaken",
                "checksMissed",
                "stripChecks",
            ),
            day.keys().asSequence().toSet(),
        )
        // The diagnostic counts: 3 taken (one missed), one in the strip.
        assertEquals(3, day.getInt("checksTaken"))
        assertEquals(1, day.getInt("checksMissed"))
        assertEquals(1, day.getInt("stripChecks"))
    }
}
