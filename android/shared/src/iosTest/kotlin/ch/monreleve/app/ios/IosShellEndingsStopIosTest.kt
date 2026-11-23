package ch.monreleve.app.ios

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-AUDIT R1381 (iOS Ruling 16, IOS-SHELL-3 DEVIATION 6). THE YEAR-DOWNLOAD STOP IS PINNED, ON EACH OF THE THREE
// ENDINGS, THROUGH startIosShell's OWN WIRE.
//
// iosSessionEndSeam's stopYearDownloads used to default to {}, so dropping startIosShell's wire compiled and nothing
// failed (IOS-SHELL-3 D6). The default is gone, and here the shell is built by the ONE production function with a
// RECORDING stop (ShellRig's yearDownloadStop, which records and then runs the coordinator's stop), and each ending is
// driven through the SessionEndingStore that function built - the store every ending path reaches (Paramètres' sign-out
// and deletion, and onServerEndedSession for a session the server ended). Each ending must reach the stop exactly once.
// The plant (the wire replaced by {} in startIosShell) makes all three fail by name.

class IosShellEndingsStopIosTest {
    private fun signedIn() =
        ShellRig(
            marked = true,
            pair = SHELL_PAIR,
            pendingAddress = null,
            account = "this-install",
            settings = SHELL_COMPLETE_SETTINGS,
        )

    private fun assertOneStop(
        ending: String,
        end: suspend (ShellRig) -> Unit,
    ) {
        val rig = signedIn()
        try {
            assertEquals(0, rig.yearDownloadStops(), "$ending: nothing stopped before the ending")
            runBlocking { end(rig) }
            assertEquals(1, rig.yearDownloadStops(), "R1381 $ending: the session-end seam stopped the year downloads")
        } finally {
            rig.close()
        }
    }

    @Test
    fun r1381aSignOutStopsTheYearDownloads() = assertOneStop("sign-out") { it.shell.localStore.clearForSignOut() }

    @Test
    fun r1381bDeletionStopsTheYearDownloads() = assertOneStop("deletion") { it.shell.localStore.clearForDeletion() }

    @Test
    fun r1381cAServerEndedSessionStopsTheYearDownloads() =
        assertOneStop("server-ended session") { it.shell.localStore.clearForSessionEnd() }
}
