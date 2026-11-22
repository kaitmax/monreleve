package ch.monreleve.app.ios

import ch.monreleve.app.fr.NotificationCopy
import ch.monreleve.app.fr.text.formatDayLong
import ch.monreleve.app.reminder.EveningReminderPlan
import ch.monreleve.app.reminder.PlannedEveningReminder
import kotlinx.datetime.LocalDate
import kotlinx.datetime.number
import platform.Foundation.NSDateComponents
import platform.UserNotifications.UNCalendarNotificationTrigger
import platform.UserNotifications.UNMutableNotificationContent
import platform.UserNotifications.UNNotificationRequest
import platform.UserNotifications.UNUserNotificationCenter

// IOS-MOVE-REMINDER (R1291, R1292; iOS Rulings 2, 3 and 9). THE iOS EVENING REMINDER'S GLUE: the common plan
// (reminder/EveningReminderPlan.kt) turned into this app's notification requests, and the re-plan. It SUPERSEDES
// IOS-2f's IosNotificationPlan (today only, 17:00 Paris - iOS Ruling 3 Q6), which this task deleted.
//
// ONE REQUEST PER PLANNED DAY. Its identifier is EVENING_REMINDER_ID_PREFIX + the ISO day it asks about, so a re-plan
// REPLACES a day's request rather than adding a second (a request added with a pending request's identifier replaces
// it - Apple's documented behaviour, argued here; I2 measures it) and the delivered list says which days were already
// reminded (eveningReminderDayOf - iOS Ruling 2: "already notified" is read from the delivered notifications). Its
// trigger is a CALENDAR trigger on the planned wall clock - year, month, day, 19, 00, no time zone, not repeating - so
// it fires at 19:00 in whatever zone the device is in that evening (device-local, iOS Ruling 2); DST is the system's.
// Its content is the Android manual reminder's, from the same homes (R206): the title NotificationCopy.MANUAL_TITLE
// and the body formatDayLong(day), as EveningNotifier writes them for EveningNotice.Manual. iOS v1 shows no record
// buttons (iOS Ruling 3 Q4): a tap opens the app, which the shell (move 5) routes to Aujourd'hui.
//
// THE RE-PLAN removes the requests of the plan's unplanned days and adds the planned ones. The two sets are disjoint,
// so the outcome does not depend on the order the centre applies them in (both calls return at once and complete
// asynchronously). It never removes ALL pending requests: that is the sign-out rule (iosSessionEndSeam, iOS Ruling 9
// Q3), which stays as wide as it is. WHEN to re-plan is the shell's (move 5, R1292): every foreground, every day
// recorded on the phone, the opt-in changed, a sign-in - each with eveningReminderPlan over the facts at that moment.
//
// THE CENTRE IS A SEAM, resolved inside each call, never when the glue is built: UNUserNotificationCenter raises an
// Objective-C exception in a process with no app bundle (the simulator test binary - AppHostProbeIosTest's header,
// IosSessionEndSeam.kt), so IosEveningRemindersIosTest drives this glue over a recording centre. Nothing here reads a
// clock, records a day (D16) or touches a coordinate (D18).

/** This app's evening-reminder request identifiers: this prefix, then the ISO day the reminder asks about. */
const val EVENING_REMINDER_ID_PREFIX: String = "ch.monreleve.app.reminder.evening."

/** The two calls the re-plan makes on the notification centre. */
interface EveningReminderCenter {
    /** Removes the PENDING requests with these identifiers (delivered ones are left to the person). */
    fun removePending(identifiers: List<String>)

    /** Adds [request]; a pending request with the same identifier is replaced. */
    fun add(request: UNNotificationRequest)
}

/** The device's notification centre - resolved inside each call (see the header). */
class SystemEveningReminderCenter : EveningReminderCenter {
    override fun removePending(identifiers: List<String>) {
        val centre = UNUserNotificationCenter.currentNotificationCenter()
        centre.removePendingNotificationRequestsWithIdentifiers(identifiers)
    }

    override fun add(request: UNNotificationRequest) {
        val centre = UNUserNotificationCenter.currentNotificationCenter()
        centre.addNotificationRequest(request, withCompletionHandler = null)
    }
}

/** The request identifier for the reminder about [day]. */
fun eveningReminderIdentifier(day: LocalDate): String = EVENING_REMINDER_ID_PREFIX + day.toString()

/** The day an identifier of ours asks about, or null for any other identifier (another request, a malformed one). */
fun eveningReminderDayOf(identifier: String): LocalDate? {
    if (!identifier.startsWith(EVENING_REMINDER_ID_PREFIX)) return null
    return runCatching { LocalDate.parse(identifier.removePrefix(EVENING_REMINDER_ID_PREFIX)) }.getOrNull()
}

/** The days already reminded, from the identifiers of the DELIVERED notifications (iOS Ruling 2). */
fun deliveredEveningReminderDays(deliveredIdentifiers: List<String>): Set<LocalDate> =
    deliveredIdentifiers.mapNotNull(::eveningReminderDayOf).toSet()

/** The notification request for one planned reminder: the manual question, at its 19:00 wall clock, once. */
fun eveningReminderRequest(reminder: PlannedEveningReminder): UNNotificationRequest {
    val content = UNMutableNotificationContent()
    content.setTitle(NotificationCopy.MANUAL_TITLE)
    content.setBody(formatDayLong(reminder.day.toString()))
    // The wall clock only: with no time zone, the trigger matches 19:00 in the device's zone of that evening.
    val components = NSDateComponents()
    components.year = reminder.at.year.toLong()
    components.month = reminder.at.month.number.toLong()
    components.day = reminder.at.day.toLong()
    components.hour = reminder.at.hour.toLong()
    components.minute = reminder.at.minute.toLong()
    val trigger = UNCalendarNotificationTrigger.triggerWithDateMatchingComponents(components, repeats = false)
    return UNNotificationRequest.requestWithIdentifier(eveningReminderIdentifier(reminder.day), content, trigger)
}

/**
 * R1291: hold exactly [plan]'s requests - its unplanned days' requests removed, its planned ones added (replacing a
 * day's earlier request). The shell computes [plan] with eveningReminderPlan at each trigger (R1292).
 */
fun replanEveningReminders(
    plan: EveningReminderPlan,
    center: EveningReminderCenter = SystemEveningReminderCenter(),
) {
    val requests = plan.reminders.map(::eveningReminderRequest)
    center.removePending(plan.unplannedDays.map(::eveningReminderIdentifier))
    requests.forEach(center::add)
}
