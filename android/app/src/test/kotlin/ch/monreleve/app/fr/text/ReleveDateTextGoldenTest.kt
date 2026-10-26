package ch.monreleve.app.fr.text

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * KMP-DT R552, WRITTEN ON kotlinx-datetime 0.6.1, BEFORE ANY VERSION MOVES. The date TEXT the releve prints
 * (as text, not pixels) that no unit test pinned until now.
 *
 * What the releve and the forecast print, read from their screens: ReleveHeader and ReleveSections print
 * formatDate (the period start, each annex row's day - pinned by DatesTest), formatDossierStamp (the generated
 * stamp, the header's year-to-date line through its day part, and each annex row's first-recorded, modified and
 * claimed stamps) and formatMonthName (the monthly table). The forecast and simulation screens print rates and day
 * counts only - no date. formatDossierStamp and formatMonthName had NO unit test; Paparazzi photographs them,
 * which proves pixels, not strings.
 *
 * They are java.time, which a kotlinx-datetime bump does not reach - and that is a claim worth holding the
 * bump to rather than assuming: if the move ever routed one of them through kotlinx, these strings are the
 * contract. formatDossierStamp's inputs are the server's toISOString() shape (ServerInstantParseGoldenTest
 * names it); its output is UTC by design, to match the PDF's own stamp() (Dates.kt says why).
 */
class ReleveDateTextGoldenTest {
    @Test
    fun theReleveStampIsTheServersUtcInstantAsDayDotMonthDotYearHourMinute() {
        assertEquals("24.10.2026 19:36", formatDossierStamp("2026-10-24T19:36:04.876Z"))
        assertEquals("07.04.2026 18:44", formatDossierStamp("2026-04-07T18:44:02.000Z"))
        assertEquals("01.01.2026 00:00", formatDossierStamp("2026-01-01T00:00:00.000Z"))
        assertEquals("31.12.2026 23:59", formatDossierStamp("2026-12-31T23:59:59.999Z"))
        // The two 2026 Paris offset changes, which a UTC stamp does not see.
        assertEquals("29.03.2026 01:00", formatDossierStamp("2026-03-29T01:00:00.000Z"))
        assertEquals("25.10.2026 01:30", formatDossierStamp("2026-10-25T01:30:00.000Z"))
    }

    @Test
    fun theMonthlyTableNamesEveryMonthInFrenchWithALeadingCapital() {
        val expected =
            listOf(
                "Janvier",
                "Février",
                "Mars",
                "Avril",
                "Mai",
                "Juin",
                "Juillet",
                "Août",
                "Septembre",
                "Octobre",
                "Novembre",
                "Décembre",
            )
        assertEquals(expected, (1..12).map { formatMonthName(it) })
    }
}
