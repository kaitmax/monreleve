package ch.monreleve.app.ios

import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.Destination
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.pilot.waitBounded
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-SHELL-1 (R1323, R1329). SIGNING OUT THROUGH THE iOS SHELL LEAVES NO PENDING REMINDER - AND NEVER ASKS FOR
// CONSENT.
//
// The process's shell (startIosShell) is built signed in and onboarded, opted in to the evening reminder, over ONE
// recording centre (ShellTestDoubles.kt) - the centre the composition hands BOTH to M4's re-plan and to M3's
// iosSessionEndSeam. The re-plan fills it, and the BEFORE count is asserted > 0 first, or the zero after would prove
// nothing (R169's corollary). Then the person signs out THROUGH THE SHELL - the Paramètres tab, « Se déconnecter », the
// confirmation - never by calling the seam (R204), and the centre must hold ZERO pending requests, the Keychain doubles
// must be empty, and the shell must be back on Bienvenue. The real centre's count is I2's to measure (iOS Ruling 9).
//
// R1329: the iOS Parametres wire's detection-consent member must never be asked for. The tab is shown with no detection
// entry point (onToggleAutoDetection = null - its label is asserted ABSENT while the sign-out row is PRESENT), and the
// recorder behind that member is asserted empty after the whole flow.

@OptIn(ExperimentalTestApi::class)
class IosShellSignOutIosTest {
    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    private fun SemanticsNodeInteractionsProvider.clickable(text: String): Boolean =
        onAllNodes(hasText(text) and hasClickAction()).fetchSemanticsNodes().isNotEmpty()

    private fun ComposeUiTest.waitFor(
        what: String,
        condition: () -> Boolean,
    ) = waitBounded(what, TIMEOUT, condition)

    @Test
    fun signingOutThroughTheShellLeavesZeroPendingRemindersAndNeverAsksForConsent() =
        runComposeUiTest {
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    eveningOptedIn = true,
                )
            try {
                assertEquals(Destination.MAIN, rig.shell.start, "signed in and onboarded: MAIN")
                runBlocking { rig.shell.replanReminders() }
                val before = rig.centre.pending.size
                assertTrue(before > 0, "the BEFORE count: the plan must hold requests, or zero after proves nothing")

                setContent { IosShellRoot(rig.shell) }
                waitFor("the bottom bar") { clickable(NavCopy.PARAMETRES) }
                onAllNodes(hasText(NavCopy.PARAMETRES) and hasClickAction()).onFirst().performClick()
                waitFor("the Paramètres tab's sign-out row") { clickable(ParametresCopy.SIGN_OUT) }
                assertFalse(shows(ParametresCopy.AUTO_LABEL), "no detection entry point on iOS v1 (R1329)")

                onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onFirst().performScrollTo()
                onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onFirst().performClick()
                waitFor("the sign-out confirmation") { shows(ParametresCopy.SIGN_OUT_CONFIRM_BODY) }
                onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onLast().performClick()
                waitFor("back on Bienvenue after the sign-out") { shows(WelcomeCopy.TITLE) }

                assertEquals(0, rig.centre.pending.size, "AFTER the sign-out: no pending reminder (was $before)")
                assertTrue(rig.centre.removeAllCalls >= 1, "the seam's removal ran on the sign-out path")
                assertNull(rig.tokens.pair, "the token pair is gone")
                assertNull(rig.account.tag, "the account tag is gone")
                assertNull(rig.settings.load(), "the settings are gone")
                assertFalse(rig.evening.isEnabled(), "the evening opt-in is cleared with the detection file (R527)")
                assertEquals(emptyList(), rig.consentAsked, "the detection-consent body was never asked for (R1329)")
            } finally {
                rig.close()
            }
        }

    private companion object {
        const val TIMEOUT = 20_000L
    }
}
