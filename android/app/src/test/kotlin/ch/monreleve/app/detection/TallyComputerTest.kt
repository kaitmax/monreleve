package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * AN6a increment 3. The tally, and the hysteresis (D26): sub-10-minute excursions fold back
 * into the preceding side; longer ones are kept; buffer time counts for neither side.
 *
 * R120's shape: a 9-minute excursion is where two derivations disagree. Naive minute-counting
 * gives 200 min Switzerland and 9 elsewhere; the hysteresis this asserts gives 209 and 0,
 * because a 9-minute flip near the border is GPS flicker, not a trip abroad.
 */
class TallyComputerTest {
    // A fix on `side` at `minute` minutes past a fixed base. Consecutive marks define the
    // intervals whose durations the tally attributes.
    private fun fixes(vararg marks: Pair<Int, Classification>): List<ClassifiedFix> {
        val base = 1_777_000_000_000L
        return marks.map { (minute, side) -> ClassifiedFix(side, base + minute * 60_000L) }
    }

    @Test
    fun awholeDayInsideCountsAsSwitzerland() {
        val tally = computeTally(fixes(0 to Classification.INSIDE, 480 to Classification.INSIDE))
        assertEquals(480, tally.minutesSwitzerland)
        assertEquals(0, tally.minutesElsewhere)
        assertEquals(2, tally.fixCount)
        assertEquals(0, tally.bufferFixCount)
    }

    @Test
    fun aShortExcursionIsFoldedBack() {
        // 100 min IN, 9 min OUT, 100 min IN -> the 9 folds into Switzerland.
        val tally =
            computeTally(
                fixes(
                    0 to Classification.INSIDE,
                    100 to Classification.OUTSIDE,
                    109 to Classification.INSIDE,
                    209 to Classification.INSIDE,
                ),
            )
        assertEquals(209, tally.minutesSwitzerland)
        assertEquals(0, tally.minutesElsewhere)
    }

    @Test
    fun aLongerExcursionIsKept() {
        // 11 min OUT is past the 10-minute threshold and stands.
        val tally =
            computeTally(
                fixes(
                    0 to Classification.INSIDE,
                    100 to Classification.OUTSIDE,
                    111 to Classification.INSIDE,
                    211 to Classification.INSIDE,
                ),
            )
        assertEquals(200, tally.minutesSwitzerland)
        assertEquals(11, tally.minutesElsewhere)
    }

    @Test
    fun tenMinutesIsTheThreshold() {
        // Exactly 10 minutes is provisional, not folded (the fold is strictly under 10).
        val tally =
            computeTally(
                fixes(
                    0 to Classification.INSIDE,
                    100 to Classification.OUTSIDE,
                    110 to Classification.INSIDE,
                    210 to Classification.INSIDE,
                ),
            )
        assertEquals(200, tally.minutesSwitzerland)
        assertEquals(10, tally.minutesElsewhere)
    }

    @Test
    fun oscillationAlongTheBorderFoldsToTheDominantSide() {
        // Twenty minutes home, five out, repeated - each 5-minute flip is folded home.
        val marks =
            buildList {
                var minute = 0
                repeat(6) {
                    add(minute to Classification.INSIDE)
                    minute += 20
                    add(minute to Classification.OUTSIDE)
                    minute += 5
                }
                add(minute to Classification.INSIDE)
            }
        val tally = computeTally(fixes(*marks.toTypedArray()))
        assertEquals("every 5-minute excursion folds home", 0, tally.minutesElsewhere)
        assertEquals(150, tally.minutesSwitzerland)
    }

    @Test
    fun bufferFixesAreCountedButAttributedToNeitherSide() {
        val tally =
            computeTally(
                fixes(
                    0 to Classification.INSIDE,
                    100 to Classification.BUFFER,
                    120 to Classification.INSIDE,
                    220 to Classification.INSIDE,
                ),
            )
        assertEquals(200, tally.minutesSwitzerland)
        assertEquals(0, tally.minutesElsewhere)
        assertEquals(1, tally.bufferFixCount)
        assertEquals(4, tally.fixCount)
    }
}
