package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.Destination
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.pilot.waitBounded
import ch.monreleve.app.update.MINIMUM_VERSION_PATH
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-SHELL-1 (R1324; iOS Ruling 3 Q3). THE UPDATE GATE IS OUT ON iOS, BY TEST.
//
// Android asks /api/v1/android/minimum-version on every start (A4's gate, MainActivity); an iOS app that did the same
// would lock itself out the day the operator sets the ANDROID minimum. So this drives the iOS STARTUP - the process's
// shell built by startIosShell, its root (IosShellRoot) composed - against a recording transport, and asserts that path
// is NEVER requested. So that the absence means something (R169's corollary), the start is a SIGNED-IN one with no
// settings on the phone, whose startup MUST request GET /api/v1/me (RESOLVING, R297) - asserted present first, and the
// shell asserted to have reached MAIN on that answer. A signed-out start requests nothing at all, which would make the
// absence vacuous. The path is read from its one home (MINIMUM_VERSION_PATH, R181), never retyped.

@OptIn(ExperimentalTestApi::class)
class IosShellStartupIosTest {
    private fun SemanticsNodeInteractionsProvider.tabShown(label: String): Boolean =
        onAllNodes(hasText(label) and hasClickAction()).fetchSemanticsNodes().isNotEmpty()

    @Test
    fun theIosStartupAsksForMeAndNeverForTheAndroidMinimumVersion() =
        runComposeUiTest {
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = null,
                )
            try {
                assertEquals(Destination.RESOLVING, rig.shell.start, "signed in, no settings: the start resolves")
                setContent { IosShellRoot(rig.shell) }
                waitBounded("the startup asked GET $ME_PATH", TIMEOUT) { "GET $ME_PATH" in rig.transport.requests }
                waitBounded("the shell reached MAIN on /me's answer", TIMEOUT) { tabShown(NavCopy.CALENDRIER) }
                waitForIdle()
                val requested = rig.transport.requests.toList()
                assertTrue("GET $ME_PATH" in requested, "the positive control: the path startup must ask")
                assertTrue(
                    rig.logLines.any { "year downloads" in it },
                    "RESOLVING's year-download stub is named in the log, not silent (R1320): ${rig.logLines}",
                )
                assertTrue(
                    requested.none { MINIMUM_VERSION_PATH in it },
                    "the iOS startup must never ask $MINIMUM_VERSION_PATH (iOS Ruling 3 Q3): $requested",
                )
            } finally {
                rig.close()
            }
        }

    private companion object {
        const val TIMEOUT = 15_000L
    }
}
