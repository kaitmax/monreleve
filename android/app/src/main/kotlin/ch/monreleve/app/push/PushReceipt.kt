package ch.monreleve.app.push

import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.eveningDecision
import ch.monreleve.app.settings.EveningNotificationStore

// AN-FCM-CLIENT (R1152, Android Rulings 7 and 8). RECEIPT: WHAT A PUSHED REMINDER SHOWS - AT MOST THE ONE EVENING
// NOTIFICATION THE APP ALREADY HAS (R339), AND NEVER A SECOND ONE THE SAME DAY.
//
// THE SERVER DECIDES THAT IT IS TIME; THE PHONE DECIDES WHETHER ANYTHING IS SHOWN. The message is data-only
// (web/lib/push/fcm.ts, this task) so it always reaches MonRelevePushService instead of being drawn by the system
// tray. Its payload is web/lib/push/message.ts's: { kind: "daily_reminder", day: <ISO day>, mode }. The phone then
// applies R339's own gates - the same decision SamplingWorker's evening notice uses (eveningDecision) - with ONE
// substitution: R339's "the day has concluded / the reminder time has come" is the push itself, because the server
// sends at the person's reminderTime (default 17:30 Europe/Paris, SPEC 13.3, Android Ruling 7). Everything else is
// unchanged: opted in on this phone, a working day, no entry for today on this phone, not already shown today. The
// MODE and the WORDS are the phone's (R339's NotificationCopy), never the server's - the payload's `mode` is not
// read, so the server's sentence cannot contradict the phone's proposal.
//
// THREE MORE REFUSALS, EACH SPECIFIC TO A PUSH:
//   - not a daily_reminder, or a day that is not an ISO day: shows nothing (an unknown kind from a newer server is
//     not this build's to guess at);
//   - a day that is not TODAY in Paris: shows nothing (a reminder delivered late, after midnight, would ask about
//     the wrong day - the server will send the right one);
//   - nobody signed in (Android Ruling 8's SIGNED-OUT row): shows nothing.
//
// EXACTLY ONE PER DAY (Android Ruling 7) is [showOncePerDay]: the push and SamplingWorker's evening notice both go
// through it, against the one EveningNotificationStore "last notified" day, so whichever comes first is shown and the
// other finds the day taken. A7's 19:00 fallback joins it the same way.

internal const val PUSH_KIND_KEY = "kind"
internal const val PUSH_DAY_KEY = "day"

/** web/lib/push/message.ts REMINDER_PUSH_KIND - the stable code the client branches on. */
internal const val DAILY_REMINDER_KIND = "daily_reminder"

/** The day a pushed daily reminder is about, or null when the payload is not one (R1152). */
internal fun reminderDayOf(data: Map<String, String>): String? =
    data[PUSH_DAY_KEY]?.takeIf { data[PUSH_KIND_KEY] == DAILY_REMINDER_KIND && ISO_DAY.matches(it) }

private val ISO_DAY = Regex("""\d{4}-\d{2}-\d{2}""")

/**
 * R1152: the notification a pushed reminder for [reminderDay] shows, or null. R339's decision with the push as the
 * reminder time, refused when nobody is signed in or the day is not [today].
 */
internal fun pushReminderDecision(
    reminderDay: String?,
    signedIn: Boolean,
    today: String,
    conditions: EveningConditions,
    outcome: DetectionOutcome,
): EveningNotice? {
    if (reminderDay == null || !signedIn || reminderDay != today) return null
    // The push IS the reminder time: R339's dayConcluded gate is answered by the server's send, nothing else is.
    return eveningDecision(conditions.copy(dayConcluded = true), outcome)
}

/**
 * Android Ruling 7 - EXACTLY ONE A DAY, for every path that posts the evening notification. [decide] is told whether
 * today is already taken and answers what to show (or null); a shown notice is [post]ed and the day is marked, so
 * the next path - whichever it is - finds it taken.
 */
internal suspend fun showOncePerDay(
    today: String,
    store: EveningNotificationStore,
    decide: suspend (alreadyNotified: Boolean) -> EveningNotice?,
    post: (EveningNotice) -> Unit,
): EveningNotice? {
    val notice = decide(store.lastNotifiedDay() == today) ?: return null
    post(notice)
    store.markNotified(today)
    return notice
}
