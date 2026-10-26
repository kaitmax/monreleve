@file:Suppress("TooManyFunctions")

package ch.monreleve.app.fr.text

// IOS-1a R570. THE SAME STRING ON BOTH PLATFORMS: the French number formats in pure Kotlin, so iOS prints
// exactly what :app's fr/format prints on Android without asking NSNumberFormatter (whose CLDR data is not the
// JVM's) for anything. :app's own fr/format is UNCHANGED and keeps its own java.text implementation - Android's
// switch-over to this file is a later task, and this one proves it would be safe: FrenchFormatGoldens holds
// ~12,700 strings captured from Android's actual output, and FrNumbersGoldenTest runs every one of them on the
// JVM and on the iPhone simulator.
//
// WHAT MAKES IT EXACT, AND WHERE IT WAS TRAPPED. java.text.DecimalFormat does not round the Double's binary
// value; it rounds the Double's SHORTEST DECIMAL DIGITS (0.83 is the digits "83", not 0.82999999999999996...),
// which is why formatDeclarableRate's Float trap exists (AN-CALENDAR R479). So this works on Double.toString()'s
// digits the same way and never multiplies by a power of ten. RoundingMode.DOWN is a cut of those digits;
// RoundingMode.HALF_UP (formatPoints) is a cut plus one decision - at an exact tie of the SHORTEST digits the
// JDK looks at whether those digits were rounded up from the true binary value, and rounds up only if they were
// not. [tieRoundsUp] answers the same question with an exact (error-free) product instead of BigDecimal.
//
// SEPARATORS ARE BUILT FROM CODEPOINTS, as Numbers.kt in :app does, so no editor can normalise one into
// another: U+202F narrow no-break space groups thousands, U+00A0 sits before the percent sign, the decimal
// separator is a comma and the sign is U+002D.

import kotlin.math.abs

private val GROUP_SEPARATOR: Char = 0x202F.toChar()
private val PERCENT_SPACE: Char = 0x00A0.toChar()
private const val DECIMAL_SEPARATOR = ','
private const val MINUS = '-'
private const val GROUP_SIZE = 3
private const val DECLARABLE_RATE_DECIMALS = 2
private const val POINTS_DECIMALS = 2
private const val RADIX = 10
private const val MAX_EXACT_TIE_DIGITS = 17
private const val DEKKER_SPLITTER = 134217729.0

private enum class Rounding { DOWN, HALF_UP }

/** The digits of a finite non-negative Double as Double.toString() prints them: integer part and fraction part. */
private class Digits(val integer: String, val fraction: String)

private fun requireFinite(
    value: Double,
    formatter: String,
) {
    require(value.isFinite()) { "$formatter needs a finite number, received $value" }
}

/** Double.toString() in plain or E notation, pulled apart into integer and fraction digits with no exponent left. */
private fun shortestDigits(magnitude: Double): Digits {
    val text = magnitude.toString()
    val exponentAt = text.indexOfFirst { it == 'E' || it == 'e' }
    val mantissa = if (exponentAt < 0) text else text.substring(0, exponentAt)
    val exponent = if (exponentAt < 0) 0 else text.substring(exponentAt + 1).toInt()
    val pointAt = mantissa.indexOf('.')
    val allDigits = mantissa.replace(".", "")
    val pointPosition = (if (pointAt < 0) mantissa.length else pointAt) + exponent
    val integer =
        when {
            pointPosition <= 0 -> "0"
            pointPosition >= allDigits.length -> allDigits + "0".repeat(pointPosition - allDigits.length)
            else -> allDigits.substring(0, pointPosition)
        }
    val fraction =
        when {
            pointPosition <= 0 -> "0".repeat(-pointPosition) + allDigits
            pointPosition >= allDigits.length -> ""
            else -> allDigits.substring(pointPosition)
        }
    return Digits(integer.trimStart('0').ifEmpty { "0" }, fraction)
}

private fun split(a: Double): Pair<Double, Double> {
    val c = DEKKER_SPLITTER * a
    val high = c - (c - a)
    return high to (a - high)
}

/** Dekker's TwoProduct: a * b == product + error EXACTLY, in plain Double arithmetic. */
private fun twoProduct(
    a: Double,
    b: Double,
): Pair<Double, Double> {
    val product = a * b
    val (aHigh, aLow) = split(a)
    val (bHigh, bLow) = split(b)
    val error = ((aHigh * bHigh - product) + aHigh * bLow + aLow * bHigh) + aLow * bLow
    return product to error
}

/**
 * The JDK's HALF_UP decision at an exact tie of the shortest digits. [magnitude]'s shortest digits are
 * integer+fraction with exactly [decimals] + 1 fraction digits, the last being 5. The binary value is either
 * below the decimal (the shortest digits were rounded UP to reach it), above it, or exactly it. HALF_UP rounds
 * up unless the digits were rounded up already: java.text.DigitList.shouldRoundUp, HALF_UP case.
 */
