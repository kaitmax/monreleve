package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.detection.Classification.BUFFER
import ch.monreleve.app.detection.Classification.INSIDE
import ch.monreleve.app.detection.Classification.OUTSIDE
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * R320. The VOTE, for EVERY case (0b): HIGH / MEDIUM / LOW for the day, each half from its own two
 * checks, a MISSED check (null), and that one reading can never decide a day or a half alone. The
 * polygon and the 150 m strip classifier are unchanged; this tests only how a day is DECIDED.
 */
class VoteTest {
    private fun day(
        c1: Classification?,
        c2: Classification?,
        c3: Classification?,
        c4: Classification?,
    ) = DayChecks(c1, c2, c3, c4)

    // ---- HIGH: >= 3 taken, ALL same side, none in the strip ----

    @Test
    fun fourInsideIsHighSwitzerlandFullDay() {
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL),
            dayProposal(day(INSIDE, INSIDE, INSIDE, INSIDE)),
        )
    }

    @Test
    fun fourOutsideIsHighHomeFullDay() {
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL),
            dayProposal(day(OUTSIDE, OUTSIDE, OUTSIDE, OUTSIDE)),
        )
    }

    @Test
    fun threeTakenAllSameSideWithOneMissedIsHigh() {
        // A missed check does not lower the vote: three agreeing checks are enough for HIGH.
        assertEquals(Tier.HIGH, voteTier(day(INSIDE, INSIDE, INSIDE, null)))
        assertEquals(EntryKind.CH, votedKind(day(INSIDE, INSIDE, INSIDE, null)))
    }

    // ---- MEDIUM: >= 3 taken, exactly one on the other side or in the strip ----

    @Test
    fun threeAgreeOneOtherSideIsMedium() {
        assertEquals(Tier.MEDIUM, voteTier(day(INSIDE, INSIDE, INSIDE, OUTSIDE)))
        assertEquals(EntryKind.CH, votedKind(day(INSIDE, INSIDE, INSIDE, OUTSIDE)))
    }

    @Test
    fun threeAgreeOneInStripIsMedium() {
        assertEquals(Tier.MEDIUM, voteTier(day(INSIDE, INSIDE, INSIDE, BUFFER)))
        assertEquals(EntryKind.CH, votedKind(day(INSIDE, INSIDE, INSIDE, BUFFER)))
    }

    @Test
    fun threeTakenTwoAgreeOneDissentIsMedium() {
        // 3 taken (one missed), 2 agree, 1 dissents -> dominant = taken - 1 = MEDIUM.
        assertEquals(Tier.MEDIUM, voteTier(day(OUTSIDE, OUTSIDE, INSIDE, null)))
        assertEquals(EntryKind.HOME, votedKind(day(OUTSIDE, OUTSIDE, INSIDE, null)))
    }

    // ---- LOW: anything else ----

    @Test
    fun twoAndTwoIsLow() {
        assertEquals(Tier.LOW, voteTier(day(INSIDE, INSIDE, OUTSIDE, OUTSIDE)))
        assertNull(votedKind(day(INSIDE, INSIDE, OUTSIDE, OUTSIDE)))
        assertNull(dayProposal(day(INSIDE, INSIDE, OUTSIDE, OUTSIDE)))
    }

    @Test
    fun twoDissentersIsLow() {
        // 4 taken, 2 inside, 1 outside, 1 strip -> two dissenters -> LOW.
        assertEquals(Tier.LOW, voteTier(day(INSIDE, INSIDE, OUTSIDE, BUFFER)))
    }

    @Test
    fun onlyTwoTakenIsLowEvenWhenTheyAgree() {
        // Fewer than three checks taken can never be HIGH or MEDIUM: one half's two readings do not
        // decide the whole day.
        assertEquals(Tier.LOW, voteTier(day(INSIDE, INSIDE, null, null)))
        assertNull(dayProposal(day(INSIDE, INSIDE, null, null)))
    }

    @Test
    fun oneReadingNeverDecidesADayAlone() {
        assertEquals(Tier.LOW, voteTier(day(INSIDE, null, null, null)))
    }

    @Test
    fun allMissedIsLowWithNoKind() {
        assertEquals(Tier.LOW, voteTier(day(null, null, null, null)))
        assertNull(votedKind(day(null, null, null, null)))
    }

    @Test
    fun threeInStripIsLowNoSide() {
        assertEquals(Tier.LOW, voteTier(day(BUFFER, BUFFER, BUFFER, null)))
        assertNull(votedKind(day(BUFFER, BUFFER, BUFFER, null)))
    }

    // ---- Half-day granularity: each half from its own two checks ----

    @Test
    fun morningBothInsideProposesSwitzerlandAm() {
        assertEquals(Proposal(Tier.HIGH, EntryKind.CH, Portion.AM), morningProposal(day(INSIDE, INSIDE, null, null)))
    }

    @Test
    fun afternoonBothOutsideProposesHomePm() {
        assertEquals(
            Proposal(Tier.HIGH, EntryKind.HOME, Portion.PM),
            afternoonProposal(day(null, null, OUTSIDE, OUTSIDE)),
        )
    }

    @Test
    fun halfWithOneMissedIsNotSure() {
        assertNull(morningProposal(day(INSIDE, null, null, null)))
    }

    @Test
    fun halfWithDisagreeingChecksIsNotSure() {
        assertNull(morningProposal(day(INSIDE, OUTSIDE, null, null)))
    }

    @Test
    fun halfWithAStripCheckIsNotSure() {
        assertNull(morningProposal(day(INSIDE, BUFFER, null, null)))
        assertNull(afternoonProposal(day(null, null, BUFFER, BUFFER)))
    }

    @Test
    fun theTwoHalvesAreIndependent() {
        val checks = day(INSIDE, INSIDE, OUTSIDE, OUTSIDE) // day vote is LOW, but each half is decided
        assertEquals(EntryKind.CH, morningProposal(checks)?.kind)
        assertEquals(EntryKind.HOME, afternoonProposal(checks)?.kind)
    }

    // ---- DayChecks helpers the sampler, near-border and export read ----

    @Test
    fun missedCountAndStripCountAndHasData() {
        val checks = day(INSIDE, BUFFER, null, BUFFER)
        assertEquals(1, checks.missedCount())
        assertEquals(2, checks.stripCount())
        assertTrue(checks.hasData())
        assertEquals(4, day(null, null, null, null).missedCount())
        assertEquals(false, day(null, null, null, null).hasData())
    }
}
