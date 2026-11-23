package ch.monreleve.app.ios

import kotlin.test.Test
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-AUDIT R1350. THE FIRST-LAUNCH CLEAR OVER THE REAL KEYCHAIN AND A REAL UserDefaults MARKER - the measurement the
// app's host probe made (HostProbe.swift step (6), IOS-SHELL-1 R1321), moved out of the shipped framework with its
// helper (FirstLaunchProbeResult.kt, now in iosTest). The simulator test process's Keychain is real (its entitlements
// are in its own Mach-O section, IOS-1a R565 - KeychainRoundTripIosTest's premise), so the same three production
// stores and the production clearKeychainOnFirstLaunch run here exactly as they did under `-probe YES`, each on a
// probe name (nothing of the app's own is touched). IosFirstLaunchIosTest keeps the ORDER inside startIosShell, with
// doubles.

class FirstLaunchRealKeychainIosTest {
    @Test
    fun theClearRunsOnTheFirstLaunchAndNeverAfterOverTheRealStores() {
        val result = firstLaunchProbe()

        assertNull(result.failure, "no Keychain refusal: ${result.failure}")
        assertTrue(result.firstCleared, "no marker: the clear ran")
        assertTrue(result.firstLeftAllEmpty, "no marker: all three real stores left empty")
        assertTrue(result.firstSetTheMarker, "no marker: the marker set afterwards")
        assertTrue(!result.secondCleared, "marker set: the clear did not run")
        assertTrue(result.secondKeptAll, "marker set: all three real stores kept what they held")
        assertTrue(result.passed, "the positive signal")
    }
}