private fun tieRoundsUp(
    magnitude: Double,
    digits: Digits,
    decimals: Int,
): Boolean {
    val all = digits.integer.trimStart('0') + digits.fraction
    if (all.length > MAX_EXACT_TIE_DIGITS) return true
    val scale = RADIX.toDouble().let { base -> (1..decimals + 1).fold(1.0) { acc, _ -> acc * base } }
    val scaled = (if (all.isEmpty()) "0" else all).toLong().toDouble()
    val (product, error) = twoProduct(magnitude, scale)
    val difference = (product - scaled) + error
    return difference >= 0.0
}

/** Whether the digit after the kept ones makes HALF_UP round up; a tie is decided exactly, see [tieRoundsUp]. */
private fun roundsUp(
    digits: Digits,
    magnitude: Double,
    maximumFractionDigits: Int,
): Boolean {
    val next = digits.fraction[maximumFractionDigits]
    val isLastDigit = digits.fraction.length == maximumFractionDigits + 1
    return when {
        next > '5' -> true
        next < '5' -> false
        !isLastDigit -> true
        else -> tieRoundsUp(magnitude, digits, maximumFractionDigits)
    }
}

private fun cut(
    digits: Digits,
    magnitude: Double,
    maximumFractionDigits: Int,
    rounding: Rounding,
): Digits {
    val fits = digits.fraction.length <= maximumFractionDigits
    val kept = digits.fraction.take(maximumFractionDigits)
    val up = !fits && rounding == Rounding.HALF_UP && roundsUp(digits, magnitude, maximumFractionDigits)
    return when {
        fits -> digits
        !up -> Digits(digits.integer, kept)
        else -> {
            val bumped = increment(digits.integer + kept)
            val integerLength = bumped.length - maximumFractionDigits
            Digits(bumped.substring(0, integerLength), bumped.substring(integerLength))
        }
    }
}

/** Adds one unit in the last place to a string of decimal digits. */
private fun increment(digits: String): String {
    val out = digits.toCharArray()
    var i = out.size - 1
    while (i >= 0) {
        if (out[i] == '9') {
            out[i] = '0'
            i--
        } else {
            out[i] = out[i] + 1
            return out.concatToString()
        }
    }
    return "1" + out.concatToString()
}

private fun group(integer: String): String {
    val parts = ArrayList<String>()
    var end = integer.length
    while (end > GROUP_SIZE) {
        parts.add(0, integer.substring(end - GROUP_SIZE, end))
        end -= GROUP_SIZE
    }
    parts.add(0, integer.substring(0, end))
    return parts.joinToString(GROUP_SEPARATOR.toString())
}

private fun isNegative(value: Double): Boolean = value < 0.0 || (value == 0.0 && 1.0 / value < 0.0)

/**
 * java.text.DecimalFormat("#,##0") as :app configures it: grouping 3 with U+202F, comma decimal, '-' sign,
 * [minimumFractionDigits]..[maximumFractionDigits] fraction digits, the given rounding. A negative value
 * keeps its sign even when its digits cut to zero ("-0,00"), as DecimalFormat does.
 */
private fun digits(
    value: Double,
    minimumFractionDigits: Int,
    maximumFractionDigits: Int,
    rounding: Rounding,
): String {
    val magnitude =
        if (value < 0.0) {
            -value
        } else if (value == 0.0) {
            0.0
        } else {
            value
        }
    val shortest = shortestDigits(magnitude)
    val cutDigits = cut(shortest, magnitude, maximumFractionDigits, rounding)
    var fraction = cutDigits.fraction.padEnd(minimumFractionDigits, '0')
    while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) fraction = fraction.dropLast(1)
    val sign = if (isNegative(value)) MINUS.toString() else ""
    val decimals = if (fraction.isEmpty()) "" else "$DECIMAL_SEPARATOR$fraction"
    return sign + group(cutDigits.integer) + decimals
}

/** A percentage with the mandated U+00A0 before the sign; the precision is required, never defaulted (R97). */
fun formatPercent(
    value: Double,
    decimals: Int,
): String {
    requireFinite(value, "formatPercent")
    return "${digits(value, decimals, decimals, Rounding.DOWN)}$PERCENT_SPACE%"
}

/** The declarable rate as every screen shows it: two decimals, cut not rounded (SPEC 7.3). */
fun formatDeclarableRate(rate: Double): String = formatPercent(rate, DECLARABLE_RATE_DECIMALS)

/** A count of days, zero to one decimal, grouped with U+202F. */
fun formatDays(value: Double): String {
    requireFinite(value, "formatDays")
    return digits(value, 0, 1, Rounding.DOWN)
}

/** A count of percentage points, always two decimals, HALF_UP (AN-RECON). */
fun formatPoints(value: Double): String {
    requireFinite(value, "formatPoints")
    return digits(value, POINTS_DECIMALS, POINTS_DECIMALS, Rounding.HALF_UP)
}

/** A day count whose sign the caller renders itself; [text] carries no sign character. */
data class SignedDays(
    val text: String,
    val negative: Boolean,
)

/** A negative headroom is "four days over", said with a word by the caller; negative zero reports positive. */
fun formatSignedDays(value: Double): SignedDays {
    requireFinite(value, "formatSignedDays")
    return SignedDays(text = formatDays(abs(value)), negative = value < 0.0)
}
