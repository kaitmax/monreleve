package ch.monreleve.app.dossier

import ch.monreleve.app.calc.TeleworkResult
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import java.time.DayOfWeek
import java.time.LocalDate

// AN-SIM (R340, R281, R28). THE SIMULATOR: test a change before making it. Computed IN MEMORY from the
// recorded days plus imagined ones, and NEVER written anywhere.
//
// R340 - A PROJECTION IS NEVER A RECORD. Every scenario is a change to the imagined year, run through the
// EXISTING engine path (forecastResults -> the shared aggregation -> calculateTelework), and the figures come
// from that engine - never from arithmetic in the UI (FW12's defect). This file opens no database, holds no
// clock (today is a parameter), takes values and returns values: it has no seam to the entries table, the
// mutation queue, the server, the releve, the PDF or the annex, so by construction nothing reaches them.
//
// R281 - ONE CONTRACT. simulationResults reuses dossier/forecastResults (bound to fixtures/forecast-cases.json),
// never a second rate calculation. The rate scenario therefore runs the SAME engine-over-settings path the rest
// of the app uses (R290's deviceDeclarableRate wraps that same path) - no second copy of the rate arithmetic.
//
// NEITHER THE 10-DAY MISSION CAP NOR ITS ORDER IS APPLIED HERE. The mission scenario hands the engine a count
// of France and third-state mission days; calculateTelework applies the cap, its proration and its order
// (France first) exactly as it does for the record (SPEC 7.2). The simulator never clamps a mission count.

/** A change to the imagined year. The four scenarios the engine can model (AN-SIM section 1). */
sealed interface SimChange {
    /** One more day at home each week: the chosen weekday becomes a home (Domicile) day in the rhythm. */
    data class ExtraWeekday(val day: DayOfWeek) : SimChange

    /** Extra telework days this month: [count] imagined home days added on top of the rhythm. */
    data class ExtraMonthDays(val count: Int) : SimChange

    /** A different employment rate: [employmentRate] (1..100) changes the basis the engine divides by. */
    data class Rate(val employmentRate: Int) : SimChange

    /** Missions: [france] in France and [thirdState] in a third state, each an imagined mission day. */
    data class Missions(val france: Int, val thirdState: Int) : SimChange
}

/**
 * The engine results the simulator draws, all from ONE input snapshot through the ONE engine (R340/R281), so
 * the figures a reader compares are always consistent - the screen reads them, it never computes them (FW12):
 *  - [recorded]  today's rate from the record alone, the rail's solid part (where you stand now);
 *  - [baseline]  the current year-end projection, "Votre projection";
 *  - [simulated] the year-end projection WITH the change, "Avec ce changement" + the rail's soft part + tiles.
 */
data class SimulationResults(
    val recorded: TeleworkResult,
    val baseline: TeleworkResult,
    val simulated: TeleworkResult,
)

/**
 * Compute a simulation. Returns null only if the engine rejects the input (an invalid settings state or an
 * out-of-range employment rate) - the caller shows the invitation then. NOTHING IS WRITTEN (R340).
 *
 * LongParameterList suppressed as forecastResults' own call shape is: these ARE the engine's inputs plus the
 * one change, and bundling them would only move the list. The two returns mirror forecastResults exactly.
 */
@Suppress("LongParameterList")
fun simulationResults(
    user: AggregatableUser,
    recorded: List<AggregatableEntry>,
    rhythm: Map<DayOfWeek, EntryKind>,
    change: SimChange,
    today: LocalDate,
    taxYear: Int,
): SimulationResults? {
    val base = forecastResults(user, recorded, rhythm, today, taxYear)
    val sim =
        forecastResults(
            userWith(change, user),
            recorded + extraEntriesFor(change, today, taxYear),
            rhythmWith(change, rhythm),
            today,
            taxYear,
        )
    if (base == null || sim == null) return null
    return SimulationResults(recorded = base.current, baseline = base.projected, simulated = sim.projected)
}

/** The rhythm with the extra home weekday applied; unchanged for every other scenario. */
private fun rhythmWith(
    change: SimChange,
    rhythm: Map<DayOfWeek, EntryKind>,
): Map<DayOfWeek, EntryKind> =
    when (change) {
        is SimChange.ExtraWeekday -> rhythm + (change.day to EntryKind.HOME)
        else -> rhythm
    }

/** The user with the new employment rate applied; unchanged for every other scenario. */
private fun userWith(
    change: SimChange,
    user: AggregatableUser,
): AggregatableUser =
    when (change) {
        is SimChange.Rate -> user.copy(employmentRate = change.employmentRate)
        else -> user
    }

/**
 * The imagined rows a scenario adds on top of the rhythm. Only the KIND and the COUNT reach the engine (the
 * aggregation counts by kind; the date is immaterial - it is never parsed), so these dates are synthetic
 * in-year days generated purely to carry a count into the shared aggregation. They are never stored (R340).
 */
private fun extraEntriesFor(
    change: SimChange,
    today: LocalDate,
    taxYear: Int,
): List<AggregatableEntry> =
    when (change) {
        is SimChange.ExtraMonthDays -> imaginedRows(change.count, EntryKind.HOME, LocalDate.of(taxYear, today.month, 1))
        is SimChange.Missions ->
            imaginedRows(change.france, EntryKind.MISSION_FR, today.plusDays(1)) +
                imaginedRows(change.thirdState, EntryKind.MISSION_THIRD, today.plusDays(1))
        else -> emptyList()
    }

/** [count] full-day rows of [kind], dated from [from] forward (LocalDate.plusDays always yields a valid day). */
private fun imaginedRows(
    count: Int,
    kind: EntryKind,
    from: LocalDate,
): List<AggregatableEntry> =
    (0 until count.coerceAtLeast(0)).map { i ->
        AggregatableEntry(from.plusDays(i.toLong()).toString(), Portion.FULL, kind)
    }
