package ch.monreleve.app.calendar

import ch.monreleve.app.dossier.LatenessForecast
import kotlinx.datetime.toKotlinLocalDate
import java.time.LocalDate
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2c R787. THE CALENDAR'S DATE WORK, IN ONE HOME. CalendarController and bulkConfirmation each read an ISO day
// back into a date - to open on the current month, and to ask whether a backdated day would be flagged late - and
// both did it with java.time. These two functions are those lines EXTRACTED UNCHANGED, so the pin
// (CalendarDatesPinTest) can reach them with plain strings and a kotlin.time Instant, before and after the port.
// The Paris day itself ("today") is not computed here: it is data/local's todayInParis, already shared.

private const val LAST_MONTH = 12

/**
 * Would the day [isoDay], recorded at [now], be flagged « saisie tardive »? LatenessForecast's rule (R286), asked
 * the same way by the single-day sheet and by the bulk confirmation.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
fun wouldBeLateOn(
    isoDay: String,
    now: Instant,
): Boolean = LatenessForecast.wouldBeLate(LocalDate.parse(isoDay).toKotlinLocalDate(), now)

/**
 * The month the calendar opens on: [today]'s month when it falls in [taxYear], else the first navigable month,
 * clamped into the navigable range (a partial year starts mid-year). [firstMonth] is null when no settings exist
 * yet - the calendar then opens on today's month, unclamped (it is unreachable until onboarded).
 */
fun openingMonth(
    today: String,
    taxYear: Int,
    firstMonth: Int?,
): Int {
    if (firstMonth == null) return LocalDate.parse(today).monthValue
    val parsed = LocalDate.parse(today)
    val current = if (parsed.year == taxYear) parsed.monthValue else firstMonth
    return current.coerceIn(firstMonth, LAST_MONTH)
}
