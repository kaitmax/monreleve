package ch.monreleve.app.data.sync

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// KMP-DT R552, WRITTEN ON kotlinx-datetime 0.6.1, BEFORE ANY VERSION MOVES. kotlinx-datetime's Instant.parse of
// every timestamp SHAPE this product exchanges - the contract a 0.7 bump (where Instant moves towards
// kotlin.time.Instant) must keep.
//
// THE SERVER SENDS ONE SHAPE. Every instant on the wire is a JavaScript Date serialised with toISOString()
// (web/lib/entries/read.ts `instant()`, web/lib/dossier/service.ts `instant()` and generatedAt): UTC, three
// fractional digits, a literal Z - "2026-10-24T19:36:04.876Z". The cases below vary what toISOString can vary:
// a non-zero and a zero millisecond, midnight on New Year's Day, the last millisecond of the year, and the
// two instants Paris changed its offset in 2026.
//
// THE CLIENT WRITES ANOTHER. clientClaimedAt carries the device's offset, never Z (CalendarDay.kt's
// CLAIM_FORMAT): "+02:00", "+01:00", "+00:00", a negative and a half-hour offset. The same wall clock twice in
// the October repeated hour must parse to two instants an hour apart.
//
// EVERY EXPECTED VALUE IS THE SERVER'S OWN PARSE, not kotlinx's: Date.parse(shape) in Node, the runtime that
// produced the strings. On 0.6.1 kotlinx agrees with all of them; that agreement is what is pinned. Today
// :app parses server instants with java.time (fr/format/Dates.kt, calendar/CalendarModel.kt) and hands them to
// :shared only as instants; this file is where the multiplatform parse - the one iOS will use - is held to the
// server's meaning.
class ServerInstantParseGoldenTest {
    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
    private fun assertEpochMillis(
        expected: Long,
        shape: String,
    ) = assertEquals(expected, Instant.parse(shape).toEpochMilliseconds(), "Instant.parse(\"$shape\")")

    @Test
    fun everyShapeTheServerSendsParsesToTheServersOwnInstant() {
        assertEpochMillis(1792870564876L, "2026-10-24T19:36:04.876Z")
        assertEpochMillis(1775587442000L, "2026-04-07T18:44:02.000Z")
        assertEpochMillis(1767225600000L, "2026-01-01T00:00:00.000Z")
        assertEpochMillis(1798761599999L, "2026-12-31T23:59:59.999Z")
        assertEpochMillis(1774746000000L, "2026-03-29T01:00:00.000Z")
        assertEpochMillis(1792890000000L, "2026-10-25T01:00:00.000Z")
    }

    @Test
    fun everyClaimShapeTheClientWritesParsesToTheSameInstantTheServerReads() {
        assertEpochMillis(1792888200000L, "2026-10-25T02:30:00.000+02:00")
        assertEpochMillis(1792891800000L, "2026-10-25T02:30:00.000+01:00")
        assertEpochMillis(1782900000000L, "2026-07-01T10:00:00.000+00:00")
        assertEpochMillis(1798759800000L, "2026-12-31T15:30:00.000-08:00")
        assertEpochMillis(1782900000000L, "2026-07-01T15:30:00.000+05:30")
    }

    @Test
    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
    fun theOctoberRepeatedHourIsTwoInstantsAnHourApart() {
        val first = Instant.parse("2026-10-25T02:30:00.000+02:00").toEpochMilliseconds()
        val second = Instant.parse("2026-10-25T02:30:00.000+01:00").toEpochMilliseconds()
        assertEquals(3_600_000L, second - first)
    }
}
