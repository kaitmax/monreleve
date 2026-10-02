package ch.monreleve.app.detection

import ch.monreleve.app.detection.Classification.BUFFER
import ch.monreleve.app.detection.Classification.INSIDE
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// R313 under R320. The app recognises someone who lives near the border FROM DATA IT ALREADY KEEPS - how many of a
// day's four checks land in the 150 m strip - and NO COORDINATE. A working day is near-border when >= 2 of its 4
// checks are in the strip (50 %, above the protocol's 40 % MEDIUM ceiling). When that holds on >= 3 of the last 5
// working days WITH DATA, the person is told once and offered manual (respected either way, D19). PROPOSED (R276).

class NearBorderTest {
    private fun day(
        c1: Classification?,
        c2: Classification?,
        c3: Classification?,
        c4: Classification?,
    ) = DayChecks(c1, c2, c3, c4)

    private val near = day(BUFFER, BUFFER, INSIDE, INSIDE) // 2 in the strip -> near-border
    private val clean = day(INSIDE, INSIDE, INSIDE, INSIDE) // none in the strip
    private val noData = day(null, null, null, null)

    @Test
    fun aDayWithTwoOrMoreStripChecksIsNearBorder() {
        assertTrue(isNearBorderDay(day(BUFFER, BUFFER, INSIDE, INSIDE))) // 2 of 4
        assertTrue(isNearBorderDay(day(BUFFER, BUFFER, BUFFER, null))) // 3 of 3 taken
        assertFalse("one strip check is not enough", isNearBorderDay(day(BUFFER, INSIDE, INSIDE, INSIDE)))
    }

    @Test
    fun aDayWithNoDataIsNeverNearBorder() {
        assertFalse(isNearBorderDay(noData))
    }

    @Test
    fun threeOfTheLastFiveWithDataTriggersTheSuggestion() {
        assertTrue(shouldSuggestManualForNearBorder(listOf(near, clean, near, clean, near)))
    }

    @Test
    fun twoOfTheLastFiveDoesNotTrigger() {
        assertFalse(shouldSuggestManualForNearBorder(listOf(near, clean, near, clean, clean)))
    }

    @Test
    fun daysWithNoDataAreExcludedFromTheWindow() {
        // Interleaved no-data days must not dilute: the window is the last 5 days WITH data.
        assertTrue(shouldSuggestManualForNearBorder(listOf(near, noData, near, noData, near, noData)))
    }

    @Test
    fun onlyTheLastFiveWithDataCount() {
        // Three near-border days early, then five clean days: the recent window is clean, so no suggestion.
        assertFalse(
            shouldSuggestManualForNearBorder(listOf(near, near, near, clean, clean, clean, clean, clean)),
        )
    }

    @Test
    fun theConstantsCiteTheProtocolWindowAndThreshold() {
        assertEquals(5, NEAR_BORDER_WINDOW_DAYS)
        assertEquals(3, NEAR_BORDER_DAYS_THRESHOLD)
        assertEquals(2, NEAR_BORDER_STRIP_CHECKS)
    }
}
