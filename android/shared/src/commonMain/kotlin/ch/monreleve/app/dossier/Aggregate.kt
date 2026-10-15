package ch.monreleve.app.dossier

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.TeleworkInput
import kotlinx.datetime.LocalDate
import kotlinx.datetime.daysUntil

// AN5b increment 2 (R281). Database rows become a TeleworkInput - the Kotlin side of the ONE
// aggregation. This is the port of web/lib/dossier/aggregate.ts, and it is deliberately a SECOND
// implementation of the SAME behaviour, bound to the first by fixtures/aggregation-cases.json:
// both sides read that file and must produce the same TeleworkInput. That binding is the whole
// point - FW12's tile defect was a second derivation of a figure the first had already produced,
// invisible because every fixture agreed with it. A one-digit change in the shared fixture fails
// BOTH builds.
//
// KMP-0 increment 6c (R372, R371): moved to :shared commonMain, separated from Room. It takes the plain
// shared types (AggregatableEntry/AggregatableUser over the dossier EntryKind/Portion vocabulary), never
// EntryEntity or SettingsStore; :app maps its Room rows and settings to these at the boundary
// (EntryEntity.toAggregatable, Settings.toAggregatableUser). java.time became kotlinx-datetime (:app keeps
// java.time); daysUntil is ChronoUnit.DAYS.between, locked by ParisDayDstTest.
//
// IT COUNTS. IT DOES NOT CALCULATE. Nothing here divides, rounds, or compares against a threshold;
// it turns rows into the engine's input and hands them over. calculateTelework (calc/) does the
// arithmetic, once.
//
// ABSENCES NEVER REACH THE ENGINE (D28). A jour de conge is not a worked day, not telework, not a
// mission - it is not part of the calculation at all. It is filtered here, and the conformance test
// asserts the engine input is identical with and without absence rows.
//
// PURE (no android/androidx, no clock). kotlinx.datetime.LocalDate is calendar-only arithmetic on explicit
// dates - R28 clean, the same guarantee the TypeScript side gets from UTC-midnight day math.

/** Exactly the entry columns the aggregation reads (dayDate is along for the ride / diagnosis). */
data class AggregatableEntry(
    val dayDate: String,
    val portion: Portion,
    val kind: EntryKind,
)

/** Exactly the person columns the aggregation reads, in the /api/v1/me vocabulary. */
data class AggregatableUser(
    val canton: String?,
    val employmentRate: Int,
    val denominatorKind: String,
    val exactTotalWorkDays: Int?,
    val granularity: String,
    val activityStartDate: String?,
)

/**
 * What one entry contributes to a count. A FULL day is one; AM and PM are half each, so a half-day
 * pair sums to exactly one. A `when` over the enum rather than `if portion == FULL` so a fourth
 * portion added to the schema is a compile error here, not a silent 0.5.
 */
private fun portionDays(portion: Portion): Double =
    when (portion) {
        Portion.FULL -> 1.0
        Portion.AM -> 0.5
        Portion.PM -> 0.5
    }

/** The four numbers the engine is given, before anything is calculated. */
data class DayCounts(
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
    /** Not an engine input. Reported so a reader can check the arithmetic. */
    val swissDays: Double,
    /** Not an engine input either. D28: counted once, and nowhere else. */
    val absenceDays: Double,
)

/**
 * Count the rows. Floating point is avoided by counting halves: 0.5 is exact in binary and the sum
 * is built by addition, never repeated multiplication, so no accumulation error can reach a tenth
 * of a day at this domain's row ceiling.
 *
 * CH AND ABSENT ARE NOT TELEWORK OR MISSIONS. The engine derives days in Switzerland from the
 * denominator, not from a count, so a CH row adds to nothing the engine sees (only to swissDays,
 * for a reader). ABSENT adds to nothing but absenceDays (D28).
 */
