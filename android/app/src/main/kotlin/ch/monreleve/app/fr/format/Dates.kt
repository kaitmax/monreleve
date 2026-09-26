package ch.monreleve.app.fr.format

// AN3 increment 1. Kotlin port of web/lib/ui/core/format/date.ts.
//
// SPEC 6.4: "formatDate -> Swiss dots." SPEC 8: the Releve annuel names
// days, so a day-boundary bug here is a WRONG RECORD, not a cosmetic slip.
//
// RULING R28, carried: a calendar day is an ISO YYYY-MM-DD string end to
// end. A java.time.LocalDate never crosses this file's public boundary as
// a parameter - only a String does - for the same reason the web side
// forbids a Date object: an instant needs a zone to read its calendar
// fields, and getting the zone wrong gets the day wrong.
//
// A GENUINE PLATFORM DIFFERENCE FROM THE WEB SIDE, WORTH RECORDING RATHER
// THAN HIDING. JavaScript's Date does not reject an impossible day - it
// ROLLS IT OVER, which is why the TS formatDate has to round-trip the
// parsed fields back to a canonical string and compare. java.time.LocalDate
// validates the calendar directly and throws DateTimeParseException on a
// real impossibility (30 February, 29 February in a non-leap year, a
// month outside 1-12) - a platform guarantee, not an assumption; proven
// empirically in DatesTest.kt against the exact rejection list the TS
// suite carries, rather than trusted from documentation. The width/shape
// check below (four-digit year, two-digit month and day, no time
// component) still has to be explicit, because LocalDate.parse alone is
// lenient about digit width in a way SPEC 6.4's YYYY-MM-DD contract is
// not.
//
// formatDateTime keeps a real time API (java.time.Instant / ZonedDateTime)
// because rendering an instant as a Paris wall clock IS a zone conversion.
// Every field is read numerically off the zoned value and every separator
// is written by hand - no DateTimeFormatter pattern, no Locale - which
// sidesteps the ICU part-ordering and formatToParts()-versus-format()
// disagreements the web side had to measure and defend against: a
// ZonedDateTime's dayOfMonth/monthValue/year/hour/minute getters are plain
// numeric fields with no locale involved at any point, so there is no
// separator for a locale to get wrong.

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException

/**
 * A timestamp is an instant, and the audience is cross-border workers
 * living in France, so they read it in their own wall clock.
 */
const val DATE_TIME_ZONE = "Europe/Paris"

/** U+002E FULL STOP. The Swiss date separator (SPEC 6.4). */
private const val DATE_SEPARATOR = '.'

/**
 * U+00E0 LATIN SMALL LETTER A WITH GRAVE, precomposed. Built from its hex
 * codepoint - see Numbers.kt's own header for why.
 */
private val A_GRAVE: Char = 0x00E0.toChar()

/**
 * U+00A0 NO-BREAK SPACE, on BOTH sides of the a-grave (ruling R29), so the
 * timestamp is one unbreakable token.
 */
private val AT_SPACE: Char = 0x00A0.toChar()

/** U+003A COLON, between hours and minutes. */
private const val TIME_SEPARATOR = ':'

/** Exactly four digits, a dash, two digits, a dash, two digits - nothing more, nothing less. */
private val ISO_DAY_SHAPE = Regex("""^\d{4}-\d{2}-\d{2}$""")

/**
 * A calendar day, from its ISO YYYY-MM-DD string. Swiss dots, four-digit
 * year, no zone, no Intl - a pure string-and-integer transform (R28).
 *
 * TWO STAGES, DELIBERATELY. The shape check (four digits, two digits, two
 * digits, nothing else) rejects a single-digit day, a two-digit year, a
 * timestamp with a time component and a wrong separator - all the cases
 * LocalDate.parse's own lenient width handling would otherwise accept
 * or reject for reasons this file cannot rely on. LocalDate.parse then
 * rejects anything the shape check let through that is not a REAL
 * calendar day - the case a regex cannot see at all.
 */
fun formatDate(isoDay: String): String {
    require(ISO_DAY_SHAPE.matches(isoDay)) {
        "formatDate needs an ISO YYYY-MM-DD day, received \"$isoDay\""
    }

    val parsed =
        try {
            LocalDate.parse(isoDay)
        } catch (cause: DateTimeParseException) {
            throw IllegalArgumentException(
                "\"$isoDay\" is not a real calendar day in ISO YYYY-MM-DD form",
                cause,
            )
        }

    val day = parsed.dayOfMonth.toString().padStart(2, '0')
    val month = parsed.monthValue.toString().padStart(2, '0')
    val year = parsed.year.toString().padStart(4, '0')

    return "$day$DATE_SEPARATOR$month$DATE_SEPARATOR$year"
}

/**
 * An instant, from its ISO timestamp string, as "18.06.2027 a 18:03"
 * (SPEC 6.4) in 24-hour time.
 *
 * The zone defaults to Europe/Paris and is PINNED, never inherited: a
 * ZoneId resolved from nothing would resolve to the JVM's own default,
 * which is correct on a machine set to Europe/Paris and wrong for anyone
 * else - the same trap Numbers.kt documents for Locale.getDefault().
 */
fun formatDateTime(
    iso: String,
    timeZone: String = DATE_TIME_ZONE,
): String {
    val instant =
        try {
            Instant.parse(iso)
        } catch (cause: DateTimeParseException) {
            throw IllegalArgumentException(
                "formatDateTime needs an ISO timestamp, received \"$iso\"",
                cause,
            )
        }

    val zoned = instant.atZone(ZoneId.of(timeZone))
    val day = zoned.dayOfMonth.toString().padStart(2, '0')
    val month = zoned.monthValue.toString().padStart(2, '0')
    val year = zoned.year.toString().padStart(4, '0')
    val hour = zoned.hour.toString().padStart(2, '0')
    val minute = zoned.minute.toString().padStart(2, '0')

    return "$day$DATE_SEPARATOR$month$DATE_SEPARATOR$year$AT_SPACE$A_GRAVE$AT_SPACE$hour$TIME_SEPARATOR$minute"
}
