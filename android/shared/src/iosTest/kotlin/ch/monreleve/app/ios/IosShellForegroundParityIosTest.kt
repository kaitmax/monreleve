package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.runComposeUiTest
import androidx.lifecycle.Lifecycle
import ch.monreleve.app.fr.text.formatDayLong
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSSelectorFromString
import platform.UserNotifications.UNNotificationPresentationOptionBanner
import platform.UserNotifications.UNNotificationPresentationOptionList
import platform.UserNotifications.UNNotificationPresentationOptionSound
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-SHELL-3 R1373 (iOS Ruling 15 Q3). FOREGROUND PARITY WITH ANDROID, each written before its code (RED first):
//   (a) Android's F8 - the midnight case: an app brought back to the foreground after midnight shows the NEW day on
//       Aujourd'hui (MainShell refreshes it on every ON_RESUME). Driven through the shell's ONE foreground seam (the
//       root's lifecycle, R1332), with the shell's clock moved across midnight while the app is in the background.
//   (b) the evening reminder is SHOWN while the app is open, as Android shows it: the notification centre's delegate
//       answers willPresent with a banner (and the notification list), never a sound (iOS Ruling 10 Q3: iOS v1 ships
//       silent). As for the tap (IosNotificationTapIosTest), a UNNotification cannot be built in a test: the decision
//       is the pure foregroundPresentation, and the delegate is asserted to ANSWER the willPresent selector. The
//       delegate method itself receiving a real notification is IOS-WALK's.

@OptIn(ExperimentalTestApi::class)
class IosShellForegroundParityIosTest {
    @Test
    fun r1373aAForegroundAfterMidnightShowsTheNewDayOnAujourdhui() =
        runComposeUiTest {
            // 23:30 in Paris on Monday 16 November.
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    now = "2026-11-16T22:30:00Z",
                )
            try {
                setShellContent(rig)
                waitFor("Monday on Aujourd'hui") { shows(formatDayLong("2026-11-16")) }

                rig.lifecycle.moveTo(Lifecycle.State.CREATED)
                // 00:30 in Paris: Tuesday 17 November, while the app is in the background.
                rig.nowIso = "2026-11-16T23:30:00Z"
                waitForIdle()
                assertTrue(shows(formatDayLong("2026-11-16")), "the BEFORE: still Monday until the foreground")

                rig.lifecycle.moveTo(Lifecycle.State.RESUMED)
                waitFor("F8 on iOS: the foreground after midnight shows Tuesday") {
                    shows(formatDayLong("2026-11-17"))
                }
            } finally {
                rig.close()
            }
        }

    @OptIn(ExperimentalForeignApi::class) // NSSelectorFromString's selector pointer.
    @Test
    fun r1373bAnEveningReminderIsShownWithABannerWhileTheAppIsOpen() {
        val ours = foregroundPresentation(EVENING_REMINDER_ID_PREFIX + SHELL_TODAY)
        assertTrue((ours and UNNotificationPresentationOptionBanner) != 0uL, "the evening reminder shows as a banner")
        assertTrue((ours and UNNotificationPresentationOptionList) != 0uL, "and stays in the notification list")
        assertEquals(0uL, ours and UNNotificationPresentationOptionSound, "and makes no sound (iOS Ruling 10 Q3)")
        assertEquals(0uL, foregroundPresentation("ios-host-probe-1"), "a request that is not ours is not presented")

        val delegate = notificationDelegate(IosNotificationTaps())
        assertTrue(
            delegate.respondsToSelector(
                NSSelectorFromString("userNotificationCenter:willPresentNotification:withCompletionHandler:"),
            ),
            "the delegate answers willPresent - without it iOS shows nothing while the app is open",
        )
    }
}
