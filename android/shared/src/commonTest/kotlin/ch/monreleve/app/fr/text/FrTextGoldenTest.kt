package ch.monreleve.app.fr.text

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-1a R570. Every string :app's fr/format printed on Android when FrenchFormatGoldens was captured, run
// through the pure-Kotlin formatters of commonMain. This file runs on the JVM and on the iPhone simulator
// (commonTest runs on both), which is the whole claim: one function, the same string, on every platform.
//
// A golden that will not pass is a QUESTION, never an edit (R156): the expectations are Android's output.

private const val PROOF_FLOOR = 800

/** Runs every golden, collecting ALL mismatches so one run shows the whole shape of a divergence. */
private fun check(
    name: String,
    goldens: List<GoldenPair>,
    actual: (String) -> String,
) {
    val misses = ArrayList<String>()
    for ((input, expected) in goldens) {
        val got =
            try {
                actual(input)
            } catch (e: IllegalArgumentException) {
                "IAE:" + e.message
            }
        if (got != expected) misses.add("$name input=$input expected=$expected got=$got")
    }
    assertTrue(misses.isEmpty(), "${misses.size} of ${goldens.size} $name goldens differ; first: ${misses.take(5)}")
}

class FrTextGoldenTest {
    @Test
    fun percentWithZeroOneAndTwoDecimalsMatchesAndroid() {
        check("PERCENT0", FrenchFormatGoldens.PERCENT0) { formatPercent(it.toDouble(), 0) }
        check("PERCENT1", FrenchFormatGoldens.PERCENT1) { formatPercent(it.toDouble(), 1) }
        check("PERCENT2", FrenchFormatGoldens.PERCENT2) { formatPercent(it.toDouble(), 2) }
    }

    @Test
    fun declarableRateMatchesAndroid() =
        check("DECLARABLE", FrenchFormatGoldens.DECLARABLE) { formatDeclarableRate(it.toDouble()) }

    @Test
    fun daysAndSignedDaysMatchAndroid() {
        check("DAYS", FrenchFormatGoldens.DAYS) { formatDays(it.toDouble()) }
        check("SIGNED", FrenchFormatGoldens.SIGNED) {
            val signed = formatSignedDays(it.toDouble())
            (if (signed.negative) "-" else "+") + signed.text
        }
    }

    @Test
    fun pointsMatchAndroidIncludingTheHalfUpTies() =
        check("POINTS", FrenchFormatGoldens.POINTS) { formatPoints(it.toDouble()) }

    @Test
    fun datesMatchAndroid() {
        check("DATE", FrenchFormatGoldens.DATE) { formatDate(it) }
        check("DAYLONG", FrenchFormatGoldens.DAYLONG) { formatDayLong(it) }
        check("MONTHYEAR", FrenchFormatGoldens.MONTHYEAR) {
            val (year, month) = it.split("-")
            formatMonthYear(year.toInt(), month.toInt())
        }
        check("MONTHNAME", FrenchFormatGoldens.MONTHNAME) { formatMonthName(it.toInt()) }
        check("MONTHLOWER", FrenchFormatGoldens.MONTHLOWER) { formatMonthNameLower(it.toInt()) }
    }

    @Test
    fun invalidDaysRefuseWithAndroidsMessages() {
        check("DATE_INVALID", FrenchFormatGoldens.DATE_INVALID) { formatDate(it) }
        check("DAYLONG_INVALID", FrenchFormatGoldens.DAYLONG_INVALID) { formatDayLong(it) }
    }

    @Test
    fun theGoldensAreNotEmpty() {
        // R133: a loop over an empty list passes. Each family must hold what it was captured with.
        assertTrue(FrenchFormatGoldens.PERCENT2.size > PROOF_FLOOR, "PERCENT2 ${FrenchFormatGoldens.PERCENT2.size}")
        assertTrue(FrenchFormatGoldens.DAYLONG.size >= 1461, "DAYLONG ${FrenchFormatGoldens.DAYLONG.size}")
        assertEquals(12, FrenchFormatGoldens.MONTHNAME.size)
        assertTrue(FrenchFormatGoldens.POINTS.size > 600)
    }
}
