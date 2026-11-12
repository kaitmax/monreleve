package ch.monreleve.app.ios

import ch.monreleve.app.detection.CHECK_WINDOWS
import ch.monreleve.app.detection.DailyNotification
import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.ThresholdAlertDecision
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.ThresholdCrossing

// IOS-2f R892. WHAT iOS SCHEDULES, AND WHEN - the evening reminder and the threshold alert, decided by ANDROID'S OWN
// FUNCTIONS. eveningDecision, isWorkingDay, decideThresholdAlert and composeDaily are the byte-identical iosMain copies
// of :app's detection/EveningNotificationDecision.kt and ThresholdAlertDecision.kt (held equal by IosAndroidTwinsTest),
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

// RED STUB (IOS-2f run 1): plans nothing. Replaced at the R892 code step.

/**
 * The evening reminder for [today] (ISO, Europe/Paris): Android's eveningDecision asked as at the first moment its
 * dayConcluded gate opens, and composed with a threshold already alerted today ([alertedToday], the same-day merge).
 * [dayConcluded] is afterLastCheckWindow now. Null when any rule says no - the host then removes today's request.
 */
@Suppress("UnusedParameter", "FunctionOnlyReturningConstant")
fun planEveningReminder(
    today: String,
    dayConcluded: Boolean,
    state: EveningState,
    outcome: DetectionOutcome,
    alertedToday: AlertThreshold?,
): PlannedNotification? = null

// RED STUB (IOS-2f run 1): never alerts and keeps nothing. Replaced at the R892 code step.

/**
 * One threshold-alert evaluation (Android's maybeAlertThreshold without the posting): decideThresholdAlert, and -
 * when it announces a NEW crossing - one notification NOW, the evening reminder joined if it is due now
 * (alreadyNotified is ignored for the merge, as Android's merge ignores it). [current] is null when there is no
 * projection (no rhythm).
 */
@Suppress("UnusedParameter", "LongParameterList")
fun planThresholdAlert(
    optedIn: Boolean,
    current: ThresholdCrossing?,
    previous: ThresholdCrossing,
    today: String,
    dayConcluded: Boolean,
    evening: EveningState,
    outcome: DetectionOutcome,
): ThresholdAlertPlan = ThresholdAlertPlan(ThresholdAlertDecision(null, previous), null)
