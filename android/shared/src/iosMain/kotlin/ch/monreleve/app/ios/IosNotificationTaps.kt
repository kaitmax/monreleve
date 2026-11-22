package ch.monreleve.app.ios

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import platform.UserNotifications.UNNotification
import platform.UserNotifications.UNNotificationDefaultActionIdentifier
import platform.UserNotifications.UNNotificationPresentationOptionBanner
import platform.UserNotifications.UNNotificationPresentationOptionList
import platform.UserNotifications.UNNotificationPresentationOptions
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
// IOS-SHELL-3 R1373 (b): it also answers willPresent - an evening reminder arriving while the app is OPEN is shown (a
// banner, kept in the list, silent), as Android shows it; without that answer iOS shows nothing in the foreground.
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

/**
 * IOS-SHELL-3 R1373 (b) (iOS Ruling 15 Q3): how a notification is presented while the app is OPEN - the delegate's
 * willPresent answers with this. Without a willPresent iOS shows nothing in the foreground; Android shows its evening
 * reminder whatever the app is doing, so ours shows too: a banner, and kept in the notification list. NO sound - iOS
 * v1 ships the reminder silent (iOS Ruling 10 Q3), and the foreground does not change that. Anything not ours: nothing.
 */
internal fun foregroundPresentation(identifier: String): UNNotificationPresentationOptions =
    if (identifier.startsWith(EVENING_REMINDER_ID_PREFIX)) {
        UNNotificationPresentationOptionBanner or UNNotificationPresentationOptionList
    } else {
        0uL
    }

/** The delegate the app installs, as an object a test can ask which selectors it answers (R1373 b). */
internal fun notificationDelegate(taps: IosNotificationTaps): NSObject = NotificationTapDelegate(taps)

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

    /** R1373 (b): a notification arriving while the app is open - ours is shown (foregroundPresentation). */
    override fun userNotificationCenter(
        center: UNUserNotificationCenter,
        willPresentNotification: UNNotification,
        withCompletionHandler: (UNNotificationPresentationOptions) -> Unit,
    ) {
        withCompletionHandler(foregroundPresentation(willPresentNotification.request.identifier))
    }
}

/** The one delegate, held strongly (the centre's reference is weak). */
private var installedDelegate: NotificationTapDelegate? = null

/** Called from didFinishLaunching (MonReleveApp.swift): from now on a reminder tap opens Aujourd'hui. */
fun installNotificationTapDelegate() {
    val delegate = installedDelegate ?: NotificationTapDelegate(processNotificationTaps).also { installedDelegate = it }
    UNUserNotificationCenter.currentNotificationCenter().delegate = delegate
}
