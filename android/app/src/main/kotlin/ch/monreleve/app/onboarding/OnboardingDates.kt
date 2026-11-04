package ch.monreleve.app.onboarding

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

// AN-ONBOARD. The period step stores an ISO day (R28) and shows it Swiss (dd.MM.yyyy). Non-composable helpers
// (literals permitted), kept out of the screen file so its composable count stays under detekt's threshold.

private val SWISS = DateTimeFormatter.ofPattern("dd.MM.yyyy")

/** An ISO day as Swiss dd.MM.yyyy for display; blank stays blank, and an unparseable value is shown as-is. */
internal fun swissDate(iso: String): String =
    if (iso.isBlank()) "" else runCatching { LocalDate.parse(iso).format(SWISS) }.getOrDefault(iso)

/** The period step's start-date check (IOS-2b R777): a strict ISO day. The controller trims before asking. */
internal fun isIsoDay(value: String): Boolean = runCatching { LocalDate.parse(value) }.isSuccess

/** A Material 3 DatePicker's UTC-midnight millis as an ISO day string (R28: stored as the ISO day it always was). */
internal fun isoOf(millis: Long): String = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()

// The "Tout est prêt" summary values, derived from the saved settings (R181: shown, never a second source).
// Non-composable (literals permitted) so the Pret screen stays free of the no-literal fence.

private const val NB = ' '

/** The employment rate as "100 %" (no-break space before the sign, as the design sets it). */
internal fun readyRate(rate: Int): String = "$rate$NB%"

/** The method label on the summary card: "Simplifiée, 240 jours" or "Nombre de jours réel". */
internal fun readyMethod(denominatorKind: String): String =
    if (denominatorKind == "EXACT") {
        ch.monreleve.app.fr.OnboardingCopy.METHOD_EXACT
    } else {
        ch.monreleve.app.fr.OnboardingCopy.READY_METHOD_SIMPLIFIED
    }

/** The period: "Année entière", or "dd.MM.yyyy – 31.12.yyyy" from a mid-year start to the tax year's end. */
internal fun readyPeriod(
    startIso: String?,
    taxYear: Int,
): String {
    if (startIso.isNullOrBlank()) return ch.monreleve.app.fr.OnboardingCopy.READY_PERIOD_ALL
    val end = LocalDate.of(taxYear, 12, 31).format(SWISS)
    return "${swissDate(startIso)} – $end"
}
