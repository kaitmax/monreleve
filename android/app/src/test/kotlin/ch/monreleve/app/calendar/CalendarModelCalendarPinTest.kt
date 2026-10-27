package ch.monreleve.app.calendar

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.settings.Settings
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

// IOS-1b-A R602c. THE PIN, written and run green on the java.time CalendarModel BEFORE it moved to :shared and
// onto kotlinx-datetime. java.time is the ORACLE here, computed independently of the code under test, so after the
// port this same file proves the kotlinx version lays out every month and every week exactly as before:
//   - every month of 2024-2028 (two leap years): the Monday-first leading blanks, the month's length, each cell's
//     ISO date, the weekend/MISSING rule, today and the recordable bound;
//   - the week strip for every day from 2026-12-20 to 2027-01-10 and through February 2028 (a week crossing a
//     month, a year and a leap day);
//   - a period start inside the year narrows the first navigable month, a malformed or other-year start does not;
//   - serverLate reads a Z timestamp and an offset timestamp as the same instant (the java.time fallback).
class CalendarModelCalendarPinTest {
    private fun settings(start: String? = null) = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", start)

    private fun synced(
        day: String,
        firstRecordedAt: String,
    ) = EntryEntity(
        clientMutationId = "$day-FULL",
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.CH,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$day",
        firstRecordedAt = firstRecordedAt,
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
    )

    @Test
    fun everyMonthOfFiveYearsLaysOutAsJavaTimeSays() {
        val today = "2026-06-15"
        var months = 0
        for (year in 2024..2028) {
            for (month in 1..12) {
                val view = buildMonthView(emptyList(), settings(), year, today, month)
                val ym = YearMonth.of(year, month)
                assertEquals("$ym blanks", LocalDate.of(year, month, 1).dayOfWeek.value - 1, view.leadingBlanks)
                assertEquals("$ym length", ym.lengthOfMonth(), view.days.size)
                view.days.forEachIndexed { i, cell ->
                    val date = ym.atDay(i + 1)
                    assertEquals("$ym iso", date.toString(), cell.isoDate)
                    assertEquals("$ym dom", i + 1, cell.dayOfMonth)
                    val weekend = date.dayOfWeek.value >= 6
                    val past = date.toString() < today
                    val expectMissing = past && !weekend
                    assertEquals("$date missing", expectMissing, cell.quality.name == "MISSING")
                    assertEquals("$date today", date.toString() == today, cell.isToday)
                    assertEquals("$date recordable", date.toString() <= today, cell.recordable)
                }
                assertEquals("$ym canGoNext", month < 12, view.canGoNext)
                assertEquals("$ym canGoPrev", month > 1, view.canGoPrev)
                months++
            }
        }
        assertEquals(60, months)
    }

    @Test
    fun theWeekStripIsMondayToFridayOfTodaysWeek() {
        fun span(
            from: LocalDate,
            to: LocalDate,
        ) = generateSequence(from) { it.plusDays(1) }.takeWhile { it <= to }
        val days =
            span(LocalDate.of(2026, 12, 20), LocalDate.of(2027, 1, 10)) +
                span(LocalDate.of(2028, 2, 1), LocalDate.of(2028, 3, 3))
        var checked = 0
        for (today in days) {
            val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
            val expected = (0L until 5L).map { monday.plusDays(it).toString() }
            val cells = weekdayCells(emptyList(), settings(), today.year, today.toString())
            assertEquals("week of $today", expected, cells.map { it.isoDate })
            checked++
        }
        assertEquals(22 + 32, checked)
    }

    @Test
    fun aPeriodStartNarrowsTheFirstMonthOnlyInsideTheYear() {
        assertEquals(7, firstNavMonth(settings("2026-07-15"), 2026))
        assertEquals(1, firstNavMonth(settings("2025-07-15"), 2026))
        assertEquals(1, firstNavMonth(settings("not-a-date"), 2026))
        assertEquals(1, firstNavMonth(settings(null), 2026))
        val view = buildMonthView(emptyList(), settings("2026-03-10"), 2026, "2026-06-15", 3)
        assertEquals(listOf(false, true), listOf(view.days[8].recordable, view.days[9].recordable))
        assertEquals("2026-03-09 before the period is not missing", "NONE", view.days[8].quality.name)
    }

    @Test
    fun serverLateReadsZAndOffsetTimestampsAsOneInstant() {
        // 2026-06-01 recorded 9 days later: late by the 7-day rule either way the timestamp is written.
        assertEquals(true, serverLate(synced("2026-06-01", "2026-06-10T08:00:00.000Z")))
        assertEquals(true, serverLate(synced("2026-06-01", "2026-06-10T10:00:00.000+02:00")))
        // recorded the next day: on time either way.
        assertEquals(false, serverLate(synced("2026-06-01", "2026-06-02T08:00:00.000Z")))
        assertEquals(false, serverLate(synced("2026-06-01", "2026-06-02T10:00:00+02:00")))
        // unparseable: not judged late, never a crash.
        assertEquals(false, serverLate(synced("2026-06-01", "yesterday")))
    }
}
