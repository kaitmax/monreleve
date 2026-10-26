package ch.monreleve.app.fr.text

import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// AN-FR-TEXT R622 (moved from iosMain/ios/IosInstantFormat.kt, IOS-1a R570). THE TWO FORMATTERS THAT START FROM
// AN INSTANT: formatDateTime ("18.06.2027 a 18:03" in Europe/Paris, no-break spaces round the a-grave) and
// formatDossierStamp ("18.06.2027 16:03" in UTC, matching the releve PDF's own stamp). IOS-1a kept them in iosMain
// because a commonMain opt-in needed a line on ExperimentalTimeOptInAllowlistTest, which that task could not edit;
// R592 made the allowlist see every source set, and moving them here REMOVES A DUPLICATE: :app's java.time copy in
// fr/format/Dates.kt, deleted in AN-FR-TEXT R621. One home for both platforms (R206).
//
// The opt-in is on each function, the narrowest scope R590 allows, and the file is on the allowlist with its 3.
//
// THE OUTPUT IS ANDROID'S, proven: FrInstantFormatGoldenTest (commonTest, so on the JVM AND the simulator) runs the
// 1,910 strings captured from java.time on Android through these two functions - Paris, UTC, New York and Zurich,
// both 2026 and 2027 DST changes, offset inputs, fractional seconds, and the refusals with Android's messages.
// No platform date formatter is involved, so no CLDR or locale data can differ: the numbers are integers, padded.

/**
 * A timestamp is an instant, and the audience is cross-border workers living in France, so they read it in their
 * own wall clock. Pinned, never inherited from the device.
 */
const val DATE_TIME_ZONE = "Europe/Paris"

private const val PAIR = 2
private const val YEAR = 4

private fun twoDigits(value: Int): String = value.toString().padStart(PAIR, '0')

private fun dottedDate(local: LocalDateTime): String {
    val year = local.year.toString().padStart(YEAR, '0')
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
