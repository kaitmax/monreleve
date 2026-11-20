package ch.monreleve.app.reminder

import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.eveningDecision
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import kotlin.coroutines.cancellation.CancellationException

// AN-MANUAL-REMINDER (R1140-R1142, Android Rulings 3, 7 and 8; PARKAN-45). THE 19:00 FALLBACK, PURE.
//
// WHAT IT IS. On a phone where push is NOT available (PushAvailability.isPushAvailable, A8 R1153), the app reminds the
// person itself, at 19:00 DEVICE-LOCAL time, in MANUAL mode, with the EXISTING evening notification (R339's
// EveningNotice.Manual - its content, buttons, lock-screen version and receiver are AN-NOTIF's, unchanged). It is the
// FALLBACK for the server's push (SPEC 13.3, 17:30 Europe/Paris by default), never a second reminder: Android Ruling 7.
//
// EXACTLY ONE A DAY. It goes through push/PushReceipt.kt showOncePerDay, the one rule the push (P1) and
// SamplingWorker's evening notice (P2) already share, against the one EveningNotificationStore day - no second gate.
//
// IT SHOWS NOTHING when: nobody is signed in (Android Ruling 8); push is available (the server reminds instead); the
// mode is automatic (the auto-mode evening notice is SamplingWorker's, Android Ruling 11 Q3); the notifications are
// not permitted (R1142: the same POST_NOTIFICATIONS gate R339's notifier applies - checked BEFORE the day is taken,
// so a reminder that could not be drawn never silences a later path); 19:00 has not come; and every one of R339's own
// gates - opted in on this phone, a working day, no entry for today, not already shown today.
//
// 19:00 IS A TARGET, NOT A GUARANTEE. The wake is deferrable (FallbackReminderRuntime.kt says by what, and how much),
// so the time gate is "at or after 19:00 on the local day", never equality: a late wake still reminds the same evening,
// and a wake deferred past local midnight reads a local time before 19:00 and shows nothing.

/** Android Ruling 3: the fallback's time, device-local. Fixed at launch - SPEC 13.3's reminderTime is the push's. */
internal val FALLBACK_REMINDER_TIME: LocalTime = LocalTime.of(19, 0)

/** R1140: the next 19:00 in [zone] strictly after [now] - today's while it is still ahead, otherwise tomorrow's. */
internal fun nextFallbackAt(
    now: Instant,
    zone: ZoneId,
): Instant {
    val day = now.atZone(zone).toLocalDate()
    val today = day.atTime(FALLBACK_REMINDER_TIME).atZone(zone).toInstant()
    return if (today.isAfter(now)) today else day.plusDays(1).atTime(FALLBACK_REMINDER_TIME).atZone(zone).toInstant()
}

/**
 * R1140: the link to plan AFTER A REBOOT. A reboot can change the zone before any app hears TIMEZONE_CHANGED (the
 * emulator came back from a cold boot in another zone, still aiming at the old 19:00), and a phone switched off at
 * 19:00 has missed that evening. So a boot re-plans from the zone in force, and if 19:00 has already come on this
 * local day it plans NOW - the wake then decides, under the one-a-day rule, and plans tomorrow.
 */
internal fun bootFallbackAt(
    now: Instant,
    zone: ZoneId,
): Instant = if (reachedFallbackTime(now, zone)) now else nextFallbackAt(now, zone)

/** R1140: whether [now] is at or after 19:00 on its local day in [zone] (a late wake counts; midnight resets). */
internal fun reachedFallbackTime(
    now: Instant,
    zone: ZoneId,
): Boolean = !now.atZone(zone).toLocalTime().isBefore(FALLBACK_REMINDER_TIME)

/**
 * R1141: the notice the fallback shows, or null. R339's decision ([conditions], gathered as SamplingWorker's are), with
 * the fallback's own refusals in front and R339's "day concluded" answered by [reachedReminderTime].
 */
@Suppress("LongParameterList")
internal fun fallbackReminderDecision(
    signedIn: Boolean,
    pushAvailable: Boolean,
    notificationsPermitted: Boolean,
    reachedReminderTime: Boolean,
    conditions: EveningConditions,
): EveningNotice? {
    // The fallback's own refusals, each one fact (a list, so no condition is complex - detekt ComplexCondition).
    val refusals = listOf(!signedIn, pushAvailable, conditions.autoMode, !notificationsPermitted)
    if (refusals.any { it }) return null
    // R339's decision, the reminder time answering "the day has concluded". Manual mode: it can only ask (Manual).
    return eveningDecision(conditions.copy(dayConcluded = reachedReminderTime), DetectionOutcome.NotSure)
}

/** R1141: what one wake of the fallback did - logged by name (never a token, an account or a day). */
internal enum class FallbackWake {
    /** Nobody is signed in: the schedule cancelled itself and nothing was planned (Android Ruling 8). */
    SIGNED_OUT_CANCELLED,

    /** The one evening notification was posted, and today is taken. */
    SHOWN,

    /** A rule said no; the next 19:00 is planned. */
    NOTHING_SHOWN,

    /** The reminder failed (a database that would not open); nothing was shown, and the next 19:00 is planned. */
    REMIND_FAILED,
}

// TooGenericExceptionCaught / SwallowedException: deliberate - whatever the evening's failure, the wake must return
// so the chain survives; the outcome REMIND_FAILED is what the worker logs.

/**
 * R1141: ONE WAKE, over seams (the JVM test drives it as the worker does). Signed out: cancel the schedule and plan
 * nothing. Otherwise remind (the decision and showOncePerDay) and plan the next 19:00 whatever the reminder did -
 * and RETURN, never rethrow (REMIND_FAILED), so WorkManager never fails the next link with this one.
 */
@Suppress("TooGenericExceptionCaught", "SwallowedException")
internal suspend fun fallbackWake(
    signedIn: () -> Boolean,
    cancelOwnSchedule: () -> Unit,
    remind: suspend () -> EveningNotice?,
    planNext: () -> Unit,
): FallbackWake {
    if (!signedIn()) {
        cancelOwnSchedule()
        return FallbackWake.SIGNED_OUT_CANCELLED
    }
    // The next 19:00 is planned whatever this evening did, and the wake RETURNS: a worker that throws is FAILED, and
    // WorkManager fails the link just APPENDed with it - one bad evening must not end the schedule. Cancellation is
    // the one exception let through (the coroutine is being stopped, not failing).
    val outcome =
        try {
            if (remind() != null) FallbackWake.SHOWN else FallbackWake.NOTHING_SHOWN
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            FallbackWake.REMIND_FAILED
        }
    planNext()
    return outcome
}

/**
 * R1147: the evening opt-in this phone takes from the server at RESOLVING - on only when the server holds it on AND
 * this phone may post notifications (A9's LoggingModeRestore precedent: a server value is applied only where the
 * permission it needs is held, and nothing is sent).
 */
internal fun restoredEveningOptIn(
    serverOn: Boolean,
    notificationsPermitted: Boolean,
): Boolean = serverOn && notificationsPermitted
