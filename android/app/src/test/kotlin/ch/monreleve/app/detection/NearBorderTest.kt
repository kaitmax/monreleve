package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-AUTO increment 6 (R313). The app recognises someone who lives near the border FROM DATA IT ALREADY KEEPS
// - the daily tally's buffer-fix share - and NO COORDINATE. A working day is "near-border" when its share of
// fixes in the 150 m buffer is ABOVE the field protocol's MEDIUM ceiling (MEDIUM_BUFFER_SHARE): above it a day
// cannot even reach MEDIUM. When that holds on >= 3 of the last 5 working days WITH DATA, the person is told
// once that detection is unreliable where they live and offered manual (respected either way, D19).
//
// The threshold reuses the protocol constant (R276), so it is PROPOSED and frozen when the field test starts.

private fun tally(
    fixCount: Int,
    buffer: Int,
) = DailyTally(minutesSwitzerland = 0, minutesElsewhere = 0, fixCount = fixCount, bufferFixCount = buffer)

class NearBorderTest {
    @Test
    fun aDayAboveTheMediumBufferCeilingIsNearBorder() {
        // 0.40 is the MEDIUM ceiling; strictly above it a day cannot reach MEDIUM, so it is near-border.
        assertTrue(isNearBorderDay(tally(fixCount = 10, buffer = 5))) // 0.50 > 0.40
        assertFalse("exactly at the ceiling still reaches MEDIUM", isNearBorderDay(tally(fixCount = 10, buffer = 4)))
        assertFalse("a clean day is not near-border", isNearBorderDay(tally(fixCount = 10, buffer = 1)))
    }

    @Test
    fun aDayWithNoDataIsNeverNearBorder() {
        assertFalse(isNearBorderDay(tally(fixCount = 0, buffer = 0)))
    }

    @Test
    fun threeOfTheLastFiveWithDataTriggersTheSuggestion() {
        val near = tally(fixCount = 10, buffer = 6) // 0.60, near-border
        val clean = tally(fixCount = 10, buffer = 1) // clean
        assertTrue(shouldSuggestManualForNearBorder(listOf(near, clean, near, clean, near)))
    }

    @Test
    fun twoOfTheLastFiveDoesNotTrigger() {
        val near = tally(fixCount = 10, buffer = 6)
        val clean = tally(fixCount = 10, buffer = 1)
        assertFalse(shouldSuggestManualForNearBorder(listOf(near, clean, near, clean, clean)))
    }

    @Test
    fun daysWithNoDataAreExcludedFromTheWindow() {
        val near = tally(fixCount = 10, buffer = 6)
        val noData = tally(fixCount = 0, buffer = 0)
        // Five no-data days interleaved must not dilute: the window is the last 5 days WITH data.
        assertTrue(
            shouldSuggestManualForNearBorder(listOf(near, noData, near, noData, near, noData)),
        )
    }

    @Test
    fun onlyTheLastFiveWithDataCount() {
        val near = tally(fixCount = 10, buffer = 6)
        val clean = tally(fixCount = 10, buffer = 1)
        // Three near-border days early, then five clean days: the recent window is clean, so no suggestion.
        assertFalse(
            shouldSuggestManualForNearBorder(listOf(near, near, near, clean, clean, clean, clean, clean)),
        )
    }

    @Test
    fun theConstantsCiteTheProtocolWindowAndThreshold() {
        assertEquals(5, NEAR_BORDER_WINDOW_DAYS)
        assertEquals(3, NEAR_BORDER_DAYS_THRESHOLD)
    }
}