fun countDays(entries: List<AggregatableEntry>): DayCounts {
    var telework = 0.0
    var france = 0.0
    var third = 0.0
    var swiss = 0.0
    var absence = 0.0

    for (entry in entries) {
        val days = portionDays(entry.portion)
        when (entry.kind) {
            EntryKind.HOME -> telework += days
            EntryKind.MISSION_FR -> france += days
            EntryKind.MISSION_THIRD -> third += days
            EntryKind.CH -> swiss += days
            EntryKind.ABSENT -> absence += days
        }
    }

    return DayCounts(
        teleworkDays = telework,
        missionDaysFrance = france,
        missionDaysThirdState = third,
        swissDays = swiss,
        absenceDays = absence,
    )
}

/** The user's logging granularity in the engine's vocabulary. Settings never carry HOURS. */
private fun granularityOf(user: AggregatableUser): Granularity =
    when (user.granularity) {
        "HALF_DAY" -> Granularity.HALF_DAY
        "DAY" -> Granularity.DAY
        else -> error("unknown granularity in settings: ${user.granularity}")
    }

/**
 * The denominator the engine should use. SPEC 8 makes exactTotalWorkDays required iff the kind is
 * EXACT, enforced by a CHECK constraint (R196), so a null here with kind EXACT is a database written
 * around - it errors rather than falling back to the simplified basis, which would produce a
 * different rate under a method the reader did not choose.
 */
private fun denominatorOf(user: AggregatableUser): DenominatorMethod =
    when (user.denominatorKind) {
        "EXACT" -> {
            val total =
                checkNotNull(user.exactTotalWorkDays) {
                    "denominatorKind is EXACT but exactTotalWorkDays is null. SPEC 8 requires the " +
                        "pair, and a CHECK constraint enforces it - this row was not written through " +
                        "the application."
                }
            DenominatorMethod.Exact(total)
        }
        "SIMPLIFIED240" -> DenominatorMethod.Simplified240
        else -> error("unknown denominatorKind in settings: ${user.denominatorKind}")
    }

/**
 * The fraction of the tax year still to be worked from an ISO start day, counted inclusively.
 * Ported from web/lib/ui/core/period.ts (remainingYearFraction) and bound to it by the shared
 * fixture's partial-year case.
 *
 * DERIVED FROM THE STORED DAY, never from a clock (R28). A start before the year means the whole
 * year (1.0); a start after it means 0.0, which the engine rejects with PERIOD_OUT_OF_RANGE rather
 * than being clamped here to something plausible. LocalDate.parse rejects an impossible day
 * (2026-02-29), the same guard the TypeScript round-trip check performs.
 */
fun remainingYearFraction(
    isoDay: String,
    taxYear: Int,
): Double {
    val start = LocalDate.parse(isoDay)
    return when {
        start.year < taxYear -> 1.0
        start.year > taxYear -> 0.0
        else -> {
            val firstOfYear = LocalDate(taxYear, 1, 1)
            val lastOfYear = LocalDate(taxYear, 12, 31)
            val daysInYear = firstOfYear.daysUntil(lastOfYear) + 1
            val remaining = start.daysUntil(lastOfYear) + 1
            remaining.toDouble() / daysInYear.toDouble()
        }
    }
}

private fun periodFractionOf(
    user: AggregatableUser,
    taxYear: Int,
): Double {
    val start = user.activityStartDate ?: return 1.0
    return remainingYearFraction(start, taxYear)
}

/**
 * Build the engine's input from a person and their year. The entries are NOT filtered by year here:
 * the caller selects the year it means, and doing it twice would give two places to be wrong about
 * which year a day belongs to (R28, the same decision aggregate.ts records).
 */
fun toTeleworkInput(
    user: AggregatableUser,
    entries: List<AggregatableEntry>,
    taxYear: Int,
): TeleworkInput {
    val counts = countDays(entries)
    val canton =
        checkNotNull(user.canton) {
            "the dossier needs a canton: SPEC 7 resolves the regime from it, and there is no default " +
                "that is right for everybody."
        }

    return TeleworkInput(
        taxYear = taxYear,
        canton = Canton.valueOf(canton),
        employmentRate = user.employmentRate,
        periodFraction = periodFractionOf(user, taxYear),
        denominator = denominatorOf(user),
        granularity = granularityOf(user),
        teleworkDays = counts.teleworkDays,
        missionDaysFrance = counts.missionDaysFrance,
        missionDaysThirdState = counts.missionDaysThirdState,
    )
}
