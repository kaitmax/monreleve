package ch.monreleve.app.fr.format

// AN3 increment 1. Kotlin port of web/lib/ui/core/format/number.ts.
//
// SPEC 6.4: formatPercent(34.6, 1) -> "34,6 %" (U+00A0), formatDays(1234.5)
// -> "1 234,5" (U+202F).
//
// THE KOTLIN LOCALE TRAP THIS FILE EXISTS TO AVOID. java.text.DecimalFormat
// and NumberFormat.getInstance() both default to Locale.getDefault() when
// constructed with no locale argument - and on an Android device, the
// DEFAULT locale is the USER'S, read from their system settings. A French
// document formatted under a Turkish or German device locale would emit a
// period where the AFC expects a comma, or a different grouping character
// entirely; DecimalFormatSymbols under Locale("de", "DE") groups with a
// period and decimals with a comma - the OPPOSITE of SPEC 6.4. See
// LocaleTrapsTest.kt for this measured directly, not assumed.
//
// THE FIX IS THE SAME SHAPE AS THE WEB SIDE'S: use a locale-independent
// symbol table (Locale.ROOT, never Locale.getDefault()) for the DIGIT
// ARITHMETIC ONLY - grouping position, rounding - and overwrite every
// separator character explicitly. digits() below is normaliseNumber's
// Kotlin equivalent: the seam where locale-independence is enforced.
//
// EVERY SEPARATOR IS BUILT FROM ITS HEX CODEPOINT VIA Int.toChar(), NEVER A
// PASTED CHARACTER (matching the web side's own recorded reasoning, ruling
// R96's shape): a no-break space and a plain space are indistinguishable
// in this editor and in a diff, so a literal pasted here could silently be
// the wrong one and no reviewer would see it. A Kotlin \u escape has the
// same visibility property, but this environment's own input handling
// resolves a typed escape sequence back into the literal character before it
// reaches the file - measured directly while writing this file, not
// assumed - so the hex-codepoint form is the one that actually stays
// auditable here. NumbersMetaTest.kt asserts this file's own source
// carries no literal instance of either character.
//
// WHY TRUNCATE. Rounding half-up would render 39.95 at one decimal as
// "40,0" - a rate BELOW the fiscal ceiling displayed as one that reaches
// it. RoundingMode.DOWN (round toward zero, matching JS Math.trunc - NOT
// RoundingMode.FLOOR, which rounds toward negative infinity and would
// behave differently below zero) renders "39,9". declarable-rate.ts
// truncates for the same reason (SPEC 7.3); this keeps the formatter
// consistent with the engine.

import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/** U+202F NARROW NO-BREAK SPACE. The thousands group separator (SPEC 6.4). */
private val GROUP_SEPARATOR: Char = 0x202F.toChar()

/** U+002C COMMA. The decimal separator. */
private const val DECIMAL_SEPARATOR = ','

/** U+00A0 NO-BREAK SPACE. Between figure and percent sign (SPEC 6.4). */
private val PERCENT_SPACE: Char = 0x00A0.toChar()

/** U+002D HYPHEN-MINUS, so a sign can never arrive as U+2212 instead. */
private const val MINUS = '-'

private fun requireFinite(
    value: Double,
    formatter: String,
) {
    // "NaN %" on a filing document is worse than a crash: it looks like a
    // number the reader is meant to act on.
    require(value.isFinite()) { "$formatter needs a finite number, received $value" }
}

/**
 * The seam where locale-independence is enforced: Locale.ROOT for the
 * digit arithmetic, every separator overwritten by hand afterward. Grouping
 * size is set explicitly to 3 rather than trusted to Locale.ROOT's default,
 * for the same reason useGrouping:'always' is explicit on the TS side - a
 * locale whose default groups differently must not be able to change this
 * silently.
 */
