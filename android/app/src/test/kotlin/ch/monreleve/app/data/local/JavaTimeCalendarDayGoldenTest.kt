package ch.monreleve.app.data.local

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * KMP-DT R552, WRITTEN ON kotlinx-datetime 0.6.1, BEFORE ANY VERSION MOVES. clientClaimedAt and the recorded
 * Paris day as :app's TAP PATH produces them - through JavaTimeCalendarDay.kt, the bridge that turns the
 * java.time.Clock every controller, the evening receiver and the sampling worker hold into the kotlinx-datetime
 * Clock and TimeZone :shared's CalendarDay takes.
 *
 * CalendarDayGoldenTest (commonTest) pins the shared functions given a kotlinx clock. It cannot see the
 * bridge, and the bridge is exactly the code a kotlinx-datetime 0.7 bump has to touch: 0.6.1's
 * java.time.Instant.toKotlinInstant() is not a public API of 0.7 (in the regular artifact the converter is the
 * standard library's, in the compatibility artifact it is internal), and 0.7 renames TimeZone.UTC's id from
 * "Z" to "UTC" - so the conversion of the INSTANT (nanoseconds and all) and of the ZONE (a region, a fixed
 * offset, UTC spelled three ways) is pinned here, at the boundary, with the strings the tap writes today.
 *
 * The cases are the ones R552 names - a whole minute, both 2026 offset changes, New Year's Eve - plus what only
 * a java.time.Clock can carry: a nanosecond instant (truncated, never rounded) and a ZoneOffset rather than a
 * region. Every expected string is the claim format "yyyy-MM-dd'T'HH:mm:ss.SSSxxx" applied by java.time to the
 * same instant and zone, and every one was GREEN on 0.6.1 before this file was committed.
 */
class JavaTimeCalendarDayGoldenTest {
    private fun clock(
        instant: String,
        zone: ZoneId,
    ): Clock = Clock.fixed(Instant.parse(instant), zone)

    private fun assertTap(
        instant: String,
        zone: ZoneId,
        parisDay: String,
        claim: String,
    ) {
        assertEquals("the Paris day of $instant on a clock in $zone", parisDay, todayInParis(clock(instant, zone)))
        assertEquals("clientClaimedAt of $instant on a clock in $zone", claim, deviceClaimNow(clock(instant, zone)))
    }

    private val paris: ZoneId = ZoneId.of("Europe/Paris")

    @Test
    fun aWholeMinuteKeepsItsSecondsAndMilliseconds() {
        assertTap("2026-07-01T10:00:00Z", paris, "2026-07-01", "2026-07-01T12:00:00.000+02:00")
    }

    @Test
    fun theMarch2026ChangeMovesTheOffsetAtOneUtc() {
        assertTap("2026-03-29T00:59:59.999Z", paris, "2026-03-29", "2026-03-29T01:59:59.999+01:00")
        assertTap("2026-03-29T01:00:00Z", paris, "2026-03-29", "2026-03-29T03:00:00.000+02:00")
    }

    @Test
    fun theOctober2026RepeatedHourIsToldApartByItsOffset() {
        assertTap("2026-10-25T00:30:00Z", paris, "2026-10-25", "2026-10-25T02:30:00.000+02:00")
        assertTap("2026-10-25T01:30:00Z", paris, "2026-10-25", "2026-10-25T02:30:00.000+01:00")
    }

    @Test
    fun aNanosecondInstantIsTruncatedToTheMillisecondNeverRounded() {
        assertTap("2026-07-01T10:00:59.999999999Z", paris, "2026-07-01", "2026-07-01T12:00:59.999+02:00")
    }

    @Test
    fun aCasablancaClockAt2330InParisSummerTimeRecordsTheParisDay() {
        assertTap(
            "2026-07-01T22:30:00Z",
            ZoneId.of("Africa/Casablanca"),
            "2026-07-02",
            "2026-07-01T23:30:00.000+01:00",
        )
    }

    @Test
    fun utcAsAnOffsetAsARegionAndAsZIsWrittenPlusZeroZero() {
        assertTap("2026-07-01T10:00:00Z", ZoneOffset.UTC, "2026-07-01", "2026-07-01T10:00:00.000+00:00")
        assertTap("2026-07-01T10:00:00Z", ZoneId.of("UTC"), "2026-07-01", "2026-07-01T10:00:00.000+00:00")
        assertTap("2026-07-01T10:00:00Z", ZoneId.of("Z"), "2026-07-01", "2026-07-01T10:00:00.000+00:00")
        val kolkataOffset = ZoneOffset.ofHoursMinutes(5, 30)
        assertTap("2026-07-01T10:00:00Z", kolkataOffset, "2026-07-01", "2026-07-01T15:30:00.000+05:30")
    }

    @Test
    fun newYearsEveOnAUtcClockIsAlreadyTheNextParisDay() {
        assertTap("2026-12-31T23:30:00Z", ZoneOffset.UTC, "2027-01-01", "2026-12-31T23:30:00.000+00:00")
    }
}
