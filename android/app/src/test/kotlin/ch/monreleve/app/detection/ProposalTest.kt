package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN6a increment 4. Tiers from the tally (field-protocol thresholds), and a proposal that is
 * only ever "En Suisse" or "Domicile", never a mission or an absence, and never a record.
 */
class ProposalTest {
    private val expected = expectedSamples() // a 12h window at 15-minute cadence: 48

    private fun tally(
        fixCount: Int,
        buffer: Int,
        ch: Int,
        elsewhere: Int,
    ) = DailyTally(minutesSwitzerland = ch, minutesElsewhere = elsewhere, fixCount = fixCount, bufferFixCount = buffer)

    private fun tierOf(
        fixCount: Int,
        buffer: Int,
        ch: Int,
        elsewhere: Int,
    ) = computeTier(tally(fixCount, buffer, ch, elsewhere), expected)

    private fun proposalOf(
        fixCount: Int,
        buffer: Int,
        ch: Int,
        elsewhere: Int,
        fixes: List<ClassifiedFix> = emptyList(),
    ) = computeProposal(tally(fixCount, buffer, ch, elsewhere), fixes, "2027-06-18")

    @Test
    fun expectedSamplesIsWindowOverCadence() {
        assertEquals(48, expected)
    }

    @Test
    fun aClearSwissDayIsHigh() {
        // 32/48 samples (67%), 6% buffer, 92% of minutes Swiss.
        assertEquals(Tier.HIGH, tierOf(fixCount = 32, buffer = 2, ch = 440, elsewhere = 40))
    }

    @Test
    fun aThinnerOrBufferHeavyDayIsMedium() {
        // 16/48 (33%), 31% buffer, 75% one side - decisive but not clean.
        assertEquals(Tier.MEDIUM, tierOf(fixCount = 16, buffer = 5, ch = 360, elsewhere = 120))
    }

    @Test
    fun fewFixesAreLow() {
        assertEquals(Tier.LOW, tierOf(fixCount = 5, buffer = 0, ch = 60, elsewhere = 0))
    }

    @Test
    fun aSplitDayIsLowBecauseNeitherSideWins() {
        // 50/50 is below the 70% side share, so LOW, so withheld - the "half-day case".
        assertEquals(Tier.LOW, tierOf(fixCount = 32, buffer = 0, ch = 240, elsewhere = 240))
    }

    @Test
    fun aNoFixDayIsLow() {
        assertEquals(Tier.LOW, tierOf(fixCount = 0, buffer = 0, ch = 0, elsewhere = 0))
    }

    @Test
    fun lowWithholdsTheProposal() {
        assertNull(
            "a LOW day proposes nothing (Non renseigne)",
            proposalOf(fixCount = 5, buffer = 0, ch = 60, elsewhere = 0),
        )
    }

    @Test
    fun aCommuteDayProposesAFullSwissDay() {
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL),
            proposalOf(fixCount = 32, buffer = 2, ch = 480, elsewhere = 0),
        )
    }

    @Test
    fun aTeleworkDayProposesAFullHomeDay() {
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL),
            proposalOf(fixCount = 32, buffer = 2, ch = 0, elsewhere = 480),
        )
    }

    @Test
    fun aShortOneSidedAfternoonProposesAHalfDayPm() {
        // 3h Swiss, all fixes in the afternoon -> half day, PM.
        val window = workingWindowParis("2027-06-18")
        val afternoon = (window.first + window.last) / 2 + 60 * 60_000L
        val fixes = (0 until 24).map { ClassifiedFix(Classification.INSIDE, afternoon + it * 60_000L) }
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.CH, Portion.PM),
            proposalOf(fixCount = 24, buffer = 0, ch = 180, elsewhere = 0, fixes = fixes),
        )
    }

    @Test
    fun aProposalIsNeverAMissionOrAnAbsence() {
        // Across a sweep of tallies, the proposed kind is only ever CH or HOME.
        for (swiss in 0..480 step 60) {
            val proposal = proposalOf(fixCount = 40, buffer = 0, ch = swiss, elsewhere = 480 - swiss)
            if (proposal != null) {
                assertTrue(
                    "detection proposes only CH or HOME, never ${proposal.kind}",
                    proposal.kind == EntryKind.CH || proposal.kind == EntryKind.HOME,
                )
            }
        }
    }
}
