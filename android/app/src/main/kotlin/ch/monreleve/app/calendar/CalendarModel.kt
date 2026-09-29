package ch.monreleve.app.calendar

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.DayProvenance
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.settings.Settings
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.format.DateTimeParseException

// AN10 increment 1. The calendar's pure month model - no Android, no clock, no network. It turns the
// device's stored rows (Room) into what one month's grid renders, so the controller (which holds the
// repository and the clock) stays thin and the whole thing is JVM-testable.
//
// R28 - THE DAY IS AN ISO STRING, "today" IS SUPPLIED, NOT READ. Every date is a YYYY-MM-DD string in
// Europe/Paris; the caller passes the Paris `today` (todayInParis), so this file never touches a clock
// and the month is identical whatever timezone the device is set to. java.time here is calendar-only
// arithmetic on explicit dates (YearMonth, LocalDate, DayOfWeek), the same guarantee Aggregate.kt gets.
// The calendar is always the TAX YEAR, so there is one year value, not two.
//
// R216 - THE CLIENT MAY PREDICT, IT MUST NOT ADJUDICATE. A cell's LATE quality is the SERVER'S flag,
// recomputed from the server's own firstRecordedAt (the immutable evidence moment the sync returns,
// R217) by the SAME rule the server's late.ts uses - LatenessForecast.wouldBeLate, bound to
// fixtures/late-threshold-cases.json (R206, no second copy of the 7-day threshold). A row the server
// has not yet seen (firstRecordedAt null) is PENDING, never LATE: on-time-versus-late is not yet a fact.
//
// R202 - the UI vocabulary (DayKind/RecordQuality/DayProvenance, design/) is translated here from the
// wire's (EntryKind/Portion/Provenance, data/local); the wire enums never reach ui/.

/** One day of the visible month, in the grid's own vocabulary. */
data class CalendarDayUi(
    val dayOfMonth: Int,
    /** The ISO YYYY-MM-DD day in Europe/Paris (R28). */
    val isoDate: String,
    val kind: DayKind?,
    val quality: RecordQuality,
    val corrected: Boolean,
    val provenance: DayProvenance?,
    val isToday: Boolean,
    /** In the engine's period and not in the future: the only days a tap may record (AC1). */
    val recordable: Boolean,
)

/** The four counts under the grid (FD6 section 4). Absence is not a working-day figure and is excluded. */
data class MonthSummary(
    val suisse: Double,
    val domicile: Double,
    val mission: Double,
    val nonRenseigne: Double,
)

/** Everything one month's screen renders. */
data class MonthView(
    val year: Int,
    val month: Int,
    /** Empty cells before day 1 so the grid aligns to a Monday-first week (FD6). */
    val leadingBlanks: Int,
    val days: List<CalendarDayUi>,
    val summary: MonthSummary,
    /** The tax year's navigable bounds, narrowed to the engine's period for a partial year. */
    val canGoPrev: Boolean,
    val canGoNext: Boolean,
)

private const val LAST_MONTH = 12
private val WEEKEND = setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)

/**
 * The instant a server timestamp names. The server serialises via toISOString() (a Z form), which
 * Instant.parse accepts; OffsetDateTime is the fallback for an offset form, so a stored value that
 * ever carried +02:00 still reads. A firstRecordedAt that will not parse cannot be judged late, so it
 * is treated as not-yet-confirmed rather than crashing the grid.
 */
private fun parseServerInstant(iso: String): Instant? =
    try {
        Instant.parse(iso)
    } catch (_: DateTimeParseException) {
        try {
            OffsetDateTime.parse(iso).toInstant()
        } catch (_: DateTimeParseException) {
            null
        }
    }

private fun EntryKind.toDayKind(): DayKind =
    when (this) {
        EntryKind.CH -> DayKind.SUISSE
        EntryKind.HOME -> DayKind.DOMICILE
        EntryKind.MISSION_FR -> DayKind.MISSION
        EntryKind.MISSION_THIRD -> DayKind.MISSION
        EntryKind.ABSENT -> DayKind.ABSENCE
    }

private fun Provenance.toDayProvenance(): DayProvenance =
    when (this) {
        Provenance.MANUAL -> DayProvenance.MANUAL
        Provenance.DETECTED_CONFIRMED -> DayProvenance.DETECTED_CONFIRMED
        Provenance.DETECTED_CORRECTED -> DayProvenance.DETECTED_CORRECTED
    }

/**
 * Would the server flag this row « saisie tardive »? The ONE home for the late-from-server rule (R216 /
 * R206): true only once the row is SYNCED and its own firstRecordedAt is more than the threshold after
 * the day, by the SAME rule the server's late.ts uses (LatenessForecast.wouldBeLate, fixture-bound). A
 * pending row is not late - on-time-versus-late is not yet a server fact. Read by both the grid cell
 * (qualityOf) and the edit sheet (CalendarController), so the two cannot disagree.
 */
@Suppress("ReturnCount")
fun serverLate(entry: EntryEntity): Boolean {
    if (entry.syncState != SyncState.SYNCED) return false
    val recordedAt = entry.firstRecordedAt?.let { parseServerInstant(it) } ?: return false
    return LatenessForecast.wouldBeLate(LocalDate.parse(entry.dayDate), recordedAt)
}

/**
 * The quality of ONE recorded row. SYNCED with a timestamp reads the server's flag (serverLate);
 * anything not yet SYNCED (pending or a client-defect FAILED), or synced without a timestamp yet, is
 * PENDING - unsynced, so on-time versus late is not yet a server fact.
 */
