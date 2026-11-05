package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.dossier.LatenessForecast
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.fail
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2c R787. THE PIN, written and run green on the calendar's java.time date work BEFORE it moves to :shared and
// onto kotlinx-datetime (R777's shape). kotlin.test only - no Kotest, no java.* - so after the port this same file is
// moved to commonTest by `git mv`, unedited, and runs there on the JVM and on the iOS simulator. Every expected value
// is a literal: the java.time run is the oracle that confirmed them, the port must reproduce them.
//
// What the calendar does with dates, and so what is pinned:
//   - the Paris day of the clock's instant ("today": the grid's today cell, the future-day refusal, the opening month)
//     on both 2026 DST change days - Europe/Paris and Europe/Zurich change at the same instant under the EU rule
//     (01:00 UTC), so each instant below is named in both zones' wall-clock time - and across a month end, 29 Feb 2024
//     and 31 Dec -> 1 Jan;
//   - the month the calendar opens on (openingMonth), alone and composed with that day;
//   - the late prediction (wouldBeLateOn): the server's rule, UTC midnight of the day + the threshold, STRICTLY
//     greater - pinned at the exact millisecond either side, on the same boundary days;
//   - the bulk confirmation, which turns the confirming tap's instant into a count of late days.
// Each group collects every mismatch before failing, so one run shows the whole picture.
class CalendarDatesPinTest {
    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time Clock and Instant - on the allowlist.
    private fun todayAt(instant: String): String {
        val at = Instant.parse(instant)
        return todayInParis(
            object : Clock {
                override fun now(): Instant = at
            },
        )
    }

    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
    private fun lateAt(
        isoDay: String,
        instant: String,
    ): Boolean = wouldBeLateOn(isoDay, Instant.parse(instant))

    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
    private fun bulkAt(
        days: Set<String>,
        recorded: List<String>,
        instant: String,
    ): BulkConfirmation =
        bulkConfirmation(
            selectedDays = days,
            entries = recorded.map(::row),
            kind = RecordedKind.ABSENCE,
            absence = AbsenceChoice.CONGE,
            now = Instant.parse(instant),
        )

    private fun row(dayDate: String): EntryEntity =
        EntryEntity(
            clientMutationId = "m-$dayDate",
            dayDate = dayDate,
            portion = Portion.FULL,
            kind = EntryKind.HOME,
            absenceReason = null,
            note = null,
            provenance = Provenance.MANUAL,
            detectedKind = null,
            detectedAt = null,
            clientClaimedAt = null,
            serverId = null,
            firstRecordedAt = null,
            lastModifiedAt = null,
            syncState = SyncState.PENDING,
        )

