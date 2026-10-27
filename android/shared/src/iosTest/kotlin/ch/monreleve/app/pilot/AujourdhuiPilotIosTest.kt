package ch.monreleve.app.pilot

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.window.ComposeUIViewController
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.ios.newIosMutationId
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSDate
import platform.Foundation.NSRunLoop
import platform.Foundation.dateWithTimeIntervalSinceNow
import platform.Foundation.runUntilDate
import platform.UIKit.UIScreen
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-1b-A R606. THE SHARED AUJOURD'HUI SCREEN, COMPOSED AND DRIVEN ON THE iOS SIMULATOR.
//
// Compose Multiplatform's UI-test API runs here (runComposeUiTest on iosSimulatorArm64 - R624's probe proved it on
// this toolchain), so the screen is not only compiled for iOS but composed, read and tapped: the pilot (the real
// controller over the in-memory fixture, R608) in each state the top of the screen has, and one tap recorded into
// memory and shown pending. A last test hosts it the way Part B will - in a UIViewController in a UIWindow - and
// waits for the composition. Strings come from fr/ (AujourdhuiCopy), never retyped (R181).

@OptIn(ExperimentalTestApi::class)
class AujourdhuiPilotIosTest {
    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    @Test
    fun unansweredAsksTheQuestion() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.UNANSWERED, ::newIosMutationId) }
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.QUESTION), "the question")
            assertTrue(shows(AujourdhuiCopy.WEEK_HEADING), "the week strip, from the seeded history")
        }

    @Test
    fun answeredWholeShowsItAcknowledged() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.ANSWERED_WHOLE, ::newIosMutationId) }
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.SYNCED), "answered whole: acknowledged")
        }

    @Test
    fun pendingSaysItIsStillOnThePhone() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.PENDING, ::newIosMutationId) }
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.PENDING), "pending: the pending line")
        }

    @Test
    fun refusedSaysTheServerRefusedIt() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.REFUSED, ::newIosMutationId) }
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.SYNC_FAILED), "refused: the refused line")
        }

    @Test
    fun theHalfDayScenarioAsksForTheMorningAndTheAfternoon() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.UNANSWERED_HALF_DAY, ::newIosMutationId) }
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.MORNING), "the morning")
            assertTrue(shows(AujourdhuiCopy.AFTERNOON), "the afternoon")
        }

    @Test
    fun aTapRecordsTheDayAndItShowsPending() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.UNANSWERED, ::newIosMutationId) }
            waitForIdle()
            onNodeWithText(AujourdhuiCopy.DOMICILE, useUnmergedTree = true).performClick()
            waitForIdle()
            assertTrue(shows(AujourdhuiCopy.PENDING), "one tap: recorded on the phone, pending")
        }

    @OptIn(ExperimentalForeignApi::class)
    @Test
    fun theScreenComposesInsideAViewControllerInAWindow() {
        // Part B's entry point keeps Compose's strict Info.plist check ON; a test binary has no Info.plist, so this
        // hosts the same composable with the check off. The entry point itself is referenced so it must compile.
        val entryPoint: (PilotScenario) -> UIViewController = ::aujourdhuiPilotViewController
        var composed = false
        val controller =
            ComposeUIViewController(configure = { enforceStrictPlistSanityCheck = false }) {
                AujourdhuiPilot(PilotScenario.PENDING, ::newIosMutationId)
                composed = true
            }
        val window = UIWindow(frame = UIScreen.mainScreen.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        var spins = 0
        while (!composed && spins < SPIN_LIMIT) {
            NSRunLoop.mainRunLoop.runUntilDate(NSDate.dateWithTimeIntervalSinceNow(SPIN_SECONDS))
            spins++
        }
        println("IOS-1b-A R606: AujourdhuiPilot composed=$composed after $spins spins; entry point $entryPoint")
        assertTrue(composed, "the pilot never composed inside a UIViewController")
    }

    private companion object {
        const val SPIN_LIMIT = 100
        const val SPIN_SECONDS = 0.05
    }
}
