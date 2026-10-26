package ch.monreleve.app.fr.text

import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.number

// IOS-1a R570. THE FRENCH DATE TEXT, PURE KOTLIN: the calendar-day formats of :app's fr/format (formatDate,
// formatDayLong, the month names) without java.time.format and without NSDateFormatter, so the strings are
// the same on both platforms by construction. The month and weekday names are TABLES, written out here and
// compared by FrDatesGoldenTest against the JVM's CLDR output for every day of 2025-2028 - the table is the
// specification only where the goldens agree with it, never the other way round.
//
// WHAT IS NOT HERE: the two formatters that start from an INSTANT (formatDateTime, formatDossierStamp). They
// need kotlin.time.Instant, which is @ExperimentalTime in Kotlin 2.2, so they sit in their own file beside this
// one (FrInstants.kt, moved from iosMain by AN-FR-TEXT R622) with function-scope opt-ins on the allowlist.

private const val DATE_SEPARATOR = '.'
private const val YEAR_WIDTH = 4
private const val PAIR_WIDTH = 2
private const val MONTHS_IN_YEAR = 12

private val ISO_DAY_SHAPE = Regex("""^\d{4}-\d{2}-\d{2}$""")

// French month names, lower case, by number 1..12. Non-ASCII letters are written as \u escapes so no editor
// or tool can normalise them into another form.
private val MONTH_NAMES: List<String> =
    listOf(
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
    )

// French weekday names, lower case, by ISO day number 1 (Monday) .. 7 (Sunday).
private val WEEKDAY_NAMES: List<String> =
    listOf("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")

private fun capitalizeFirst(text: String): String =
    if (text.isEmpty()) text else text[0].uppercaseChar() + text.substring(1)

private fun parseDay(
    formatter: String,
    isoDay: String,
): LocalDate {
    require(ISO_DAY_SHAPE.matches(isoDay)) {
        "$formatter needs an ISO YYYY-MM-DD day, received \"$isoDay\""
    }
    return try {
        LocalDate(
            isoDay.substring(0, YEAR_WIDTH).toInt(),
            isoDay.substring(5, 7).toInt(),
            isoDay.substring(8, 10).toInt(),
        )
    } catch (cause: IllegalArgumentException) {
        throw IllegalArgumentException("\"$isoDay\" is not a real calendar day in ISO YYYY-MM-DD form", cause)
    }
}

private fun monthName(month: Int): String {
    require(month in 1..MONTHS_IN_YEAR) { "a month is 1-12, received $month" }
    return MONTH_NAMES[month - 1]
}

/** A calendar day from its ISO YYYY-MM-DD string, Swiss dots and a four-digit year: "18.06.2027" (SPEC 6.4). */
fun formatDate(isoDay: String): String {
    val parsed = parseDay("formatDate", isoDay)
    val day = parsed.day.toString().padStart(PAIR_WIDTH, '0')
    val month = parsed.month.number.toString().padStart(PAIR_WIDTH, '0')
    val year = parsed.year.toString().padStart(YEAR_WIDTH, '0')
    return "$day$DATE_SEPARATOR$month$DATE_SEPARATOR$year"
}

/** "Juin 2026" from a tax year and a 1-12 month, leading capital. */
fun formatMonthYear(
    year: Int,
    month: Int,
): String = capitalizeFirst("${monthName(month)} $year")

/** "Janvier".."Décembre" from a 1-12 month, leading capital. */
fun formatMonthName(month: Int): String = capitalizeFirst(monthName(month))

/** "janvier".."décembre" - the month name mid-sentence. */
fun formatMonthNameLower(month: Int): String = monthName(month)

/** "Lundi 15 juin 2026" from an ISO YYYY-MM-DD day: French weekday and month, leading capital. */
fun formatDayLong(isoDay: String): String {
    val parsed = parseDay("formatDayLong", isoDay)
    val weekday = WEEKDAY_NAMES[parsed.dayOfWeek.isoDayNumber - 1]
    return capitalizeFirst("$weekday ${parsed.day} ${monthName(parsed.month.number)} ${parsed.year}")
}
