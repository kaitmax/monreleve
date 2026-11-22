package ch.monreleve.app.ios

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenStore
import platform.Foundation.NSUserDefaults

// IOS-SHELL-1 (R1321; iOS Ruling 2, C8 Q2; REPORT-IOS-HOST-CENSUS R1202 G3). THE FIRST-LAUNCH CLEAR.
//
// Keychain items SURVIVE an uninstall on iOS; UserDefaults do not. So a reinstalled app would find the previous
// install's token pair, pending address and account tag still in the Keychain and start SIGNED IN - where Android,
// whose
// stores go with the app, starts signed out. The rule (iOS Ruling 2): a UserDefaults marker, which a reinstall wipes;
// when it is ABSENT, the three Keychain stores are cleared and THEN the marker is set - all BEFORE the session is built
// or anything reads isSignedIn(). startIosShell (IosShell.kt) calls this first, and IosFirstLaunchIosTest asserts the
// order with recording doubles (the iosTest process has no app bundle); the REAL Keychain clear is measured by the host
// probe's firstLaunch key in the ios-app run (HostProbe.swift step 6; I3 removes probe keys).
//
// CLEAR, THEN MARK. If the process dies between the two, the next launch clears again - harmless, since nothing has
// been written yet. The other order could leave a marked install holding a stale pair: exactly what this prevents.

/** The UserDefaults key whose presence says this install has already run its first-launch clear. */
const val FIRST_LAUNCH_MARKER_KEY: String = "ch.monreleve.app.firstLaunchCleared"

/** Whether this install has run its first-launch clear. */
interface FirstLaunchMarker {
    fun isSet(): Boolean

    fun set()
}

/** The marker in UserDefaults - wiped by a reinstall, which is the point. */
class UserDefaultsFirstLaunchMarker(
    private val defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
    private val key: String = FIRST_LAUNCH_MARKER_KEY,
) : FirstLaunchMarker {
    override fun isSet(): Boolean = defaults.boolForKey(key)

    override fun set() {
        defaults.setBool(true, forKey = key)
    }
}

/**
 * G3: with no marker, the three Keychain stores are cleared and THEN the marker is set. Returns whether it cleared.
 * Called before the session exists (startIosShell), so nothing has read the stores yet.
 */
fun clearKeychainOnFirstLaunch(
    marker: FirstLaunchMarker,
    tokenStore: TokenStore,
    pending: PendingSignInStore,
    accountStore: AccountStore,
): Boolean {
    if (marker.isSet()) return false
    tokenStore.clear()
    pending.clear()
    accountStore.clear()
    marker.set()
    return true
}
