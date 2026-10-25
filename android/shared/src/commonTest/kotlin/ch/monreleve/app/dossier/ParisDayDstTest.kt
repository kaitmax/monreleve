package ch.monreleve.app.dossier

import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.daysUntil
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.plus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// KMP-0 increment 6 (R371), WRITTEN BEFORE any dated file moved. Two jobs, kept apart on purpose:
//
//   1. parisDayOf resolves the correct Paris calendar day across BOTH 2026 DST changes (spring-forward
//      Sun 29 Mar, fall-back Sun 25 Oct) and near midnight. This is the ONLY place a zone offset reaches
//      the record, so it is the only place DST can produce a wrong day - a wrong day is a wrong fiscal
//      count. PROVEN ABLE TO FAIL by a verified plant (R180): switching PARIS_ZONE to UTC fails exactly
//      the five cases below where the Paris day differs from the UTC day; reverted. A DST test that still
//      passes under UTC asserts nothing (the absence-assertion trap).
//
//   2. the kotlinx-datetime arithmetic the MOVED dossier/forecast code relies on means what java.time's
//      meant: daysUntil == ChronoUnit.DAYS.between, plus(1, DAY) crosses a DST date purely as a calendar
//      step, and isoDayNumber is 1=Monday..7=Sunday (the rhythm's weekday filter `in 1..5` depends on it).
//      These lock the migration's assumptions so a future kotlinx-datetime bump that changed them is RED.
class ParisDayDstTest {
    // CET = UTC+01:00 (winter), CEST = UTC+02:00 (summer). A case where the Paris day differs from the UTC
    // day (marked) is what the UTC plant falsifies; the others are controls where the two days agree.
    @Test
    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
    fun parisDayOf_resolvesTheParisDayAcrossBothDstChangesAndNearMidnight() {
        // Winter, CET (+1).
        assertEquals(LocalDate(2026, 1, 16), parisDayOf(Instant.parse("2026-01-15T23:30:00Z"))) // differs from UTC day
        assertEquals(LocalDate(2026, 1, 15), parisDayOf(Instant.parse("2026-01-15T22:30:00Z"))) // control

        // Summer, CEST (+2).
        assertEquals(LocalDate(2026, 7, 16), parisDayOf(Instant.parse("2026-07-15T22:30:00Z"))) // differs from UTC day
        assertEquals(LocalDate(2026, 7, 15), parisDayOf(Instant.parse("2026-07-15T21:30:00Z"))) // control

        // Spring-forward: Sun 29 Mar 2026, 02:00 CET -> 03:00 CEST (the transition is at 01:00 UTC).
        assertEquals(LocalDate(2026, 3, 29), parisDayOf(Instant.parse("2026-03-28T23:30:00Z"))) // differs from UTC day
        assertEquals(LocalDate(2026, 3, 29), parisDayOf(Instant.parse("2026-03-29T00:30:00Z"))) // before, CET
        assertEquals(LocalDate(2026, 3, 29), parisDayOf(Instant.parse("2026-03-29T01:30:00Z"))) // after, CEST

        // Fall-back: Sun 25 Oct 2026, 03:00 CEST -> 02:00 CET (the transition is at 01:00 UTC).
        assertEquals(LocalDate(2026, 10, 25), parisDayOf(Instant.parse("2026-10-24T22:30:00Z"))) // differs from UTC day
        assertEquals(LocalDate(2026, 10, 25), parisDayOf(Instant.parse("2026-10-25T12:00:00Z"))) // after, CET, control
        assertEquals(LocalDate(2026, 10, 26), parisDayOf(Instant.parse("2026-10-25T23:30:00Z"))) // differs from UTC day
    }

    @Test
    fun localDateArithmetic_matchesTheJavaTimeSemanticsTheMovedCodeReliesOn() {
        // plus(1, DAY) across the spring-forward date is a pure calendar step - no hour is lost, the next
        // date is simply the next date (java.time LocalDate.plusDays did the same).
        assertEquals(LocalDate(2026, 3, 30), LocalDate(2026, 3, 29).plus(1, DateTimeUnit.DAY))
        assertEquals(LocalDate(2026, 10, 26), LocalDate(2026, 10, 25).plus(1, DateTimeUnit.DAY))

        // daysUntil is ChronoUnit.DAYS.between: exclusive of the start, so 2026 (not a leap year) gives 364
        // from 1 Jan to 31 Dec. remainingYearFraction's `+ 1` turns that into the 365 days in the year.
        assertEquals(364, LocalDate(2026, 1, 1).daysUntil(LocalDate(2026, 12, 31)))

        // isoDayNumber is 1=Monday..7=Sunday, java.time DayOfWeek.value exactly. 29 Mar 2026 is a Sunday (7),
        // 30 Mar 2026 the Monday after (1) - the rhythm counts weekdays as isoDayNumber in 1..5.
        assertEquals(7, LocalDate(2026, 3, 29).dayOfWeek.isoDayNumber)
        assertEquals(1, LocalDate(2026, 3, 30).dayOfWeek.isoDayNumber)
    }
}
