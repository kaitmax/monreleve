package ch.monreleve.app.onboarding

import kotlinx.datetime.LocalDate
import kotlinx.datetime.number

// AN-ONBOARD. The period step stores an ISO day (R28) and shows it Swiss (dd.MM.yyyy). Non-composable helpers
// (literals permitted), kept out of the screen file so its composable count stays under detekt's threshold.
//
// IOS-2b R777: moved to :shared commonMain and from java.time to kotlinx-datetime (already a :shared dependency), so
// the shared onboarding can format and check its dates on iOS. PUBLIC, where it was internal: :app's screens and
// controller call these until they move too, and :app cannot see a :shared `internal`. THE SAME STRINGS FOR THE SAME
// INPUTS is asserted by OnboardingDatesPinTest, written against the java.time code first and moved here unedited -
// including java.time's two quirks of "dd.MM.yyyy", reproduced below rather than corrected: `yyyy` is the YEAR OF ERA
// (year 0 prints 0001, year -1 prints 0002), and a year past four digits prints with a leading '+'.

private const val MS_PER_DAY = 86_400_000L
private const val YEAR_DIGITS = 4
private const val DAY_MONTH_DIGITS = 2
private const val LAST_UNSIGNED_YEAR = 9999
private const val LAST_MONTH = 12
private const val LAST_DAY = 31

/** java.time's DateTimeFormatter.ofPattern("dd.MM.yyyy"), exactly: year of era, a '+' past four digits. */
private fun LocalDate.swiss(): String {
    val yearOfEra = if (year <= 0) 1 - year else year
    val digits = yearOfEra.toString().padStart(YEAR_DIGITS, '0')
    val yearText = if (yearOfEra > LAST_UNSIGNED_YEAR) "+$digits" else digits
    val dd = day.toString().padStart(DAY_MONTH_DIGITS, '0')
    val mm = month.number.toString().padStart(DAY_MONTH_DIGITS, '0')
    return "$dd.$mm.$yearText"
}

/** An ISO day as Swiss dd.MM.yyyy for display; blank stays blank, and an unparseable value is shown as-is. */
fun swissDate(iso: String): String =
    if (iso.isBlank()) "" else runCatching { LocalDate.parse(iso).swiss() }.getOrDefault(iso)

/** The period step's start-date check (IOS-2b R777): a strict ISO day. The controller trims before asking. */
fun isIsoDay(value: String): Boolean = runCatching { LocalDate.parse(value) }.isSuccess

/**
 * A Material 3 DatePicker's UTC-midnight millis as an ISO day string (R28: stored as the ISO day it always was). The
 * day is the FLOOR of millis / one day, so a millisecond before the epoch is 1969-12-31, as java.time's UTC zone
 * read it.
 */
fun isoOf(millis: Long): String = LocalDate.fromEpochDays(millis.floorDiv(MS_PER_DAY).toInt()).toString()

// The "Tout est prêt" summary values, derived from the saved settings (R181: shown, never a second source).
// Non-composable (literals permitted) so the Pret screen stays free of the no-literal fence.

private const val NB = ' '

/** The employment rate as "100 %" (no-break space before the sign, as the design sets it). */
fun readyRate(rate: Int): String = "$rate$NB%"

/** The method label on the summary card: "Simplifiée, 240 jours" or "Nombre de jours réel". */
fun readyMethod(denominatorKind: String): String =
    if (denominatorKind == "EXACT") {
        ch.monreleve.app.fr.OnboardingCopy.METHOD_EXACT
    } else {
        ch.monreleve.app.fr.OnboardingCopy.READY_METHOD_SIMPLIFIED
    }

/** The period: "Année entière", or "dd.MM.yyyy – 31.12.yyyy" from a mid-year start to the tax year's end. */
fun readyPeriod(
    startIso: String?,
    taxYear: Int,
): String {
    if (startIso.isNullOrBlank()) return ch.monreleve.app.fr.OnboardingCopy.READY_PERIOD_ALL
    val end = LocalDate(taxYear, LAST_MONTH, LAST_DAY).swiss()
    return "${swissDate(startIso)} – $end"
}
