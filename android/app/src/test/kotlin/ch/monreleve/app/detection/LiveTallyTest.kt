package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Test

// AN-AUTO increment 4 (the background sampler's tally). The live sampler cannot hold a day's fixes in memory
// across WorkManager wakes and process death, and SPEC 13.1 forbids storing the fix sequence (Room holds ONLY
// the aggregate tally - "no movement timeline"). So the tally is accumulated INCREMENTALLY, one fix at a time,
// from the running aggregate plus a tiny coordinate-free cursor (the previous fix's SIDE and time).
//
// THE PROOF THIS IS CORRECT: at the sampling cadence (>= 15 min between fixes, SAMPLE_INTERVAL_MINUTES) every
// gap is >= the 10-minute hysteresis fold, so computeTally's fold never triggers and the incremental
// gap-attribution produces EXACTLY the batch tally. These tests assert accumulateFix replayed fix-by-fix
// equals computeTally over the same fixes, across the shapes the sampler meets.

private const val MIN = 60_000L

class LiveTallyTest {
    private fun fixesEvery15(
        count: Int,
        side: Classification,
        start: Long = 0L,
    ): List<ClassifiedFix> = (0 until count).map { ClassifiedFix(side, start + it * 15 * MIN) }

    /** Replay a list through accumulateFix from empty, the way the sampler does across wakes. */
    private fun live(fixes: List<ClassifiedFix>): DailyTally {
        var tally = DailyTally(0, 0, 0, 0)
        var cursor: FixCursor? = null
        for (fix in fixes) {
            val (next, nextCursor) = accumulateFix(tally, cursor, fix.classification, fix.epochMillis)
            tally = next
            cursor = nextCursor
        }
        return tally
    }

    private fun assertMatchesBatch(fixes: List<ClassifiedFix>) {
        assertEquals("incremental tally must equal the batch computeTally", computeTally(fixes), live(fixes))
    }

    @Test
    fun aClearInsideDayMatchesTheBatchTally() {
        assertMatchesBatch(fixesEvery15(44, Classification.INSIDE))
    }

    @Test
    fun aMixedDayMatchesTheBatchTally() {
        val morning = fixesEvery15(16, Classification.OUTSIDE, start = 0L)
        val afternoon = fixesEvery15(28, Classification.INSIDE, start = 16 * 15 * MIN)
        assertMatchesBatch(morning + afternoon)
    }

    @Test
    fun bufferFixesAreCountedAndAttributedToNeither() {
        val fixes =
            listOf(
                ClassifiedFix(Classification.INSIDE, 0L),
                ClassifiedFix(Classification.BUFFER, 15 * MIN),
                ClassifiedFix(Classification.BUFFER, 30 * MIN),
                ClassifiedFix(Classification.INSIDE, 45 * MIN),
                ClassifiedFix(Classification.INSIDE, 60 * MIN),
            )
        assertMatchesBatch(fixes)
        // And the buffer count is independent of attribution.
        assertEquals(2, live(fixes).bufferFixCount)
    }

    @Test
    fun aTunnelGapAttributesTheWholeGapToThePreGapSide() {
        // A 45-minute gap after an INSIDE fix: the whole gap is attributed to INSIDE, matching the batch.
        val fixes =
            fixesEvery15(3, Classification.INSIDE, start = 0L) +
                ClassifiedFix(Classification.INSIDE, (30 + 45) * MIN) +
                fixesEvery15(3, Classification.INSIDE, start = (30 + 45 + 15) * MIN)
        assertMatchesBatch(fixes)
    }

    @Test
    fun anEmptyDayIsZero() {
        assertEquals(DailyTally(0, 0, 0, 0), live(emptyList()))
    }

    @Test
    fun aSingleFixAttributesNoMinutesButCountsOne() {
        val one = listOf(ClassifiedFix(Classification.INSIDE, 0L))
        assertEquals(DailyTally(0, 0, 1, 0), live(one))
        assertMatchesBatch(one)
    }

    @Test
    fun theCursorCarriesTheLastFixSideAndTime() {
        val (_, cursor) = accumulateFix(DailyTally(0, 0, 0, 0), null, Classification.OUTSIDE, 123L)
        assertEquals(FixCursor(Classification.OUTSIDE, 123L), cursor)
    }
}
