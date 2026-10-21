package ch.monreleve.app.data.local

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * KMP-4 (R464). THE PARIS DAY AND THE clientClaimedAt STRING, PINNED BEFORE CalendarDay MOVES.
 *
 * Two outputs of the record path that a person never sees and the server judges by:
 *   - the DAY a tap lands on, named in Europe/Paris whatever zone the device carries (R28);
 *   - clientClaimedAt, the device's own wall clock at the tap, WITH its offset, in a FIXED pattern. The
 *     pattern is fixed because OffsetDateTime.toString() and ISO_OFFSET_DATE_TIME both drop a zero seconds
 *     field ("...T12:00+02:00"), and the server's zod .datetime({ offset: true }) refuses that string.
 *
 * Every expected string here was produced by the java.time implementation on b942ed4 - the code being
 * pinned is the oracle - and every zone fact was read off the JVM's own rules, never assumed:
 *   Europe/Paris      +01:00 -> +02:00 at 2026-03-29T01:00Z, +02:00 -> +01:00 at 2026-10-25T01:00Z;
 *   Africa/Casablanca NOT a fixed offset: +01:00 -> +00:00 at 2026-02-15T02:00Z (Ramadan),
 *                     +00:00 -> +01:00 at 2026-03-22T02:00Z.
 *
 * The subject is reached through CalendarDayProbe.kt (parisDayAt / claimAt), which is the ONLY file that
 * knows which types CalendarDay takes. This file moves to :shared's commonTest with CalendarDay by `git mv`,
 * unedited; the probe is what is rewritten.
 */
class CalendarDayGoldenTest {
    private fun assertDay(
        expected: String,
        instant: String,
        deviceZone: String,
    ) = assertEquals(expected, parisDayAt(instant, deviceZone), "the Paris day of $instant on a device in $deviceZone")

    private fun assertClaim(
        expected: String,
        instant: String,
        deviceZone: String,
    ) = assertEquals(expected, claimAt(instant, deviceZone), "clientClaimedAt of $instant on a device in $deviceZone")

    @Test
    fun aCasablancaDeviceAt2330InParisSummerTimeRecordsTheParisDay() {
        // 23:30 in Casablanca (+01:00) is 00:30 the NEXT day in Paris (+02:00). The day is Paris's; the claim
        // is the device's own wall clock, so the claim is dated the day BEFORE the recorded day - by design.
        assertDay("2026-07-02", "2026-07-01T22:30:00Z", "Africa/Casablanca")
        assertClaim("2026-07-01T23:30:00.000+01:00", "2026-07-01T22:30:00Z", "Africa/Casablanca")

        // The same hour on the S9 this week, until Paris leaves summer time on 25 October.
        assertDay("2026-10-22", "2026-10-21T22:30:00Z", "Africa/Casablanca")
        assertClaim("2026-10-21T23:30:00.000+01:00", "2026-10-21T22:30:00Z", "Africa/Casablanca")

        // After 25 October both zones are +01:00 and the two calendars agree at every hour.
        assertDay("2026-10-27", "2026-10-26T23:30:00Z", "Africa/Casablanca")
        assertClaim("2026-10-27T00:30:00.000+01:00", "2026-10-26T23:30:00Z", "Africa/Casablanca")
    }

    @Test
    fun casablancaIsNotAFixedOffsetSoNeitherIsItsClaim() {
        // During Ramadan 2026 Casablanca is +00:00, so 23:30 local is 23:30Z: still the 1st locally, already
        // the 2nd in Paris (+01:00 in March). A test that assumed "+01:00" would read this case wrongly.
        assertDay("2026-03-02", "2026-03-01T23:30:00Z", "Africa/Casablanca")
        assertClaim("2026-03-01T23:30:00.000+00:00", "2026-03-01T23:30:00Z", "Africa/Casablanca")
    }

    @Test
    fun theParisDayAndClaimAcrossTheMarch2026Change() {
        assertDay("2026-03-29", "2026-03-28T23:30:00Z", "Europe/Paris")
        assertClaim("2026-03-29T00:30:00.000+01:00", "2026-03-28T23:30:00Z", "Europe/Paris")
        // The last millisecond before the gap, and the first instant after it: 01:59:59.999 is followed by 03:00.
        assertClaim("2026-03-29T01:59:59.999+01:00", "2026-03-29T00:59:59.999Z", "Europe/Paris")
        assertClaim("2026-03-29T03:00:00.000+02:00", "2026-03-29T01:00:00Z", "Europe/Paris")
        assertDay("2026-03-30", "2026-03-29T22:30:00Z", "Europe/Paris")
        assertClaim("2026-03-30T00:30:00.000+02:00", "2026-03-29T22:30:00Z", "Europe/Paris")
    }

