package ch.monreleve.app.ios

import ch.monreleve.app.Destination
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-SHELL-1 (R1321; iOS Ruling 2 C8 Q2). THE FIRST-LAUNCH CLEAR, THROUGH THE REAL START PATH, ITS ORDER ASSERTED.
//
// Each case builds the process's shell with startIosShell - the function MonReleveViewController calls - over doubles
// that write every call to one ordered log (ShellTestDoubles.kt). With no marker, the three Keychain stores must be
// empty and the marker set, AND every clear and the marker's write must come BEFORE the first read of the token store
// (isSignedIn) or the account - asserted on the log, not argued (R1321: "the ordering is asserted"). With the marker
// present, nothing is cleared and the person starts where their stores say. The REAL Keychain clear is the host
// probe's (firstLaunch.* in the ios-app run): this process has no app bundle.

class IosFirstLaunchIosTest {
    @Test
    fun aFirstLaunchClearsTheThreeStoresAndThenSetsTheMarkerBeforeAnythingReadsThem() {
        val rig =
            ShellRig(
                marked = false,
                pair = SHELL_PAIR,
                pendingAddress = SHELL_ADDRESS,
                account = "a-previous-install",
                settings = null,
            )
        try {
            assertNull(rig.tokens.pair, "the token pair is cleared")
            assertNull(rig.pending.value, "the pending address is cleared")
            assertNull(rig.account.tag, "the account tag is cleared")
            assertTrue(rig.marker.marked, "the marker is set")
            assertEquals(Destination.SIGN_IN, rig.shell.start, "a reinstalled app starts signed out, as Android does")

            val log = rig.log
            val clears = listOf("tokens.clear", "pending.clear", "account.clear").map(log::first)
            val markerSet = log.first("marker.set")
            val firstRead = listOf("tokens.load", "account.read").map(log::first).filter { it >= 0 }.minOrNull()
            assertTrue(clears.all { it >= 0 }, "all three stores were cleared: ${log.events}")
            assertTrue(clears.all { it < markerSet }, "the marker is set AFTER the three clears: ${log.events}")
            assertTrue(firstRead != null, "the start path read the session (isSignedIn): ${log.events}")
            assertTrue(markerSet < firstRead, "nothing read a store before the clear and the marker: ${log.events}")
        } finally {
            rig.close()
        }
    }

    @Test
    fun withTheMarkerPresentNothingIsClearedAndTheStoresDecideTheStart() {
        val rig =
            ShellRig(
                marked = true,
                pair = SHELL_PAIR,
                pendingAddress = SHELL_ADDRESS,
                account = "this-install",
                settings = null,
            )
        try {
            assertFalse(rig.log.events.any { it.endsWith(".clear") }, "no store cleared: ${rig.log.events}")
            assertFalse("marker.set" in rig.log.events, "the marker is not written again")
            assertEquals(SHELL_PAIR, rig.tokens.pair)
            assertEquals(SHELL_ADDRESS, rig.pending.value)
            assertEquals("this-install", rig.account.tag)
            assertEquals(Destination.RESOLVING, rig.shell.start, "signed in, not onboarded here: RESOLVING")
        } finally {
            rig.close()
        }
    }
}
