package ch.monreleve.app.ios

import ch.monreleve.app.detection.CHECK_WINDOWS
import ch.monreleve.app.detection.DailyNotification
import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.ThresholdAlertDecision
import ch.monreleve.app.detection.composeDaily
import ch.monreleve.app.detection.decideThresholdAlert
import ch.monreleve.app.detection.eveningDecision
import ch.monreleve.app.detection.isWorkingDay
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber

// IOS-2f R892. WHAT iOS SCHEDULES, AND WHEN - the evening reminder and the threshold alert, decided by ANDROID'S OWN
// FUNCTIONS. eveningDecision, isWorkingDay, decideThresholdAlert and composeDaily live ONCE, in :shared commonMain's
// detection/EveningNotificationDecision.kt and ThresholdAlertDecision.kt (IOS-MOVE-TWINS R1240, closing PARK-IF4),
// so WHAT is said is decided by the same lines of code on both platforms. This file adds only the WHEN, because the two
// platforms deliver differently:
//
//   ANDROID asks on every background wake (SamplingWorker, ~15 minutes) and posts at once when the rule permits:
//   maybeNotifyEvening gates on dayConcluded = afterLastCheckWindow(clock); maybeAlertThreshold has no time gate.
//   iOS SCHEDULES AHEAD (UNUserNotificationCenter: a request fires while the app is not running), so the same rule is
//   asked for the moment it first permits: the evening reminder at the Paris wall-clock minute at which
//   afterLastCheckWindow turns true - CHECK_WINDOWS.last().endMinuteOfDay, derived, never typed - or at once if that
//   minute has passed; the threshold alert at once, joined to the evening reminder when that is due now (composeDaily,
//   never two Mon Releve notifications a day). The answer is a wall-clock minute in Europe/Paris because that is what
//   UNCalendarNotificationTrigger takes (with the zone in its date components), so DST is the operating system's.
//
// PURE: values in, a value out. No clock is read and no kotlin.time type appears (the :app ExperimentalTime allowlist
// scans iosMain and cannot be edited here): the caller passes today's Paris day and whether the day has concluded,
// computed with the shared parisDay / afterLastCheckWindow. Nothing here posts, records a day (D16) or reads a
// coordinate (D18).
//
// NOT DECIDED HERE (R839 does not settle them; PARKED to IOS-1b-B, R893): how far ahead to schedule (this plans today
// only); that recording a day removes the pending request (Android cancels its notification on record); how "already
// notified" is learnt for a request that fired while the app was not running (Android marks it when it posts); and the
// store writes around these calls (Android's order: the crossing saved whether or not it fires, markAlerted after an
// alert, markNotified after an evening post or a merged one).

/** When a planned notification is delivered. */
sealed interface NotificationTime {
    /** As soon as it is scheduled (a nil / immediate trigger). */
    data object Now : NotificationTime

    /** At [minuteOfDay] (minutes after midnight) on the ISO [day], Europe/Paris wall clock. */
    data class ParisWallClock(
        val day: String,
        val minuteOfDay: Int,
    ) : NotificationTime
}

/** One Mon Releve notification to schedule: what (Android's composition) and when. */
data class PlannedNotification(
    val notification: DailyNotification,
    val time: NotificationTime,
)

/** The evening reminder's inputs that are state, not time: EveningConditions less workingDay and dayConcluded. */
data class EveningState(
    val optedIn: Boolean,
    val autoMode: Boolean,
    val hasEntryToday: Boolean,
    val alreadyNotified: Boolean,
)

/** The threshold alert's evaluation: the decision (whose newState the caller persists) and what to post now. */
data class ThresholdAlertPlan(
    val decision: ThresholdAlertDecision,
    val planned: PlannedNotification?,
)

/** The Paris minute-of-day at which a day concludes: the end of the last check window (afterLastCheckWindow's line). */
val DAY_CONCLUSION_MINUTE: Int get() = CHECK_WINDOWS.last().endMinuteOfDay

/**
 * The evening reminder for [today] (ISO, Europe/Paris): Android's eveningDecision asked as at the first moment its
 * dayConcluded gate opens, and composed with a threshold already alerted today ([alertedToday], the same-day merge).
 * [dayConcluded] is afterLastCheckWindow now. Null when any rule says no - the host then removes today's request.
 */
fun planEveningReminder(
    today: String,
    dayConcluded: Boolean,
    state: EveningState,
    outcome: DetectionOutcome,
    alertedToday: AlertThreshold?,
): PlannedNotification? {
    val notice =
        eveningDecision(
            EveningConditions(
                optedIn = state.optedIn,
                autoMode = state.autoMode,
                workingDay = isWorkingDay(isoDayOfWeek(today)),
                hasEntryToday = state.hasEntryToday,
                // Asked as at the delivery time, which is never before DAY_CONCLUSION_MINUTE - the minute from which
                // afterLastCheckWindow is true by its own definition. So the gate is open THEN, whatever it is now.
                dayConcluded = true,
                alreadyNotified = state.alreadyNotified,
            ),
            outcome,
        ) ?: return null
    val time = if (dayConcluded) NotificationTime.Now else NotificationTime.ParisWallClock(today, DAY_CONCLUSION_MINUTE)
    return PlannedNotification(composeDaily(notice, alertedToday), time)
}

/**
 * One threshold-alert evaluation (Android's maybeAlertThreshold without the posting): decideThresholdAlert, and -
 * when it announces a NEW crossing - one notification NOW, the evening reminder joined if it is due now
 * (alreadyNotified is ignored for the merge, as Android's merge ignores it). [current] is null when there is no
 * projection (no rhythm). The seven parameters are Android's inputs to the same two calls - the alert's three and the
 * reminder's four - not loose data.
 */
@Suppress("LongParameterList")
fun planThresholdAlert(
    optedIn: Boolean,
    current: ThresholdCrossing?,
    previous: ThresholdCrossing,
    today: String,
    dayConcluded: Boolean,
    evening: EveningState,
    outcome: DetectionOutcome,
): ThresholdAlertPlan {
    val decision = decideThresholdAlert(optedIn, current, previous)
    val threshold = decision.alert ?: return ThresholdAlertPlan(decision, null)
    // Android's merge (maybeAlertThreshold -> gatherEveningConditions(alreadyNotified = false)): the reminder as it
    // stands NOW, so a reminder already shown is replaced by the merged one with its record buttons kept.
    val eveningNow =
        eveningDecision(
            EveningConditions(
                optedIn = evening.optedIn,
                autoMode = evening.autoMode,
                workingDay = isWorkingDay(isoDayOfWeek(today)),
                hasEntryToday = evening.hasEntryToday,
                dayConcluded = dayConcluded,
                alreadyNotified = false,
            ),
            outcome,
        )
    return ThresholdAlertPlan(decision, PlannedNotification(composeDaily(eveningNow, threshold), NotificationTime.Now))
}

/** The ISO day-of-week (1 = Monday .. 7 = Sunday) of an ISO day - the Int Android's isWorkingDay takes. */
private fun isoDayOfWeek(isoDay: String): Int = LocalDate.parse(isoDay).dayOfWeek.isoDayNumber