    @Test
    fun theParisDayAndClaimAcrossTheOctober2026Change() {
        assertDay("2026-10-25", "2026-10-24T22:30:00Z", "Europe/Paris")
        assertClaim("2026-10-25T00:30:00.000+02:00", "2026-10-24T22:30:00Z", "Europe/Paris")
        // The repeated hour: two different instants with the same wall clock, told apart ONLY by the offset.
        assertClaim("2026-10-25T02:30:00.000+02:00", "2026-10-25T00:30:00Z", "Europe/Paris")
        assertClaim("2026-10-25T02:30:00.000+01:00", "2026-10-25T01:30:00Z", "Europe/Paris")
        assertDay("2026-10-25", "2026-10-25T22:30:00Z", "Europe/Paris")
        assertClaim("2026-10-25T23:30:00.000+01:00", "2026-10-25T22:30:00Z", "Europe/Paris")
        assertDay("2026-10-26", "2026-10-25T23:30:00Z", "Europe/Paris")
        assertClaim("2026-10-26T00:30:00.000+01:00", "2026-10-25T23:30:00Z", "Europe/Paris")
    }

    @Test
    fun newYearsEve() {
        // A device on UTC: the year turns in Paris an hour before it turns on the device.
        assertDay("2026-12-31", "2026-12-31T22:59:59.999Z", "UTC")
        assertDay("2027-01-01", "2026-12-31T23:00:00Z", "UTC")
        assertDay("2027-01-01", "2026-12-31T23:30:00Z", "UTC")
        assertClaim("2026-12-31T22:59:59.999+00:00", "2026-12-31T22:59:59.999Z", "UTC")
        assertClaim("2026-12-31T23:30:00.000+00:00", "2026-12-31T23:30:00Z", "UTC")
        // Casablanca is already in the new year too; Los Angeles is still mid-afternoon on the 31st.
        assertDay("2027-01-01", "2026-12-31T23:30:00Z", "Africa/Casablanca")
        assertClaim("2027-01-01T00:30:00.000+01:00", "2026-12-31T23:30:00Z", "Africa/Casablanca")
        assertDay("2027-01-01", "2026-12-31T23:30:00Z", "America/Los_Angeles")
        assertClaim("2026-12-31T15:30:00.000-08:00", "2026-12-31T23:30:00Z", "America/Los_Angeles")
    }

    @Test
    fun aWholeMinuteKeepsItsZeroSecondsAndMilliseconds() {
        // THE DEFECT THE FIXED PATTERN EXISTS FOR: an ISO formatter writes this as "...T12:00+02:00".
        assertClaim("2026-07-01T12:00:00.000+02:00", "2026-07-01T10:00:00Z", "Europe/Paris")
        assertClaim("2026-12-31T23:00:00.000+00:00", "2026-12-31T23:00:00Z", "UTC")
    }

    @Test
    fun aZeroOffsetIsWrittenPlusZeroZeroNeverZ() {
        // The pattern's "xxx" never writes "Z". The server would accept "Z", but what a tap writes does not
        // change, and an ISO offset formatter would write "Z" here.
        assertClaim("2026-07-01T10:00:00.000+00:00", "2026-07-01T10:00:00Z", "UTC")
    }

    @Test
    fun negativeAndHalfHourOffsetsAreWrittenInFull() {
        assertClaim("2026-12-31T15:30:00.000-08:00", "2026-12-31T23:30:00Z", "America/Los_Angeles")
        assertClaim("2026-07-01T15:30:00.000+05:30", "2026-07-01T10:00:00Z", "Asia/Kolkata")
        assertDay("2026-07-01", "2026-07-01T10:00:00Z", "Asia/Kolkata")
    }

    @Test
    fun aSubMillisecondInstantIsTruncatedNeverRounded() {
        assertClaim("2026-07-01T12:00:00.123+02:00", "2026-07-01T10:00:00.123456789Z", "Europe/Paris")
        // Rounding would carry into the minute and claim 12:01:00.000 - a time the tap never happened at.
        assertClaim("2026-07-01T12:00:59.999+02:00", "2026-07-01T10:00:59.999999999Z", "Europe/Paris")
    }
}