private fun qualityOf(entry: EntryEntity): RecordQuality =
    when {
        entry.syncState != SyncState.SYNCED -> RecordQuality.PENDING
        entry.firstRecordedAt == null -> RecordQuality.PENDING
        serverLate(entry) -> RecordQuality.LATE
        else -> RecordQuality.ON_TIME
    }

/**
 * Combine a day's rows into the ONE letter, bar and mark a cell can show (PARKAN: the mixed half-day
 * case). One row renders directly. A half-day pair with different kinds shows the MORNING kind (a
 * deterministic choice; the edit sheet always shows both portions in full, so no truth is lost in the
 * cell). Quality takes the least-settled portion (PENDING over LATE over ON_TIME): a day that is part
 * late, part still pending is not yet a settled "late" for the whole day. Corrected if any portion is.
 */
private fun cellOf(rows: List<EntryEntity>): Triple<DayKind?, RecordQuality, Pair<Boolean, DayProvenance?>> {
    if (rows.isEmpty()) return Triple(null, RecordQuality.NONE, false to null)
    val morningFirst = rows.sortedBy { it.portion }
    val kind = morningFirst.first().kind.toDayKind()
    val qualities = rows.map { qualityOf(it) }
    val quality =
        when {
            qualities.any { it == RecordQuality.PENDING } -> RecordQuality.PENDING
            qualities.any { it == RecordQuality.LATE } -> RecordQuality.LATE
            else -> RecordQuality.ON_TIME
        }
    val corrected = rows.any { it.provenance == Provenance.DETECTED_CORRECTED }
    val provenance = morningFirst.first().provenance.toDayProvenance()
    return Triple(kind, quality, corrected to provenance)
}

/**
 * The first day of the engine's period within the tax year, or null for the whole year. A start in an
 * earlier year (or none) means the whole year; a start inside the year narrows the calendar to
 * [start .. 31 Dec], the same period periodFraction is derived from (Aggregate.remainingYearFraction).
 */
@Suppress("ReturnCount")
fun periodStartInYear(
    settings: Settings,
    taxYear: Int,
): LocalDate? {
    val start = settings.activityStartDate ?: return null
    val parsed =
        try {
            LocalDate.parse(start)
        } catch (_: DateTimeParseException) {
            return null
        }
    return if (parsed.year == taxYear) parsed else null
}

/** The first navigable month of the tax year: the period's start month, or January for a whole year. */
fun firstNavMonth(
    settings: Settings,
    taxYear: Int,
): Int = periodStartInYear(settings, taxYear)?.monthValue ?: 1

/** Build one month's view (the tax year is the calendar year) from the year's rows and the settings. */
fun buildMonthView(
    entries: List<EntryEntity>,
    settings: Settings,
    taxYear: Int,
    today: String,
    month: Int,
): MonthView {
    val periodStart = periodStartInYear(settings, taxYear)
    val firstMonth = firstNavMonth(settings, taxYear)

    val yearMonth = YearMonth.of(taxYear, month)
    val leadingBlanks = LocalDate.of(taxYear, month, 1).dayOfWeek.value - 1
    val byDay = entries.groupBy { it.dayDate }

    val days =
        (1..yearMonth.lengthOfMonth()).map { d ->
            val iso = "%04d-%02d-%02d".format(taxYear, month, d)
            val date = LocalDate.of(taxYear, month, d)
            val rows = byDay[iso].orEmpty()
            val isWeekend = date.dayOfWeek in WEEKEND
            val inPeriod = periodStart == null || !date.isBefore(periodStart)
            val isPast = iso < today

            val (kind, recordedQuality, correctedProv) = cellOf(rows)
            val (corrected, provenance) = correctedProv
            val quality =
                when {
                    rows.isNotEmpty() -> recordedQuality
                    // No entry: a past working day inside the period is missing; today is not (it is
                    // still recordable), and weekends, future and out-of-period days carry no bar.
                    inPeriod && isPast && !isWeekend -> RecordQuality.MISSING
                    else -> RecordQuality.NONE
                }

            CalendarDayUi(
                dayOfMonth = d,
                isoDate = iso,
                kind = kind,
                quality = quality,
                corrected = corrected,
                provenance = provenance,
                isToday = iso == today,
                recordable = inPeriod && iso <= today,
            )
        }

    return MonthView(
        year = taxYear,
        month = month,
        leadingBlanks = leadingBlanks,
        days = days,
        summary = summarise(days, byDay),
        canGoPrev = month > firstMonth,
        canGoNext = month < LAST_MONTH,
    )
}

private fun summarise(
    days: List<CalendarDayUi>,
    byDay: Map<String, List<EntryEntity>>,
): MonthSummary {
    var suisse = 0.0
    var domicile = 0.0
    var mission = 0.0
    for (day in days) {
        for (row in byDay[day.isoDate].orEmpty()) {
            // A FULL day is one; AM and PM are half each, so a half-day pair sums to one (Aggregate.kt).
            val portion = if (row.portion == Portion.FULL) 1.0 else 0.5
            when (row.kind) {
                EntryKind.CH -> suisse += portion
                EntryKind.HOME -> domicile += portion
                EntryKind.MISSION_FR -> mission += portion
                EntryKind.MISSION_THIRD -> mission += portion
                EntryKind.ABSENT -> Unit // D28: an absence is not a working-day figure.
            }
        }
    }
    val nonRenseigne = days.count { it.quality == RecordQuality.MISSING }.toDouble()
    return MonthSummary(suisse = suisse, domicile = domicile, mission = mission, nonRenseigne = nonRenseigne)
}