    private fun failIfAny(
        group: String,
        mismatches: List<String>,
    ) {
        if (mismatches.isNotEmpty()) fail("$group: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))
    }

    @Test
    fun theParisDayOfAnInstant() {
        // instant -> the Paris day. Comments: the wall clock in Paris = Zurich (same EU rule, same instants).
        val vectors =
            listOf(
                // spring forward, Sunday 29 March 2026: 02:00 CET -> 03:00 CEST at 01:00 UTC
                // 23:59:59.999 CET
                "2026-03-28T22:59:59.999Z" to "2026-03-28",
                // 00:00 CET
                "2026-03-28T23:00:00Z" to "2026-03-29",
                // 01:59:59.999 CET, the last before the change
                "2026-03-29T00:59:59.999Z" to "2026-03-29",
                // 03:00 CEST, the first after it
                "2026-03-29T01:00:00Z" to "2026-03-29",
                // 23:59:59.999 CEST
                "2026-03-29T21:59:59.999Z" to "2026-03-29",
                // 00:00 CEST
                "2026-03-29T22:00:00Z" to "2026-03-30",
                // fall back, Sunday 25 October 2026: 03:00 CEST -> 02:00 CET at 01:00 UTC
                // 23:59:59.999 CEST
                "2026-10-24T21:59:59.999Z" to "2026-10-24",
                // 00:00 CEST
                "2026-10-24T22:00:00Z" to "2026-10-25",
                // 02:30 CEST, the first 02:30
                "2026-10-25T00:30:00Z" to "2026-10-25",
                // 02:30 CET, the second 02:30
                "2026-10-25T01:30:00Z" to "2026-10-25",
                // 23:59:59.999 CET (a 25-hour day)
                "2026-10-25T22:59:59.999Z" to "2026-10-25",
                // 00:00 CET
                "2026-10-25T23:00:00Z" to "2026-10-26",
                // month ends, summer and winter
                "2026-05-31T21:59:59.999Z" to "2026-05-31",
                "2026-05-31T22:00:00Z" to "2026-06-01",
                "2026-01-31T22:59:59.999Z" to "2026-01-31",
                "2026-01-31T23:00:00Z" to "2026-02-01",
                // 29 February 2024
                "2024-02-28T22:59:59.999Z" to "2024-02-28",
                "2024-02-28T23:00:00Z" to "2024-02-29",
                "2024-02-29T22:59:59.999Z" to "2024-02-29",
                "2024-02-29T23:00:00Z" to "2024-03-01",
                // 31 December -> 1 January
                "2026-12-31T22:59:59.999Z" to "2026-12-31",
                "2026-12-31T23:00:00Z" to "2027-01-01",
            )
        failIfAny(
            "todayInParis",
            vectors.mapNotNull { (instant, day) ->
                val got = todayAt(instant)
                if (got == day) null else "<$instant> expected <$day> but was <$got>"
            },
        )
    }

    @Test
    fun theMonthTheCalendarOpensOn() {
        // (today, taxYear, first navigable month or null = no settings) -> the opening month.
        data class V(val today: String, val taxYear: Int, val first: Int?, val month: Int)
        val vectors =
            listOf(
                V("2026-05-31", 2026, 1, 5),
                V("2026-06-01", 2026, 1, 6),
                V("2026-01-31", 2026, 1, 1),
                V("2026-02-01", 2026, 1, 2),
                V("2026-03-29", 2026, 1, 3),
                V("2026-10-25", 2026, 1, 10),
                // before the period's start month: clamped up to it
                V("2026-03-29", 2026, 11, 11),
                V("2026-12-31", 2026, 1, 12),
                // another year: the first navigable month
                V("2027-01-01", 2026, 1, 1),
                V("2027-01-01", 2026, 4, 4),
                V("2027-01-01", 2027, 1, 1),
                V("2025-12-31", 2026, 5, 5),
                V("2024-02-29", 2024, 1, 2),
                V("2024-03-01", 2024, 1, 3),
                V("2024-02-29", 2024, 3, 3),
                // no settings: today's month, unclamped
                V("2024-02-29", 2024, null, 2),
                V("2026-07-15", 2026, null, 7),
                V("2027-01-01", 2026, null, 1),
            )
        failIfAny(
            "openingMonth",
            vectors.mapNotNull { v ->
                val got = openingMonth(v.today, v.taxYear, v.first)
                if (got == v.month) null else "<$v> expected <${v.month}> but was <$got>"
            },
        )
        // Composed as the controller composes them: the clock's instant -> the Paris day -> the opening month.
        val composed =
            listOf(
                Triple("2026-05-31T21:59:59.999Z", 2026, 5),
                Triple("2026-05-31T22:00:00Z", 2026, 6),
                Triple("2026-12-31T22:59:59.999Z", 2026, 12),
                Triple("2026-12-31T23:00:00Z", 2026, 1),
                Triple("2026-12-31T23:00:00Z", 2027, 1),
                Triple("2024-02-29T22:59:59.999Z", 2024, 2),
                Triple("2024-02-29T23:00:00Z", 2024, 3),
                Triple("2026-03-29T00:59:59.999Z", 2026, 3),
                Triple("2026-10-25T01:30:00Z", 2026, 10),
            )
        failIfAny(
            "openingMonth(todayInParis)",
            composed.mapNotNull { (instant, taxYear, month) ->
                val got = openingMonth(todayAt(instant), taxYear, 1)
                if (got == month) null else "<$instant, $taxYear> expected <$month> but was <$got>"
            },
        )
    }

    @Test
    fun theLatePredictionAtTheExactMillisecond() {
        // (day, instant) -> late? UTC midnight of the day + the threshold is NOT late; one millisecond more is.
        val vectors =
            listOf(
                Triple("2024-02-29", "2024-03-07T00:00:00Z", false),
                Triple("2024-02-29", "2024-03-07T00:00:00.001Z", true),
                Triple("2024-02-22", "2024-02-29T00:00:00Z", false),
                Triple("2024-02-22", "2024-02-29T00:00:00.001Z", true),
                Triple("2026-12-31", "2027-01-07T00:00:00Z", false),
                Triple("2026-12-31", "2027-01-07T00:00:00.001Z", true),
                Triple("2026-12-25", "2027-01-01T00:00:00Z", false),
                Triple("2026-12-25", "2027-01-01T00:00:00.001Z", true),
                Triple("2026-05-31", "2026-06-07T00:00:00Z", false),
                Triple("2026-05-31", "2026-06-07T00:00:00.001Z", true),
                Triple("2026-02-28", "2026-03-07T00:00:00Z", false),
                Triple("2026-02-28", "2026-03-07T00:00:00.001Z", true),
                // the DST days: the rule is UTC, so the change of wall clock moves nothing
                Triple("2026-03-29", "2026-04-05T00:00:00Z", false),
                Triple("2026-03-29", "2026-04-05T00:00:00.001Z", true),
                // 01:00 CET in Paris and Zurich
                Triple("2026-03-22", "2026-03-29T00:00:00Z", false),
                // 01:59:59.999 CET
                Triple("2026-03-22", "2026-03-29T00:59:59.999Z", true),
                // 03:00 CEST
                Triple("2026-03-22", "2026-03-29T01:00:00Z", true),
                Triple("2026-10-25", "2026-11-01T00:00:00Z", false),
                Triple("2026-10-25", "2026-11-01T00:00:00.001Z", true),
                // 02:00 CEST
                Triple("2026-10-18", "2026-10-25T00:00:00Z", false),
                // 02:30 CEST
                Triple("2026-10-18", "2026-10-25T00:30:00Z", true),
                // 02:30 CET
                Triple("2026-10-18", "2026-10-25T01:30:00Z", true),
                // today and tomorrow are never late
                Triple("2026-06-15", "2026-06-15T10:00:00Z", false),
                Triple("2026-06-16", "2026-06-15T10:00:00Z", false),
            )
        failIfAny(
            "wouldBeLateOn",
            vectors.mapNotNull { (day, instant, late) ->
                val got = lateAt(day, instant)
                if (got == late) null else "<$day at $instant> expected <$late> but was <$got>"
            },
        )
    }

    /** One bulk vector: the chosen days, the days already holding a row, the tap's instant -> the confirmation. */
    private data class V(
        val days: Set<String>,
        val recorded: List<String>,
        val instant: String,
        val sorted: List<String>,
        val already: Int,
        val late: Int,
    )

    private val bulkVectors =
        listOf(
            // across the year end: 12-24 is 8 days old, 12-25 exactly 7 (not late), then one millisecond more
            V(
                setOf("2026-12-31", "2026-12-24", "2027-01-01", "2026-12-25"),
                listOf("2026-12-31", "2026-11-30"),
                "2027-01-01T00:00:00Z",
                listOf("2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"),
                1,
                1,
            ),
            V(
                setOf("2026-12-31", "2026-12-24", "2027-01-01", "2026-12-25"),
                listOf("2026-12-31", "2026-11-30"),
                "2027-01-01T00:00:00.001Z",
                listOf("2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"),
                1,
                2,
            ),
            // spring forward: the tap at 01:00 CET and at 03:00 CEST (Paris and Zurich)
            V(
                setOf("2026-03-23", "2026-03-21", "2026-03-22"),
                emptyList(),
                "2026-03-29T00:00:00Z",
                listOf("2026-03-21", "2026-03-22", "2026-03-23"),
                0,
                1,
            ),
            V(
                setOf("2026-03-23", "2026-03-21", "2026-03-22"),
                listOf("2026-03-21", "2026-03-22", "2026-03-23"),
                "2026-03-29T01:00:00Z",
                listOf("2026-03-21", "2026-03-22", "2026-03-23"),
                3,
                2,
            ),
            // fall back: the second 02:30
            V(
                setOf("2026-10-25", "2026-10-17", "2026-10-18"),
                listOf("2026-10-18"),
                "2026-10-25T01:30:00Z",
                listOf("2026-10-17", "2026-10-18", "2026-10-25"),
                1,
                2,
            ),
            // 29 February 2024, at noon UTC on the day itself and a week later
            V(
                setOf("2024-03-01", "2024-02-29", "2024-02-22", "2024-02-21"),
                listOf("2024-02-29"),
                "2024-02-29T12:00:00Z",
                listOf("2024-02-21", "2024-02-22", "2024-02-29", "2024-03-01"),
                1,
                2,
            ),
            V(
                setOf("2024-03-01", "2024-02-29", "2024-02-22", "2024-02-21"),
                emptyList(),
                "2024-03-07T12:00:00Z",
                listOf("2024-02-21", "2024-02-22", "2024-02-29", "2024-03-01"),
                0,
                3,
            ),
            // a month end
            V(
                setOf("2026-06-01", "2026-05-31", "2026-05-24"),
                emptyList(),
                "2026-06-07T00:00:00.001Z",
                listOf("2026-05-24", "2026-05-31", "2026-06-01"),
                0,
                2,
            ),
        )

    @Test
    fun theBulkConfirmationCountsAtTheConfirmingInstant() {
        val vectors = bulkVectors
        failIfAny(
            "bulkConfirmation",
            vectors.mapNotNull { v ->
                val got = bulkAt(v.days, v.recorded, v.instant)
                val expected =
                    BulkConfirmation(
                        days = v.sorted,
                        kind = RecordedKind.ABSENCE,
                        absence = AbsenceChoice.CONGE,
                        alreadyRecordedCount = v.already,
                        lateCount = v.late,
                        lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
                    )
                if (got == expected) null else "<${v.days} at ${v.instant}> expected <$expected> but was <$got>"
            },
        )
        assertEquals(8, vectors.size, "every bulk vector was checked")
    }
}
