package ch.monreleve.app.ios

import ch.monreleve.app.auth.TokenPair
import platform.Foundation.NSUserDefaults

// IOS-AUDIT R1350: MOVED FROM iosMain TO iosTest (git mv) - nothing probe-only ships. It now runs in
// FirstLaunchRealKeychainIosTest, inside the simulator test process, whose Keychain is real (IOS-1a R565) - the same
// measurement, outside the shipped framework. What follows is its original header.
//
// IOS-SHELL-1 R1321. THE HOST PROBE'S FIRST-LAUNCH CHECK (HostProbe.swift step (6), run only on a `-probe YES` launch
// of the ad-hoc simulator app - never by the product). IosFirstLaunchIosTest proves the ORDER with doubles, because the
// test binary has no app bundle; this measures the REAL clear: the production clearKeychainOnFirstLaunch over the three
// REAL Keychain stores (KeychainTokenStore, KeychainPendingSignInStore, KeychainAccountStore) and a REAL UserDefaults
// marker, inside the app bundle. KeychainRoundTripResult.kt's shape: probe-only Kotlin that never throws into Swift.
//
// IT TOUCHES NONE OF THE APP'S OWN ITEMS. Each store is built on a probe service name and the marker on a probe key, so
// a probe launch can never sign anybody out or mark a real install; the code path - each store's clear(), the marker
// read and write - is the production one. Everything it wrote is removed before it returns. Values are fakes and are
// never written out: only whether each store came back empty or kept. I3 removes this with the other probe keys.

/** What the two runs measured: the first (no marker) cleared all three; the second (marker set) cleared nothing. */
data class FirstLaunchProbeResult(
    val firstCleared: Boolean,
    val firstLeftAllEmpty: Boolean,
    val firstSetTheMarker: Boolean,
    val secondCleared: Boolean,
    val secondKeptAll: Boolean,
    val failure: String?,
) {
    val passed: Boolean
        get() =
            failure == null && firstCleared && firstLeftAllEmpty && firstSetTheMarker && !secondCleared &&
                secondKeptAll
}

private const val PROBE_SERVICE = "ch.monreleve.app.probe.firstlaunch"
private val PROBE_PAIR = TokenPair("fake-access", "fake-refresh", "2000-01-01T00:00:00Z", "2000-01-02T00:00:00Z")

/** Seeds the three probe stores, runs the clear twice (marker absent, then present), and cleans up. Probe only. */
fun firstLaunchProbe(): FirstLaunchProbeResult {
    val defaults = NSUserDefaults.standardUserDefaults
    val key = "$FIRST_LAUNCH_MARKER_KEY.probe"
    val marker = UserDefaultsFirstLaunchMarker(defaults, key)
    val tokens = KeychainTokenStore(service = "$PROBE_SERVICE.tokens")
    val pending = KeychainPendingSignInStore(service = "$PROBE_SERVICE.pending")
    val account = KeychainAccountStore(service = "$PROBE_SERVICE.account")

    fun seed() {
        tokens.save(PROBE_PAIR)
        pending.remember("probe@monreleve.invalid")
        account.setCurrent("probe-account")
    }

    fun allEmpty() = tokens.load() == null && pending.pending() == null && account.current() == null

    fun allKept() = tokens.load() == PROBE_PAIR && pending.pending() != null && account.current() != null
    return try {
        defaults.removeObjectForKey(key)
        seed()
        val firstCleared = clearKeychainOnFirstLaunch(marker, tokens, pending, account)
        val firstEmpty = allEmpty()
        val markerSet = marker.isSet()
        seed()
        val secondCleared = clearKeychainOnFirstLaunch(marker, tokens, pending, account)
        val secondKept = allKept()
        FirstLaunchProbeResult(firstCleared, firstEmpty, markerSet, secondCleared, secondKept, failure = null)
    } catch (refused: KeychainException) {
        FirstLaunchProbeResult(false, false, false, false, false, failure = "keychain OSStatus ${refused.status}")
    } finally {
        runCatching { tokens.clear() }
        runCatching { pending.clear() }
        runCatching { account.clear() }
        defaults.removeObjectForKey(key)
    }
}
