package ch.monreleve.app.data.local

import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus
import kotlin.test.Test
import kotlin.test.assertEquals

// KMP-DT R552, WRITTEN ON kotlinx-datetime 0.6.1, BEFORE ANY VERSION MOVES. The contract a 0.7 bump must keep
// for the DAY STRINGS this app writes and reads back.
//
// THERE IS NO ROOM TYPE CONVERTER TO PIN. MonReleveDatabase declares none (its own header says so) and every
// date column is a String: entry.dayDate, entry.clientClaimedAt, entry.detectedAt, entry.firstRecordedAt,
// entry.lastModifiedAt, daily_tally.dayDate. So "the converter output" is the text the code hands Room:
//   - dayDate        todayInParis(...) = parisDayOf(...).toString() - kotlinx LocalDate.toString(), pinned
//                    here and, through the Paris-day resolution, in CalendarDayGoldenTest;
//   - clientClaimedAt / detectedAt  deviceClaimNow(...) - pinned by CalendarDayGoldenTest (common) and by
//                    :app's JavaTimeCalendarDayGoldenTest (the java.time bridge the tap path calls);
//   - firstRecordedAt / lastModifiedAt  the server's own strings, stored verbatim - no conversion exists to
//                    pin (EntriesMapping copies them; ServerInstantParseGoldenTest pins how they PARSE).
//
// What this file adds is the LocalDate <-> String pair that the stored day, the forecast and the aggregation
// all go through: LocalDate.toString() writes a dayDate (Forecast.kt `day.toString() !in recordedDays`,
// Simulation.kt's imagined rows), LocalDate.parse() reads one back (Aggregate.kt, Forecast.kt,
// ForecastController/SimulationController). A 0.7 that padded, widened or reformatted either would change
// what is stored and what is matched. The expected strings are written from ISO 8601's calendar-date form,
// and every one was confirmed GREEN on 0.6.1 first - the code being pinned is the oracle.
class StoredDayStringGoldenTest {
    private fun assertDayString(
        expected: String,
        day: LocalDate,
    ) {
        assertEquals(expected, day.toString(), "LocalDate($day).toString()")
        assertEquals(day, LocalDate.parse(expected), "LocalDate.parse(\"$expected\")")
    }

    @Test
    fun aDayIsWrittenAsZeroPaddedIsoAndReadBackToTheSameDay() {
        assertDayString("2026-01-05", LocalDate(2026, 1, 5))
        assertDayString("2026-10-24", LocalDate(2026, 10, 24))
        assertDayString("2026-10-25", LocalDate(2026, 10, 25))
        assertDayString("2026-12-31", LocalDate(2026, 12, 31))
        assertDayString("2027-01-01", LocalDate(2027, 1, 1))
        assertDayString("2028-02-29", LocalDate(2028, 2, 29))
    }

    @Test
    fun theForecastsNextDayStringCrossesMonthAndYearEnds() {
        // Simulation.kt writes imagined rows as from.plus(i, DAY).toString(); Forecast.kt walks the year the same way.
        assertEquals("2026-02-01", LocalDate(2026, 1, 31).plus(1, DateTimeUnit.DAY).toString())
        assertEquals("2026-03-01", LocalDate(2026, 2, 28).plus(1, DateTimeUnit.DAY).toString())
        assertEquals("2026-10-26", LocalDate(2026, 10, 25).plus(1, DateTimeUnit.DAY).toString())
        assertEquals("2027-01-01", LocalDate(2026, 12, 31).plus(1, DateTimeUnit.DAY).toString())
    }

    @Test
    fun theEpochDayLatenessForecastMultipliesIsTheServersUtcMidnight() {
        // LatenessForecast multiplies toEpochDays() by a day's milliseconds to reach UTC midnight of dayDate,
        // the instant web/lib/entries/late.ts builds with Date.UTC. Expected values are Date.parse("<day>T00:00:00Z")
        // / 86 400 000, computed with the server's own parser. Compared as Long: 0.6.1 returns Int, 0.7 Long.
        assertEquals(0L, LocalDate(1970, 1, 1).toEpochDays().toLong())
        assertEquals(20458L, LocalDate(2026, 1, 5).toEpochDays().toLong())
        assertEquals(20750L, LocalDate(2026, 10, 24).toEpochDays().toLong())
        assertEquals(20818L, LocalDate(2026, 12, 31).toEpochDays().toLong())
        assertEquals(21243L, LocalDate(2028, 2, 29).toEpochDays().toLong())
    }
}
