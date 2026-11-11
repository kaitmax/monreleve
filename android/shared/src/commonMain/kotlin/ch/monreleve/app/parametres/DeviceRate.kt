package ch.monreleve.app.parametres

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.toAggregatableUser

// AN12 increment 1 (R290). The declarable rate the DEVICE engine computes for a set of settings over the
// device's own entries. R290's before-and-after is the SAME arithmetic Aujourd'hui's year panel already
// shows the person (Room -> the increment-2 aggregation -> the engine, AujourdhuiController.computeYear),
// never a second one (R196/R206): a change that moves THIS number is exactly the change that moves the
// rate on Aujourd'hui and, once synced, on the releve.
//
// PURE. No clock (the period fraction is calendar arithmetic off the stored start day, R28), no I/O. The
// caller supplies the entries snapshot; this counts and calculates and hands back the one figure R290 puts
// before the person.

/**
 * The declarable rate for [settings] over the [taxYear] rows of [entries], or null when the engine cannot
 * produce one over those entries. Two causes reach null, and the caller must tell them apart:
 *  - the year has no entries, so a change moves no rate (the caller checks that itself, before calling);
 *  - the settings would NOT compute over the recorded days - a granularity switch against half-day rows
 *    returns GranularityMismatch. That is not "no change": it is a change that invalidates the recorded
 *    year, and the caller refuses it (R290) rather than reading the null as "nothing moved".
 *
 * The value is the engine's declarableRate - truncated to 2 dp, the figure declared to the AFC - never a
 * re-rounded copy.
 */
fun deviceDeclarableRate(
    settings: Settings,
    entries: List<EntryEntity>,
    taxYear: Int,
): Double? {
    val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
    if (yearEntries.isEmpty()) return null
    val input =
        toTeleworkInput(
            settings.toAggregatableUser(),
            yearEntries.map { it.toAggregatable() },
            taxYear,
        )
    return (calculateTelework(input) as? CalcResult.Ok)?.value?.declarableRate
}
