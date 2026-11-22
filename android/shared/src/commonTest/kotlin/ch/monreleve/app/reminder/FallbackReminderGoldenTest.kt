package ch.monreleve.app.reminder

import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-MOVE-REMINDER R1290. THE PORT IS PROVEN, NOT ASSUMED: nextFallbackAt, bootFallbackAt and reachedFallbackTime,
// ported from java.time to kotlinx-datetime, return on THIS platform (the JVM in :shared's unit tests, the iOS
// simulator in ios-shared.yml) exactly what the java.time versions returned at the base, before anything changed.
//
// The expected values are FALLBACK_REMINDER_JAVA_TIME_ROWS (FallbackReminderJavaTimeFixture.kt), written by a capture
// test that ran the java.time FallbackReminder.kt in :app's JVM tests at 2168ad5a, copied byte for byte - no value is
// typed. The inputs cover both DST changes in Europe/Zurich and Europe/Paris (the evenings either side, the spring
// gap, the autumn repeated hour), 18:59 / 19:00 / 19:01, one nanosecond either side of 19:00 and of local midnight, a
// zone change (the same instants in six zones - London, UTC, New York and Kolkata's half hour among them), the year's
// end and a leap day. Instants are compared as VALUES, never as strings: the two libraries print fractions
// differently, and a string comparison would fail on a difference that is not one.

private const val R1290_ZONES = 6
private const val R1290_MIN_INSTANTS_PER_ZONE = 40

class FallbackReminderGoldenTest {
    private class Row(
        val zone: String,
        val now: String,
        val next: String,
        val boot: String,
        val reached: Boolean,
    )

    private fun rows(): List<Row> =
        FALLBACK_REMINDER_JAVA_TIME_ROWS.map { line ->
            val cells = line.split(";")
            assertEquals(5, cells.size, "a fixture row has five cells: $line")
            Row(cells[0], cells[1], cells[2], cells[3], cells[4].toBooleanStrict())
        }

    /** Every answer the common functions give differently from java.time, named (empty when the port is the same). */
    @OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1290: kotlin.time.Instant - on the allowlist.
    private fun mismatches(): List<String> =
        rows().flatMap { row ->
            val zone = TimeZone.of(row.zone)
            val now = Instant.parse(row.now)
            val where = "${row.zone} ${row.now}"
            listOfNotNull(
                "$where nextFallbackAt".takeIf { nextFallbackAt(now, zone) != Instant.parse(row.next) },
                "$where bootFallbackAt".takeIf { bootFallbackAt(now, zone) != Instant.parse(row.boot) },
                "$where reachedFallbackTime".takeIf { reachedFallbackTime(now, zone) != row.reached },
            )
        }

    @Test
    fun theCommonFunctionsReturnWhatJavaTimeReturnedOnEveryRow() {
        val found = mismatches()
        assertTrue(
            found.isEmpty(),
            "R1290: the port differs from java.time on ${found.size} answer(s):\n" + found.joinToString("\n"),
        )
    }

    @Test
    fun theFixtureWasReadAndCarriesBothSidesOfEveryAnswer() {
        val rows = rows()
        // Presence first (R154): the rows are there, for every zone, with both answers of every function.
        assertEquals(R1290_ZONES, rows.map { it.zone }.toSet().size, "the six zones")
        assertEquals(rows.size, rows.map { it.zone to it.now }.toSet().size, "one row per (zone, instant)")
        assertTrue(rows.size >= R1290_ZONES * R1290_MIN_INSTANTS_PER_ZONE, "too few rows: ${rows.size}")
        assertTrue(rows.any { it.reached } && rows.any { !it.reached }, "reached: both true and false")
        assertTrue(rows.any { it.boot == it.now } && rows.any { it.boot != it.now }, "boot: now, and a later 19:00")
        assertTrue(rows.any { it.boot == it.next } && rows.any { it.boot != it.next }, "boot: equal to next, and not")
        assertTrue(rows.any { it.now.endsWith(".000000001Z") }, "a nanosecond after an instant")
        assertTrue(rows.any { it.now.endsWith(".999999999Z") }, "a nanosecond before an instant")
        assertTrue(listOf("Europe/Zurich", "Europe/Paris").all { z -> rows.any { it.zone == z } }, "Zurich, Paris")
    }
}
