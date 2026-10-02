package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN-AUTO increment 1 (R311). ONLY HIGH PROPOSES IN THE PRODUCT. MEDIUM and LOW both withhold and
 * show the not-sure message (R312). The MEASUREMENT path is unchanged - computeProposal still returns
 * a proposal for a MEDIUM day so the field export scores HIGH and MEDIUM separately - and this test
 * asserts BOTH halves: the product converts a MEDIUM proposal to NotSure, and the measurement layer it
 * was derived from still produced one.
 *
 * Driven from a tally through computeProposal, so "each tier" is exercised end to end, not just the
 * final mapping - the tally fixtures match ProposalTest's (HIGH 32/2/440/40, MEDIUM 16/5/360/120,
 * LOW 5/0/60/0).
 */
class DetectionOutcomeTest {
    private val expected = expectedSamples()

    private fun tally(
        fixCount: Int,
        buffer: Int,
        ch: Int,
        elsewhere: Int,
    ) = DailyTally(minutesSwitzerland = ch, minutesElsewhere = elsewhere, fixCount = fixCount, bufferFixCount = buffer)

    private fun outcomeOf(
        fixCount: Int,
        buffer: Int,
        ch: Int,
        elsewhere: Int,
    ): DetectionOutcome {
        val proposal = computeProposal(tally(fixCount, buffer, ch, elsewhere), emptyList(), "2027-06-18")
        return detectionOutcome(proposal)
    }

    @Test
    fun aHighDayProposes() {
        val outcome = outcomeOf(fixCount = 32, buffer = 2, ch = 440, elsewhere = 40)
        assertTrue("a HIGH day proposes", outcome is DetectionOutcome.Proposed)
        assertEquals(Tier.HIGH, (outcome as DetectionOutcome.Proposed).proposal.tier)
        assertEquals(EntryKind.CH, outcome.proposal.kind)
    }

    @Test
    fun aMediumDayWithholdsInTheProductButStillScoresForMeasurement() {
        val tally = tally(fixCount = 16, buffer = 5, ch = 360, elsewhere = 120)
        // The measurement path is UNCHANGED (R311): a MEDIUM day still produces a proposal to score.
        val measured = computeProposal(tally, emptyList(), "2027-06-18")
        assertNotNull("the measurement path still scores a MEDIUM day", measured)
        assertEquals(Tier.MEDIUM, measured!!.tier)
        // The PRODUCT withholds it (R311): MEDIUM shows the not-sure message, never a proposal.
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(measured))
    }

    @Test
    fun aLowDayWithholds() {
        assertEquals(DetectionOutcome.NotSure, outcomeOf(fixCount = 5, buffer = 0, ch = 60, elsewhere = 0))
    }

    @Test
    fun aNoFixDayWithholds() {
        assertEquals(DetectionOutcome.NotSure, outcomeOf(fixCount = 0, buffer = 0, ch = 0, elsewhere = 0))
    }

    @Test
    fun aWithheldProposalIsNotSure() {
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(null))
    }
}
