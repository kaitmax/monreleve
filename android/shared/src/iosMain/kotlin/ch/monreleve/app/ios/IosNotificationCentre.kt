package ch.monreleve.app.ios

import platform.UserNotifications.UNAuthorizationOptionAlert
import platform.UserNotifications.UNAuthorizationOptionSound
import platform.UserNotifications.UNAuthorizationStatusAuthorized
import platform.UserNotifications.UNAuthorizationStatusEphemeral
import platform.UserNotifications.UNAuthorizationStatusProvisional
import platform.UserNotifications.UNNotification
import platform.UserNotifications.UNNotificationRequest
import platform.UserNotifications.UNUserNotificationCenter
import platform.darwin.dispatch_async
import platform.darwin.dispatch_get_main_queue

// IOS-SHELL-1 (R1323, R1325). THE NOTIFICATION CENTRE THE iOS SHELL TALKS TO - ONE SEAM FOR EVERY CALL IT MAKES.
//
// It extends M4's EveningReminderCenter (the re-plan's two calls, ios/IosEveningReminders.kt) with the four the shell
// adds: removing every pending request (the sign-out rule, iosSessionEndSeam - iOS Ruling 9 Q3), asking for the
// authorization (onboarding's reminder "Oui", R1325 / R323 / R1145 - the ALERT prompt, never provisional: iOS Ruling 4
// Q4), reading it (RESOLVING's restore, R1147), and listing what was delivered ("already notified", iOS Ruling 2).
//
// ONE object behind all of them, so the iOS composition hands the SAME centre to the re-plan and to the session-end
// seam - which is what lets IosShellSignOutIosTest watch one recording centre fill on the plan and empty on the
// sign-out, through the shell (R204).
//
// THE SYSTEM CENTRE IS RESOLVED INSIDE EACH CALL, never when this is built: UNUserNotificationCenter raises an
// Objective-C exception in a process with no app bundle (the simulator test binary - IosSessionEndSeam.kt's header),
// so building the shell must not touch it, and the iosTests pass a recording centre. The three answers the system
// gives on a background queue are handed back on the MAIN queue, because each one moves Compose state.

/** The notification centre the iOS shell uses: the re-plan's two calls, and the four the shell adds. */
interface IosNotificationCentre : EveningReminderCenter {
    /** Removes EVERY pending request of this app - the sign-out rule (iOS Ruling 9 Q3). */
    fun removeAllPending()

    /** Asks for the alert authorization (a prompt the first time); [onAnswer] gets whether it was granted. */
    fun requestAuthorization(onAnswer: (granted: Boolean) -> Unit)

    /** Reads whether this app may notify now (authorized, provisional or ephemeral); answered on the main queue. */
    fun readAuthorization(onAnswer: (permitted: Boolean) -> Unit)

    /** The identifiers of this app's DELIVERED notifications; answered on the main queue. */
    fun deliveredIdentifiers(onAnswer: (List<String>) -> Unit)
}

/** The device's centre, resolved inside each call (see the header). */
class SystemNotificationCentre : IosNotificationCentre {
    private val reminders = SystemEveningReminderCenter()

    private fun centre(): UNUserNotificationCenter = UNUserNotificationCenter.currentNotificationCenter()

    override fun removePending(identifiers: List<String>) = reminders.removePending(identifiers)

    override fun add(request: UNNotificationRequest) = reminders.add(request)

    override fun removeAllPending() {
        centre().removeAllPendingNotificationRequests()
    }

    override fun requestAuthorization(onAnswer: (granted: Boolean) -> Unit) {
        val options = UNAuthorizationOptionAlert or UNAuthorizationOptionSound
        centre().requestAuthorizationWithOptions(options) { granted, _ -> onMain { onAnswer(granted) } }
    }

    override fun readAuthorization(onAnswer: (permitted: Boolean) -> Unit) {
        centre().getNotificationSettingsWithCompletionHandler { settings ->
            val status = settings?.authorizationStatus
            val permitted =
                status == UNAuthorizationStatusAuthorized ||
                    status == UNAuthorizationStatusProvisional ||
                    status == UNAuthorizationStatusEphemeral
            onMain { onAnswer(permitted) }
        }
    }

    override fun deliveredIdentifiers(onAnswer: (List<String>) -> Unit) {
        centre().getDeliveredNotificationsWithCompletionHandler { delivered ->
            val identifiers = delivered.orEmpty().mapNotNull { (it as? UNNotification)?.request?.identifier }
            onMain { onAnswer(identifiers) }
        }
    }
}

private fun onMain(block: () -> Unit) {
    dispatch_async(dispatch_get_main_queue()) { block() }
}
