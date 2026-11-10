package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.SimChange
import kotlinx.datetime.toKotlinDayOfWeek
import java.time.DayOfWeek

// IOS-2d R813. THE FORECAST'S WEEKDAYS, IN ONE FILE - every place the forecast and the simulator turn a weekday into
// a stored field, a map key, an offered choice or the engine's change. Extracted UNCHANGED from ForecastController.kt
// (withDay, toChoiceMap) and SimulationController.kt (the weekday list, availableWeekdays, the extra-weekday change),
// so the pin (ForecastDaysPinTest) can reach them; R777's isIsoDay and R787's CalendarDates shape. RhythmChoice and its
// RhythmKind mapping are beside this file (RhythmChoice.kt). Public because the controllers call them from :app once
// this file is shared.

/** Monday..Friday - the weekdays a rhythm sets, in the order the simulator offers them. */
val RHYTHM_WEEKDAYS: List<DayOfWeek> =
    listOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY)

/** The rhythm with [day] set to [kind] - the field Room stores (R341). A weekend day leaves it unchanged. */
fun WeeklyRhythm.withDay(
    day: DayOfWeek,
    kind: RhythmKind,
): WeeklyRhythm =
    when (day) {
        DayOfWeek.MONDAY -> copy(monday = kind)
        DayOfWeek.TUESDAY -> copy(tuesday = kind)
        DayOfWeek.WEDNESDAY -> copy(wednesday = kind)
        DayOfWeek.THURSDAY -> copy(thursday = kind)
        DayOfWeek.FRIDAY -> copy(friday = kind)
        else -> this
    }

/** The rhythm as the Rythme screen reads it: each set weekday -> its choice; an unset one is absent. */
fun WeeklyRhythm.toChoiceMap(): Map<DayOfWeek, RhythmChoice> =
    buildMap {
        monday?.let { put(DayOfWeek.MONDAY, it.toChoice()) }
        tuesday?.let { put(DayOfWeek.TUESDAY, it.toChoice()) }
        wednesday?.let { put(DayOfWeek.WEDNESDAY, it.toChoice()) }
        thursday?.let { put(DayOfWeek.THURSDAY, it.toChoice()) }
        friday?.let { put(DayOfWeek.FRIDAY, it.toChoice()) }
    }

/** The weekdays that are not already a home day - the only ones "one more day at home" can add. */
fun availableWeekdays(rhythm: WeeklyRhythm): List<DayOfWeek> {
    val kinds = rhythm.toEntryKindMap()
    return RHYTHM_WEEKDAYS.filter { kinds[it.toKotlinDayOfWeek()] != EntryKind.HOME }
}

/** The engine's change for "one more weekday at home" on [day]; no weekday left to add is no change at all. */
fun extraWeekdayChange(day: DayOfWeek?): SimChange =
    if (day != null) SimChange.ExtraWeekday(day.toKotlinDayOfWeek()) else SimChange.ExtraMonthDays(0)
