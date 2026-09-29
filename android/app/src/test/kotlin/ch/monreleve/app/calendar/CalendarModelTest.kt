package ch.monreleve.app.calendar

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.settings.Settings
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant
import java.time.LocalDate

// AN10 increment 1. The pure month model (CalendarModel). No coroutines, no clock: `today` is supplied
// as the Paris day string (R28 lives in the controller, which derives it). These assertions cover the
// record made VISIBLE (AC2): missing reads as missing, a synced day past the threshold reads as late by
// the SERVER'S own firstRecordedAt (R216), and a still-pending day reads as pending, never late.

private const val TAX_YEAR = 2026

private fun settings(activityStartDate: String? = null): Settings {
    return Settings("GE", 100, "SIMPLIFIED240", null, "DAY", activityStartDate)
}

private fun entry(
    dayDate: String,
    kind: EntryKind,
    portion: Portion = Portion.FULL,
    syncState: SyncState = SyncState.PENDING,
    firstRecordedAt: String? = null,
): EntryEntity =
    EntryEntity(
        clientMutationId = "$dayDate-$portion",
        dayDate = dayDate,
        portion = portion,
        kind = kind,
        absenceReason = if (kind == EntryKind.ABSENT) AbsenceReason.FERIE else null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = if (syncState == SyncState.SYNCED) "srv-$dayDate" else null,
        firstRecordedAt = firstRecordedAt,
        lastModifiedAt = null,
        syncState = syncState,
    )

/** A synced row with the server's own firstRecordedAt - the input the late flag is read from (R216). */
private fun synced(
    dayDate: String,
    kind: EntryKind,
    firstRecordedAt: String,
): EntryEntity = entry(dayDate, kind, syncState = SyncState.SYNCED, firstRecordedAt = firstRecordedAt)

/** UTC midnight of a day, the instant the threshold is measured from (as the server measures it). */
private fun startOfUtcDay(day: String): Instant = Instant.parse("${day}T00:00:00Z")

/** The threshold instant: exactly at the boundary (NOT late, strictly greater) and one millisecond past. */
private fun atThreshold(day: String): Instant {
    return startOfUtcDay(day).plus(Duration.ofDays(LatenessForecast.BACKFILL_DAYS.toLong()))
}

class CalendarModelTest : FunSpec({
    fun june(
        entries: List<EntryEntity>,
        today: String,
    ): MonthView = buildMonthView(entries, settings(), TAX_YEAR, today, 6)

    fun dayOf(
        view: MonthView,
        d: Int,
    ): CalendarDayUi = view.days.first { it.dayOfMonth == d }

    test("June has thirty days and the leading blanks align day one to its weekday") {
        val view = june(emptyList(), "2026-06-15")
        view.days.size shouldBe 30
        view.leadingBlanks shouldBe (LocalDate.of(2026, 6, 1).dayOfWeek.value - 1)
    }

    test("a synced day recorded within the threshold reads as on time") {
        // firstRecordedAt exactly at the threshold is NOT late (strictly greater, like the server).
        val onTime = synced("2026-06-01", EntryKind.HOME, atThreshold("2026-06-01").toString())
        val view = june(listOf(onTime), "2026-06-15")
        dayOf(view, 1).quality shouldBe RecordQuality.ON_TIME
    }

    test("a synced day recorded past the threshold reads as late from the server's own timestamp (R216)") {
        val past = atThreshold("2026-06-02").plusMillis(1).toString()
        val view = june(listOf(synced("2026-06-02", EntryKind.HOME, past)), "2026-06-15")
        dayOf(view, 2).quality shouldBe RecordQuality.LATE
    }

    test("a recorded day the server has not yet seen reads as pending, never late") {
        val view = june(listOf(entry("2026-06-03", EntryKind.HOME)), "2026-06-15")
        dayOf(view, 3).quality shouldBe RecordQuality.PENDING
    }

    test("a past working day with no entry reads as missing; today does not, and weekends do not") {
        // today 2026-06-15 is a Monday; 12 Jun (Fri) is a past weekday, 13 Jun (Sat) a weekend.
        val view = june(emptyList(), "2026-06-15")
        dayOf(view, 12).quality shouldBe RecordQuality.MISSING
        dayOf(view, 13).quality shouldBe RecordQuality.NONE
        dayOf(view, 15).quality shouldBe RecordQuality.NONE
        dayOf(view, 16).quality shouldBe RecordQuality.NONE
    }

    test("only in-period, non-future days are recordable (AC1)") {
        val view = june(emptyList(), "2026-06-15")
        dayOf(view, 10).recordable shouldBe true
        dayOf(view, 20).recordable shouldBe false
    }

    test("the kind letter carries the country (R202): HOME becomes Domicile") {
        val view = june(listOf(entry("2026-06-04", EntryKind.HOME)), "2026-06-15")
        dayOf(view, 4).kind shouldBe DayKind.DOMICILE
    }

    test("the month summary counts kinds and missing days; an absence is not a working-day figure (D28)") {
        val entries =
            listOf(
                synced("2026-06-01", EntryKind.CH, "2026-06-01T08:00:00Z"),
                synced("2026-06-02", EntryKind.HOME, "2026-06-02T08:00:00Z"),
                synced("2026-06-03", EntryKind.MISSION_FR, "2026-06-03T08:00:00Z"),
                synced("2026-06-04", EntryKind.ABSENT, "2026-06-04T08:00:00Z"),
            )
        val view = june(entries, "2026-06-30")
        view.summary.suisse shouldBe 1.0
        view.summary.domicile shouldBe 1.0
        view.summary.mission shouldBe 1.0
        // 2026-06-04 is recorded (absence), so it is not counted as missing, nor as a working day.
        view.summary.nonRenseigne shouldBe view.days.count { it.quality == RecordQuality.MISSING }.toDouble()
    }

    test("a mixed half-day shows the morning kind and the least-settled quality (PARKAN)") {
        val entries =
            listOf(
                synced("2026-06-05", EntryKind.HOME, "2026-06-05T08:00:00Z").copy(portion = Portion.AM),
                entry("2026-06-05", EntryKind.CH, portion = Portion.PM),
            )
        val view = june(entries, "2026-06-15")
        dayOf(view, 5).kind shouldBe DayKind.DOMICILE
        dayOf(view, 5).quality shouldBe RecordQuality.PENDING
    }

    test("a mid-year start narrows the period: days before it are out of period, not missing") {
        // Activity starts 15 Jul; view July with today in August so the whole month is past.
        val view = buildMonthView(emptyList(), settings("2026-07-15"), TAX_YEAR, "2026-08-01", 7)
        dayOf(view, 10).recordable shouldBe false
        dayOf(view, 10).quality shouldBe RecordQuality.NONE
        dayOf(view, 20).quality shouldBe RecordQuality.MISSING
        firstNavMonth(settings("2026-07-15"), TAX_YEAR) shouldBe 7
        view.canGoPrev shouldBe false
    }
})
