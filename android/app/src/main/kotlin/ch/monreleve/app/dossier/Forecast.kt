package ch.monreleve.app.dossier

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.TeleworkResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import java.time.LocalDate

// AN-FORECAST (R340, R281, R28). THE YEAR-END FORECAST, computed in memory and NEVER written.
//
// R340 - A PROJECTION IS NEVER A RECORD. Everything here is pure: it takes the recorded days, a
// weekly rhythm and a fixed "today", imagines the rest of the year, and runs the result through the
// SHARED aggregation (toTeleworkInput) and the engine (calculateTelework). It opens no database, holds
// no clock (today is a parameter), and returns values - it writes nothing to the entries, the mutation
// queue, the server, the releve, the PDF or the annex. The controller that drives it (and the R340
// "nothing written" test) can therefore prove the stores are untouched.
//
// R281 - ONE CONTRACT FOR WEB AND APP. The date logic below is the new code; everything after it is the
// existing aggregation and engine. fixtures/forecast-cases.json binds this to the web forecast: a rhythm,
// a date, the count of imagined days and the engine's rate. ForecastConformanceTest reads that file; the
// web suite reads the same file. A one-digit change fails both.
//
// FW12's defect was a figure derived a second time in a component. The forecast's figures - the rate, the
// remaining-day tiles - come from the TeleworkResult below, never from arithmetic in the screen.

/**
 * The imagined working days from the day AFTER [today] to 31 December [taxYear].
 *
 * Each weekday (Monday..Friday) the [rhythm] assigns a kind - HOME (Domicile / teletravail) or CH
 * (Suisse) - becomes one FULL row on that date. A weekday the rhythm leaves out of the map is not a
 * worked day and produces nothing. Weekends never count.
 *
 * TODAY IS NEVER IMAGINED: the set starts the day after today, because today is either recorded or it
 * is not (the prompt's rule). Past days left unrecorded are not imagined either - they are simply not
 * in this set, which starts after today.
 *
 * HOLIDAYS AND LEAVE ARE NOT DEDUCTED (R340): on the 240-day basis that overstates telework, so the
 * projection warns early and never late. The screen states this in words.
 *
 * Pure: the only "clock" is the [today] parameter (R28 - the caller resolves Europe/Paris once).
 */
fun imaginedEntriesToYearEnd(
    rhythm: Map<java.time.DayOfWeek, EntryKind>,
    today: LocalDate,
    taxYear: Int,
): List<AggregatableEntry> {
    val yearEnd = LocalDate.of(taxYear, 12, 31)
    val firstOfYear = LocalDate.of(taxYear, 1, 1)
    var day = today.plusDays(1)
    if (day.isBefore(firstOfYear)) day = firstOfYear

    val rows = mutableListOf<AggregatableEntry>()
    while (!day.isAfter(yearEnd)) {
        // Monday..Friday only (value 1..5); a rhythm map holds only weekday keys, and the weekend is
        // never a worked day whatever the map says.
        if (day.dayOfWeek.value in MONDAY_VALUE..FRIDAY_VALUE) {
            val kind = rhythm[day.dayOfWeek]
            if (kind != null) rows.add(AggregatableEntry(day.toString(), Portion.FULL, kind))
        }
        day = day.plusDays(1)
    }
    return rows
}

private const val MONDAY_VALUE = 1
private const val FRIDAY_VALUE = 5

/**
 * The two engine results a forecast shows: today's figure from the record alone, and the December
 * projection from the record plus the imagined days. Both run through the ONE aggregation and the ONE
 * engine (R281, R340), so the screen reads figures rather than computing them.
 */
data class ForecastResults(
    val current: TeleworkResult,
    val projected: TeleworkResult,
    val imagined: List<AggregatableEntry>,
)

/**
 * Compute the forecast. Returns null only if the engine rejects the input (an invalid settings state,
 * e.g. a missing canton) - the caller shows the "set a rhythm / complete your settings" invitation then.
 *
 * NOTHING IS WRITTEN (R340). [recorded] and [rhythm] go in by value; two TeleworkResults come out.
 */
fun forecastResults(
    user: AggregatableUser,
    recorded: List<AggregatableEntry>,
    rhythm: Map<java.time.DayOfWeek, EntryKind>,
    today: LocalDate,
    taxYear: Int,
): ForecastResults? {
    val imagined = imaginedEntriesToYearEnd(rhythm, today, taxYear)
    val current = (calculateTelework(toTeleworkInput(user, recorded, taxYear)) as? CalcResult.Ok)?.value
    val projected = (calculateTelework(toTeleworkInput(user, recorded + imagined, taxYear)) as? CalcResult.Ok)?.value
    if (current == null || projected == null) return null
    return ForecastResults(current = current, projected = projected, imagined = imagined)
}
