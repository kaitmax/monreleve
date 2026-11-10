package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.ThresholdCrossing
import kotlinx.datetime.toKotlinLocalDate
import java.time.LocalDate as JavaLocalDate

// IOS-2d R813. :app's HALF OF THE FORECAST'S DATES, and it decides nothing - IOS-2c's JavaTimeCalendar shape.
//
// The forecast's date work is kotlinx-datetime. The evening worker (EveningNotifier) and ThresholdForecastTest still
// hold a java.time LocalDate, so this keeps every one of those call sites unedited by converting the TYPE and nothing
// else, with the library's own converter (R553) - exactly the conversion projectedThresholdCrossing made on its first
// use of `today` before. Named for what it holds, so its JVM facade class cannot collide with a file of :shared's.

/** The year-end crossing, from a java.time LocalDate: :app's call into the kotlinx version. */
fun projectedThresholdCrossing(
    settings: Settings,
    entries: List<EntryEntity>,
    rhythm: WeeklyRhythm,
    today: JavaLocalDate,
    taxYear: Int,
): ThresholdCrossing? = projectedThresholdCrossing(settings, entries, rhythm, today.toKotlinLocalDate(), taxYear)
