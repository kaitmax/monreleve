package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// IOS-2f R892. ANDROID'S OWN CASES, RUN ON THE SIMULATOR AGAINST detection/EveningNotificationDecision.kt and
// ThresholdAlertDecision.kt - written against iOS copies of :app's files, which IOS-MOVE-TWINS R1240 replaced with ONE
// home in :shared commonMain (PARK-IF4). Every case of :app's EveningNotificationDecisionTest and
// ThresholdAlertDecisionTest, transcribed from Kotest / JUnit into kotlin.test - the values and the expectations
// unchanged, one test per Android test - so the same code is shown to decide the same way when compiled for iOS. A
// transcription, not a home: the code's one home is commonMain, and :app's tests stay its JVM pins.

private val r892ProposedCh = DetectionOutcome.Proposed(Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL))
private val r892ProposedHome = DetectionOutcome.Proposed(Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL))

@Suppress("LongParameterList") // EveningNotificationDecisionTest's helper: named defaults, one per condition
private fun r892Decide(
    optedIn: Boolean = true,
    autoMode: Boolean = true,
    workingDay: Boolean = true,
    hasEntryToday: Boolean = false,
    dayConcluded: Boolean = true,
    alreadyNotified: Boolean = false,
    outcome: DetectionOutcome = r892ProposedCh,
) = eveningDecision(
    EveningConditions(optedIn, autoMode, workingDay, hasEntryToday, dayConcluded, alreadyNotified),
    outcome,
)

class EveningNotificationDecisionTwinIosTest {
    @Test
    fun aConcludedWorkingDayWithAHighProposalAndNoEntryNotifiesTheProposedSide() {
        assertEquals(EveningNotice.Proposed(EntryKind.CH), r892Decide(outcome = r892ProposedCh))
        assertEquals(EveningNotice.Proposed(EntryKind.HOME), r892Decide(outcome = r892ProposedHome))
    }

    @Test
    fun aConcludedWorkingDayThatIsNotSureInvitesManualRecording() =
        assertEquals(EveningNotice.NotSure, r892Decide(outcome = DetectionOutcome.NotSure))

    @Test
    fun optOutNeverNotifies() = assertNull(r892Decide(optedIn = false))

    @Test
    fun manualModeNotifiesWithTheManualQuestion() {
        assertEquals(EveningNotice.Manual, r892Decide(autoMode = false))
        assertEquals(EveningNotice.Manual, r892Decide(autoMode = false, outcome = DetectionOutcome.NotSure))
    }

    @Test
    fun neverOnANonWorkingDay() = assertNull(r892Decide(workingDay = false))

    @Test
    fun onlyIfTheDayHasNoEntryYet() = assertNull(r892Decide(hasEntryToday = true))

    @Test
    fun onlyAfterTheDayConcludes() = assertNull(r892Decide(dayConcluded = false))

    @Test
    fun atMostOnePerWorkingDay() = assertNull(r892Decide(alreadyNotified = true))

    @Test
    fun isWorkingDayIsMondayToFriday() {
        (1..5).forEach { assertEquals(true, isWorkingDay(it), "day $it") }
        assertEquals(false, isWorkingDay(6))
        assertEquals(false, isWorkingDay(7))
    }
}

class ThresholdAlertDecisionTwinIosTest {
    private val none = ThresholdCrossing(fiscal = false, social = false)
    private val fiscalOnly = ThresholdCrossing(fiscal = true, social = false)
    private val both = ThresholdCrossing(fiscal = true, social = true)

    @Test
    fun theFirstCrossingOfTheFiscalThresholdNotifies() {
        val decision = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = none)
        assertEquals(AlertThreshold.FISCAL, decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun stayingCrossedDoesNotNotifyAgain() {
        val decision = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = fiscalOnly)
        assertNull(decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun fallingBackUnderThenReCrossingNotifiesAgain() {
        val back = decideThresholdAlert(optedIn = true, current = none, previous = fiscalOnly)
        assertNull(back.alert)
        assertEquals(none, back.newState)
        val again = decideThresholdAlert(optedIn = true, current = fiscalOnly, previous = back.newState)
        assertEquals(AlertThreshold.FISCAL, again.alert)
    }

    @Test
    fun crossingTheSocialThresholdNotifiesForSocial() =
        assertEquals(
            AlertThreshold.SOCIAL,
            decideThresholdAlert(optedIn = true, current = both, previous = fiscalOnly).alert,
        )

    @Test
    fun bothThresholdsCrossingAtOnceAnnounceTheGraverSocialThreshold() {
        val decision = decideThresholdAlert(optedIn = true, current = both, previous = none)
        assertEquals(AlertThreshold.SOCIAL, decision.alert)
        assertEquals(both, decision.newState)
    }

    @Test
    fun optedOutSendsNothingAndLeavesTheStateUntouched() {
        val decision = decideThresholdAlert(optedIn = false, current = both, previous = fiscalOnly)
        assertNull(decision.alert)
        assertEquals(fiscalOnly, decision.newState)
    }

    @Test
    fun noRhythmMeansNoProjectionAndNoAlert() {
        val decision = decideThresholdAlert(optedIn = true, current = null, previous = none)
        assertNull(decision.alert)
        assertEquals(none, decision.newState)
    }

    @Test
    fun theSameDayMergeKeepsTheEveningReminderAndJoinsTheAlert() =
        assertEquals(
            DailyNotification.Merged(EveningNotice.Manual, AlertThreshold.FISCAL),
            composeDaily(EveningNotice.Manual, AlertThreshold.FISCAL),
        )

    @Test
    fun theAlertAlonePostsWhenNoEveningReminderIsDue() =
        assertEquals(DailyNotification.Alert(AlertThreshold.SOCIAL), composeDaily(null, AlertThreshold.SOCIAL))

    @Test
    fun theEveningReminderAlonePostsWhenNoThresholdCrossed() =
        assertEquals(DailyNotification.Evening(EveningNotice.Manual), composeDaily(EveningNotice.Manual, null))

    @Test
    fun neitherDuePostsNothing() = assertEquals(DailyNotification.None, composeDaily(null, null))
}