private fun digits(
    value: Double,
    minimumFractionDigits: Int,
    maximumFractionDigits: Int,
    rounding: RoundingMode = RoundingMode.DOWN,
): String {
    val format = DecimalFormat("#,##0", DecimalFormatSymbols(Locale.ROOT))

    format.decimalFormatSymbols =
        DecimalFormatSymbols(Locale.ROOT).apply {
            groupingSeparator = GROUP_SEPARATOR
            decimalSeparator = DECIMAL_SEPARATOR
            minusSign = MINUS
        }
    format.minimumFractionDigits = minimumFractionDigits
    format.maximumFractionDigits = maximumFractionDigits
    format.isGroupingUsed = true
    format.groupingSize = 3
    format.roundingMode = rounding

    return format.format(value)
}

/**
 * A percentage, in French, with the mandated U+00A0 before the sign.
 *
 * PRECISION IS REQUIRED, NO DEFAULT (matching ruling R97). Kotlin enforces
 * this structurally: `decimals` carries no default value, so a call site
 * omitting it is a compile error, not a runtime default that silently
 * chooses wrong. R97's own history: `decimals = 1` looked reasonable
 * (SPEC 6.4's own example), and a caller then rendered a 2-decimal
 * declarable rate at 1 decimal - 39.16 as "39,1 %" - because the default
 * absorbed a forgotten argument instead of failing to compile.
 *
 *   declarable rate   2   SPEC 7.3, the filed figure
 *   raw rate          1   the share-of-days figure
 *   threshold labels  0 or 1, depending on whether the value is whole
 */
fun formatPercent(
    value: Double,
    decimals: Int,
): String {
    requireFinite(value, "formatPercent")

    return "${digits(value, decimals, decimals)}$PERCENT_SPACE%"
}

/** AN-CALENDAR (R479): the declarable rate's precision - SPEC 7.3, the filed figure. */
private const val DECLARABLE_RATE_DECIMALS = 2

/**
 * THE DECLARABLE RATE, AS EVERY SCREEN SHOWS IT - one home (R206), so two screens cannot show one record two ways.
 *
 * AN-CALENDAR (R479). The engine has already truncated the rate to two decimals (DeclarableRate.kt), and this
 * truncates nothing the engine did not - PROVIDED it is handed the engine's Double. A Float copy is not that: 0.83
 * as a Float is 0.829999983..., which truncates to "0,82". That is how Aujourd'hui, animating the rate through a
 * Float, read 0,82 % where the forecast read 0,83 % for the same record (REPORT-KMP-4 NOTICED 2) - and Geneva's
 * 39,16 % would have read 39,15 % on the home screen.
 */
fun formatDeclarableRate(rate: Double): String = formatPercent(rate, DECLARABLE_RATE_DECIMALS)

/**
 * A count of days, grouped with U+202F.
 *
 * Zero to one decimal: days arrive as whole days and half-days, so "240,0"
 * would imply a precision the input does not have, and "96,5" must keep
 * its half.
 */
fun formatDays(value: Double): String {
    requireFinite(value, "formatDays")

    return digits(value, 0, 1)
}

/**
 * AN-RECON: a count of percentage POINTS, always two decimals (the gap between two two-decimal rates). Rounded
 * HALF_UP, not DOWN: the gap is an exact two-decimal difference (41,25 - 39,16 = 2,09), so the float error in
 * its representation is recovered rather than truncated - 2,0899999 must read "2,09", never "2,08".
 */
fun formatPoints(value: Double): String {
    requireFinite(value, "formatPoints")

    return digits(value, 2, 2, RoundingMode.HALF_UP)
}

/** A day count whose sign the caller renders itself. */
data class SignedDays(
    /** The magnitude, already formatted. Carries no sign character. */
    val text: String,
    val negative: Boolean,
)

/**
 * remainingToFiscal and remainingToSocial may be negative (SPEC 7.4), and a
 * negative headroom is not "minus four days" - it is four days over, which
 * French says with a word ("depasse de") rather than a glyph.
 *
 * So the sign comes back as a flag and never enters the text. Negative
 * zero reports positive, because zero days remaining is not a deficit.
 */
fun formatSignedDays(value: Double): SignedDays {
    requireFinite(value, "formatSignedDays")

    return SignedDays(text = formatDays(Math.abs(value)), negative = value < 0)
}
