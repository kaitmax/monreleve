package ch.monreleve.app.ios

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import platform.UserNotifications.UNNotificationDefaultActionIdentifier
import platform.UserNotifications.UNNotificationResponse
import platform.UserNotifications.UNUserNotificationCenter
import platform.UserNotifications.UNUserNotificationCenterDelegateProtocol
import platform.darwin.NSObject

// IOS-SHELL-2 (R1330, G4, iOS Ruling 3 Q4). A TAP ON THE EVENING REMINDER OPENS AUJOURD'HUI - Android's
// EXTRA_OPEN_AUJOURDHUI (R323 / D16: the tap opens the day and records nothing).
//
// iOS hands a tap to the UNUserNotificationCenter's DELEGATE, which must be set before launch ends for a tap that
// LAUNCHES the app to reach it - so Swift's didFinishLaunching (MonReleveApp.swift) calls
// installNotificationTapDelegate,
// on every launch but the pilot's and the probe's (the probe sets its own delegate). The centre holds its delegate
// WEAKLY, so the one instance is kept here.
//
// The delegate does one thing: an evening reminder's DEFAULT action (the tap - iOS v1's requests carry no category, so
// there is no other action, R1338's sibling) raises [IosNotificationTaps.openAujourdhui]. The shell is usually not
// built yet when a launching tap arrives, so the flag is process-wide and waits; IosMainShell consumes it when MAIN
// composes - selects Aujourd'hui, refreshes it, lowers the flag. Any other identifier is ignored.
//
// The iosTests drive routeNotificationTap (the delegate's whole body) and the shell's reaction
// (IosNotificationTapIosTest); the delegate's installation and a real tap need the app and a person's finger -
// IOS-WALK's.

/** A tap waiting for the main shell to open Aujourd'hui. */
class IosNotificationTaps {
    private val pending = MutableStateFlow(false)

    /** True while a reminder tap is waiting to be acted on. */
    val openAujourdhui: StateFlow<Boolean> = pending

    fun raise() {
        pending.value = true
    }

    fun consume() {
        pending.value = false
    }
}

/** The process's taps - the delegate writes here; the production shell reads here (startIosShell's default). */
val processNotificationTaps = IosNotificationTaps()

/** The delegate's body: an evening reminder's tap raises the flag; anything else is ignored. True when it raised it. */
fun routeNotificationTap(
    identifier: String,
    actionIdentifier: String,
    taps: IosNotificationTaps,
): Boolean {
    val isEveningReminder = identifier.startsWith(EVENING_REMINDER_ID_PREFIX)
    val isTheTap = actionIdentifier == UNNotificationDefaultActionIdentifier
    if (isEveningReminder && isTheTap) taps.raise()
    return isEveningReminder && isTheTap
}

private class NotificationTapDelegate(
    private val taps: IosNotificationTaps,
) : NSObject(),
    UNUserNotificationCenterDelegateProtocol {
    override fun userNotificationCenter(
        center: UNUserNotificationCenter,
        didReceiveNotificationResponse: UNNotificationResponse,
        withCompletionHandler: () -> Unit,
    ) {
        routeNotificationTap(
            identifier = didReceiveNotificationResponse.notification.request.identifier,
            actionIdentifier = didReceiveNotificationResponse.actionIdentifier,
            taps = taps,
        )
        withCompletionHandler()
    }
}

/** The one delegate, held strongly (the centre's reference is weak). */
private var installedDelegate: NotificationTapDelegate? = null

/** Called from didFinishLaunching (MonReleveApp.swift): from now on a reminder tap opens Aujourd'hui. */
fun installNotificationTapDelegate() {
    val delegate = installedDelegate ?: NotificationTapDelegate(processNotificationTaps).also { installedDelegate = it }
    UNUserNotificationCenter.currentNotificationCenter().delegate = delegate
}
