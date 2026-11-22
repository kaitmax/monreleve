package ch.monreleve.app.data.sync

import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-SHELL-3 R1371: YearDownloadsTest's ninth case, transcribed to kotlin.test (R457) and KEPT in :app, because the
// function it pins - taxYearsToDownload over a java.time Clock - is Android's and stays here (the coordinator it fed
// moved to :shared commonMain). iOS reads its two years from its own kotlin.time clock in startIosShell.

class TaxYearsToDownloadTest {
    // "R28: the tax years are Paris's, whatever zone the phone is in"
    @Test
    fun r28TheTaxYearsAreParissWhateverZoneThePhoneIsIn() {
        val london = ZoneId.of("Europe/London")
        // 23:30 in Paris on 31 December - still 2026 everywhere.
        assertEquals(listOf(2026, 2025), taxYearsToDownload(Clock.fixed(Instant.parse("2026-12-31T22:30:00Z"), london)))
        // 00:30 in Paris on 1 January, 23:30 in London: Paris's new year is the one that counts.
        assertEquals(listOf(2027, 2026), taxYearsToDownload(Clock.fixed(Instant.parse("2026-12-31T23:30:00Z"), london)))
    }
}
