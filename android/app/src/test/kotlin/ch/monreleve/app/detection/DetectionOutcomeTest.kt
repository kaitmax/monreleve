package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.detection.Classification.BUFFER
import ch.monreleve.app.detection.Classification.INSIDE
import ch.monreleve.app.detection.Classification.OUTSIDE
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * R311 under R320. ONLY HIGH PROPOSES IN THE PRODUCT. MEDIUM and LOW both withhold and show the not-sure message
 * (R312). The MEASUREMENT path is unchanged in spirit - the vote still scores a MEDIUM day (votedKind is non-null)
 * so the field export can separate HIGH from MEDIUM - and this test asserts BOTH halves: the product converts a
 * MEDIUM vote to NotSure, and the vote it was derived from still produced a kind. Driven from DayChecks through
 * dayProposal, so each tier is exercised end to end.
 */
class DetectionOutcomeTest {
    private fun day(
        c1: Classification?,
        c2: Classification?,
        c3: Classification?,
        c4: Classification?,
    ) = DayChecks(c1, c2, c3, c4)

    @Test
    fun aHighDayProposes() {
        val outcome = detectionOutcome(dayProposal(day(INSIDE, INSIDE, INSIDE, INSIDE)))
        assertTrue("a HIGH day proposes", outcome is DetectionOutcome.Proposed)
        assertEquals(Tier.HIGH, (outcome as DetectionOutcome.Proposed).proposal.tier)
        assertEquals(EntryKind.CH, outcome.proposal.kind)
    }

    @Test
    fun aMediumDayWithholdsInTheProductButStillScoresForMeasurement() {
        val checks = day(INSIDE, INSIDE, INSIDE, BUFFER) // 3 agree, one in the strip -> MEDIUM
        val measured = dayProposal(checks)
        assertNotNull("the vote still scores a MEDIUM day", measured)
        assertEquals(Tier.MEDIUM, measured!!.tier)
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(measured))
    }

    @Test
    fun aLowDayWithholds() {
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(dayProposal(day(INSIDE, INSIDE, OUTSIDE, OUTSIDE))))
    }

    @Test
    fun aNoFixDayWithholds() {
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(dayProposal(day(null, null, null, null))))
    }

    @Test
    fun aWithheldProposalIsNotSure() {
        assertEquals(DetectionOutcome.NotSure, detectionOutcome(null))
    }
}
