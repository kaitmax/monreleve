package ch.monreleve.app.ios

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.detection.CHECK_WINDOWS
import ch.monreleve.app.detection.DailyNotification
import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.Proposal
import ch.monreleve.app.detection.Tier
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// IOS-2f R892. WHAT iOS SCHEDULES AND WHEN, from values: the evening reminder at the minute Android's dayConcluded gate
// opens (or at once past it), saying what Android's eveningDecision says; the threshold alert at once, with Android's
// decideThresholdAlert and the same-day merge. 2026-11-12 is a Thursday and 2026-11-14 a Saturday.

private const val R892_THURSDAY = "2026-11-12"
private const val R892_SATURDAY = "2026-11-14"
private val r892PlanProposedHome = DetectionOutcome.Proposed(Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL))
private val r892Manual = EveningState(optedIn = true, autoMode = false, hasEntryToday = false, alreadyNotified = false)
private val r892Auto = r892Manual.copy(autoMode = true)
private val r892None = ThresholdCrossing()
private val r892Fiscal = ThresholdCrossing(fiscal = true)
private val r892Both = ThresholdCrossing(fiscal = true, social = true)

class IosNotificationPlanIosTest {
    private fun evening(
        today: String = R892_THURSDAY,
        dayConcluded: Boolean = false,
        state: EveningState = r892Manual,
        outcome: DetectionOutcome = DetectionOutcome.NotSure,
        alertedToday: AlertThreshold? = null,
    ) = planEveningReminder(today, dayConcluded, state, outcome, alertedToday)

    @Test
    fun theConclusionMinuteIsTheEndOfTheLastCheckWindow() {
        assertEquals(CHECK_WINDOWS.last().endMinuteOfDay, DAY_CONCLUSION_MINUTE)
        assertEquals(CHECK_WINDOWS.maxOf { it.endMinuteOfDay }, DAY_CONCLUSION_MINUTE, "no window ends later")
    }

    @Test
    fun beforeTheDayConcludesTheReminderIsScheduledForTheConclusionMinuteInParis() =
        assertEquals(
            PlannedNotification(
                DailyNotification.Evening(EveningNotice.Manual),
                NotificationTime.ParisWallClock(R892_THURSDAY, DAY_CONCLUSION_MINUTE),
            ),
            evening(dayConcluded = false),
        )

    @Test
    fun onceTheDayHasConcludedTheReminderIsDueAtOnce() =
        assertEquals(
            PlannedNotification(DailyNotification.Evening(EveningNotice.Manual), NotificationTime.Now),
            evening(dayConcluded = true),
        )

    @Test
    fun whatItSaysIsEveningDecisionsAnswerByMode() {
        assertEquals(
            DailyNotification.Evening(EveningNotice.Proposed(EntryKind.HOME)),
            evening(state = r892Auto, outcome = r892PlanProposedHome)?.notification,
        )
        assertEquals(
            DailyNotification.Evening(EveningNotice.NotSure),
            evening(state = r892Auto, outcome = DetectionOutcome.NotSure)?.notification,
        )
        assertEquals(
            DailyNotification.Evening(EveningNotice.Manual),
            evening(state = r892Manual, outcome = r892PlanProposedHome)?.notification,
        )
    }

    @Test
    fun nothingIsScheduledWhenAnyOfAndroidsRulesSaysNo() {
        assertNull(evening(today = R892_SATURDAY), "never on a non-working day")
        assertNull(evening(state = r892Manual.copy(optedIn = false)), "opted out")
        assertNull(evening(state = r892Manual.copy(hasEntryToday = true)), "the day is already recorded")
        assertNull(evening(state = r892Manual.copy(alreadyNotified = true)), "at most one per working day")
    }

    @Test
    fun aThresholdAlreadyAlertedTodayJoinsTheReminder() =
        assertEquals(
            DailyNotification.Merged(EveningNotice.Manual, AlertThreshold.FISCAL),
            evening(alertedToday = AlertThreshold.FISCAL)?.notification,
        )

    // planThresholdAlert with the evening state and outcome every alert case shares unless it says otherwise.
    @Suppress("LongParameterList")
    private fun alert(
        optedIn: Boolean,
        current: ThresholdCrossing?,
        previous: ThresholdCrossing,
        today: String = R892_THURSDAY,
        dayConcluded: Boolean = false,
        evening: EveningState = r892Manual,
    ) = planThresholdAlert(optedIn, current, previous, today, dayConcluded, evening, DetectionOutcome.NotSure)

    private fun now(notification: DailyNotification) = PlannedNotification(notification, NotificationTime.Now)

    @Test
    fun aFirstCrossingBeforeTheDayConcludesIsTheAlertAloneAtOnce() {
        val plan = alert(optedIn = true, current = r892Fiscal, previous = r892None)
        assertEquals(now(DailyNotification.Alert(AlertThreshold.FISCAL)), plan.planned)
        assertEquals(r892Fiscal, plan.decision.newState, "the state the caller keeps")
    }

    @Test
    fun aFirstCrossingOnceTheReminderIsDueIsMergedEvenIfTheReminderAlreadyFired() {
        val fired = r892Manual.copy(alreadyNotified = true) // Android's merge asks with alreadyNotified = false
        val plan = alert(true, current = r892Fiscal, previous = r892None, dayConcluded = true, evening = fired)
        assertEquals(now(DailyNotification.Merged(EveningNotice.Manual, AlertThreshold.FISCAL)), plan.planned)
    }

    @Test
    fun bothAtOnceAnnounceSocial() {
        val plan = alert(true, current = r892Both, previous = r892None, today = R892_SATURDAY, dayConcluded = true)
        assertEquals(now(DailyNotification.Alert(AlertThreshold.SOCIAL)), plan.planned)
        assertEquals(r892Both, plan.decision.newState)
    }

    @Test
    fun stayingCrossedOptedOutOrNoProjectionPlansNothing() {
        val stays = alert(optedIn = true, current = r892Fiscal, previous = r892Fiscal)
        assertNull(stays.planned)
        assertEquals(r892Fiscal, stays.decision.newState)
        val optedOut = alert(optedIn = false, current = r892Both, previous = r892Fiscal)
        assertNull(optedOut.planned)
        assertEquals(r892Fiscal, optedOut.decision.newState, "opted out: the state is left untouched")
        val noRhythm = alert(optedIn = true, current = null, previous = r892None)
        assertNull(noRhythm.planned)
        assertEquals(r892None, noRhythm.decision.newState)
    }
}
