package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.ParametresCopy
import platform.UserNotifications.UNNotificationDefaultActionIdentifier
import platform.UserNotifications.UNNotificationDismissActionIdentifier
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// IOS-SHELL-2 (R1330, iOS Ruling 3 Q4). A TAP ON THE EVENING REMINDER OPENS AUJOURD'HUI.
//
// The delegate's whole body is routeNotificationTap (IosNotificationTaps.kt): an evening reminder's default action
// raises the flag; any other identifier or action does not. The shell's reaction is driven through the shell: the
// person is on Paramètres, the tap arrives, and the main shell must show Aujourd'hui and lower the flag. Installing
// the delegate and a real tap need the app and a finger - IOS-WALK's.

@OptIn(ExperimentalTestApi::class)
class IosNotificationTapIosTest {
    private val reminder = EVENING_REMINDER_ID_PREFIX + SHELL_TODAY

    @Test
    fun onlyAnEveningRemindersTapRaisesTheFlag() {
        val taps = IosNotificationTaps()
        assertFalse(routeNotificationTap("ios-host-probe-1", UNNotificationDefaultActionIdentifier, taps), "not ours")
        assertFalse(routeNotificationTap(reminder, UNNotificationDismissActionIdentifier, taps), "a dismissal")
        assertFalse(taps.openAujourdhui.value, "nothing raised so far")
        assertTrue(routeNotificationTap(reminder, UNNotificationDefaultActionIdentifier, taps), "the tap")
        assertTrue(taps.openAujourdhui.value)
    }

    @Test
    fun aReminderTapTakesTheShellFromParametresToAujourdhui() =
        runComposeUiTest {
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                )
            try {
                setShellContent(rig)
                openParametres()
                waitFor("on Paramètres") { shows(ParametresCopy.SIGN_OUT) }
                assertFalse(shows(AujourdhuiCopy.QUESTION), "not on Aujourd'hui before the tap (the BEFORE)")

                routeNotificationTap(reminder, UNNotificationDefaultActionIdentifier, rig.taps)
                waitFor("the tap opened Aujourd'hui") { shows(AujourdhuiCopy.QUESTION) }
                waitFor("and the flag was consumed") { !rig.taps.openAujourdhui.value }
            } finally {
                rig.close()
            }
        }
}
