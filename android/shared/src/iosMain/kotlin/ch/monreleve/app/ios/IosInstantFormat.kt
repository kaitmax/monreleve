package ch.monreleve.app.ios

import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-1a R570. THE TWO FORMATTERS THAT START FROM AN INSTANT, for iOS: formatDateTime ("18.06.2027 a 18:03" in
// Europe/Paris, no-break spaces round the a-grave) and formatDossierStamp ("18.06.2027 16:03" in UTC). They are
// in iosMain, not with the other French formats in commonMain (ch.monreleve.app.fr.text), for one reason:
// kotlin.time.Instant is @ExperimentalTime in Kotlin 2.2, an opt-in in commonMain would be a new line on
// ExperimentalTimeOptInAllowlistTest, and that test lives in :app - which this task may not change. The opt-in
// here is on the two functions (the narrowest scope R590 allows) and is the finding PARK'd in the report: the
// allowlist test walks nine source roots and iosMain/iosTest are not among them.
//
// THE OUTPUT IS ANDROID'S, proven: FrInstantFormatGoldenTest runs the 1,910 golden strings captured from
// java.time on Android through these two functions on the simulator (Paris, UTC, New York and Zurich, both 2026
// and 2027 DST changes, offset inputs, fractional seconds, and the refusals with Android's messages).
// No NSDateFormatter is involved, so no CLDR or locale data can differ: the numbers are integers, padded.

private const val DATE_TIME_ZONE = "Europe/Paris"
private const val PAIR = 2
private const val YEAR = 4

private fun twoDigits(value: Int): String = value.toString().padStart(PAIR, '0')

private fun dottedDate(local: LocalDateTime): String {
    val year = local.year.toString().padStart(YEAR, (48).toChar())
    return twoDigits(local.day) + "." + twoDigits(local.month.ordinal + 1) + "." + year
}

@OptIn(ExperimentalTime::class)
private fun parseInstant(
    formatter: String,
    iso: String,
): Instant =
    try {
        Instant.parse(iso)
    } catch (cause: IllegalArgumentException) {
        throw IllegalArgumentException("$formatter needs an ISO timestamp, received \"$iso\"", cause)
    }

/** An instant as "dd.MM.yyyy" + NBSP + a-grave + NBSP + "HH:mm" in [timeZone] (default Europe/Paris), as Android. */
@OptIn(ExperimentalTime::class)
fun formatDateTime(
    iso: String,
    timeZone: String = DATE_TIME_ZONE,
): String {
    val local = parseInstant("formatDateTime", iso).toLocalDateTime(TimeZone.of(timeZone))
    val nbsp = 0x00A0.toChar()
    val aGrave = 0x00E0.toChar()
    val date = dottedDate(local)
    return "$date$nbsp$aGrave$nbsp${twoDigits(local.hour)}:${twoDigits(local.minute)}"
}

/** The server's instant as "dd.MM.yyyy HH:mm" in UTC, matching the releve PDF's own stamp. */
@OptIn(ExperimentalTime::class)
fun formatDossierStamp(iso: String): String {
    val local = parseInstant("formatDossierStamp", iso).toLocalDateTime(TimeZone.UTC)
    val date = dottedDate(local)
    return "$date ${twoDigits(local.hour)}:${twoDigits(local.minute)}"
}
