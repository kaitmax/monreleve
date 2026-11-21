package ch.monreleve.app.reminder

import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.isWorkingDay
import ch.monreleve.app.dossier.parisDayOf
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-MOVE-REMINDER (R1291, iOS Rulings 2 and 3). THE LOCAL EVENING REMINDER, PLANNED AHEAD - what iOS schedules.
//
// iOS v1 has no push and is manual-only (iOS Ruling 2), and an iOS app is not woken at 19:00 to decide: it SCHEDULES
// notification requests ahead, which the system delivers while the app is not running. So the 19:00 fallback's
// decision (FallbackReminder.kt) is asked AHEAD, once for each of the next EVENING_REMINDER_HORIZON 19:00s, as at that
// 19:00 - the same function Android's wake asks at the moment itself, with the facts Android's wake would read:
//   - the time: nextFallbackAt, chained, so each candidate is a 19:00 DEVICE-LOCAL, strictly after now (today's only
//     while it is still ahead), and each is computed in the zone's own rules - a DST night keeps 19:00 local;
//   - THE DAY IT ASKS ABOUT is the Paris day at that 19:00 (parisDayOf), exactly as Android's wake names "today"
//     (todayInParis, R28) and reads its working day and its entry from it. In Switzerland and France that is the
//     device's own date; it differs only on a phone set to a far zone, and then iOS does what Android does;
//   - the working day is the app's ONE definition (detection/isWorkingDay, R206), taken as a parameter so a test can
//     put a non-working day anywhere;
//   - recorded on the phone = any entry on that day (EveningNotifier's hasEntryToday); already notified = the day's
//     reminder is in the DELIVERED list (iOS Ruling 2: read from the delivered notifications, so a zone change that
//     brings 19:00 round again does not ask twice);
//   - no push (pushAvailable = false) and manual mode (autoMode = false): iOS v1, by ruling, not by input.
// Signed out, opted out or not permitted, the decision says no for every day, so nothing is planned.
//
// THE WINDOW. Beside the requests to hold, the plan names the days of its window - its candidates' days, and one either
// side, for a zone change that moves a Paris day across - that hold NONE. iOS removes those days' requests and adds
// the planned ones: the two sets are disjoint, so the result does not depend on the order in which the notification
// centre applies the removal and the additions (removal is asynchronous; IOS-MOVE-SEAM NOTICED). The sign-out rule is
// separate and wider: iosSessionEndSeam removes ALL pending requests (iOS Ruling 9 Q3), and this does not narrow it.
//
// STATED LIMIT (iOS Ruling 2): a day recorded on ANOTHER device cannot cancel a request already scheduled here; the
// reminder's copy asks, it never asserts the day is missing (R339). PURE: values in, a value out; nothing here reads a
// clock, schedules, records a day (D16) or touches a coordinate (D18).

/** iOS Ruling 2 (C8 Q1): the reminder is planned over the next SEVEN 19:00s - at most 7 days ahead, 7 requests. */
const val EVENING_REMINDER_HORIZON: Int = 7

/** The facts the plan reads that are state, not time (R1291). */
data class EveningReminderState(
    val signedIn: Boolean,
    /** The evening reminder's opt-in on this phone (separate from detection, off by default - R339). */
    val optedIn: Boolean,
    /** Whether the system lets this app notify (Android's R1142 gate; iOS: the notification authorization). */
    val notificationsPermitted: Boolean,
    /** The days with an entry on this phone - any portion, as Android's hasEntryToday reads it. */
    val recordedDays: Set<LocalDate>,
    /** The days whose reminder was already delivered (iOS: the delivered-notifications list). */
    val notifiedDays: Set<LocalDate>,
)

/** One request to hold: [at] is the device-local wall clock it fires at (19:00), [day] the day it asks about. */
data class PlannedEveningReminder(
    val at: LocalDateTime,
    val day: LocalDate,
)

/** The plan: the requests to hold, and the days of its window that hold none (their requests are removed). */
data class EveningReminderPlan(
    val reminders: List<PlannedEveningReminder>,
    val unplannedDays: List<LocalDate>,
)

/**
 * R1291: the evening reminders to hold from [now] in [zone] - one per day of the next [EVENING_REMINDER_HORIZON]
 * 19:00s for which the fallback's decision ([fallbackReminderDecision]) says yes, as asked at that 19:00.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1291: kotlin.time.Instant - on the allowlist.
fun eveningReminderPlan(
    now: Instant,
    zone: TimeZone,
    state: EveningReminderState,
    workingDay: (LocalDate) -> Boolean = { isWorkingDay(it.dayOfWeek.isoDayNumber) },
): EveningReminderPlan {
    val candidates =
        generateSequence(nextFallbackAt(now, zone)) { nextFallbackAt(it, zone) }
            .take(EVENING_REMINDER_HORIZON)
            .toList()
    val reminders =
        candidates.mapNotNull { fire ->
            val day = parisDayOf(fire)
            val conditions =
                EveningConditions(
                    optedIn = state.optedIn,
                    autoMode = false,
                    workingDay = workingDay(day),
                    hasEntryToday = day in state.recordedDays,
                    // Never what the fallback reads: its own time gate answers "day concluded" - true at a 19:00.
                    dayConcluded = false,
                    alreadyNotified = day in state.notifiedDays,
                )
            val notice =
                fallbackReminderDecision(
                    signedIn = state.signedIn,
                    pushAvailable = false,
                    notificationsPermitted = state.notificationsPermitted,
                    reachedReminderTime = true,
                    conditions = conditions,
                )
            notice?.let { PlannedEveningReminder(fire.toLocalDateTime(zone), day) }
        }
    val days = candidates.map { parisDayOf(it) }
    val planned = reminders.map { it.day }.toSet()
    val last = days.last().plus(1, DateTimeUnit.DAY)
    val window = generateSequence(days.first().minus(1, DateTimeUnit.DAY)) { it.plus(1, DateTimeUnit.DAY) }
    val unplanned = window.takeWhile { it <= last }.filterNot { it in planned }.toList()
    return EveningReminderPlan(reminders, unplanned)
}
