package ch.monreleve.app.ios

import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore

// IOS-HOST R1212 (1). THE KEYCHAIN ROUND-TRIP THE APP HOST'S -probe LAUNCH RUNS, INSIDE THE APP BUNDLE.
//
// The simulator TEST binary proved KeychainTokenStore with entitlements the linker wrote into its own Mach-O section
// (IOS-1a R565). An APP is signed another way - ad hoc, identity "-", entitlements processed by Xcode - so whether the
// same store works there is the host's question, and this is the one function its probe calls to answer it.
//
// WHY KOTLIN, NOT SWIFT: KeychainTokenStore.save THROWS KeychainException on a refused write, and a Kotlin exception
// that reaches Swift through a function with no @Throws ends the process - the probe would lose every later result
// to the one it was measuring. This catches the store's own exception and returns its OSStatus by number.
//
// The caller supplies the store (its own service name, never the session's) and a FAKE pair; a passing round-trip
// clears what it saved before returning.

/** What one round-trip measured. [saveStatus] is 0 when save returned, else the refusal's OSStatus. */
data class KeychainRoundTripResult(
    val saveStatus: Int,
    val loadedEqual: Boolean,
    val clearedToNull: Boolean,
) {
    /** The positive signal: saved, read back equal, and gone after clear. */
    val passed: Boolean get() = saveStatus == 0 && loadedEqual && clearedToNull
}

/** IOS-HOST RED STUB: measures nothing yet. */
@Suppress("UnusedParameter")
fun keychainRoundTrip(
    store: TokenStore,
    fake: TokenPair,
): KeychainRoundTripResult {
    val notMeasured = Int.MIN_VALUE
    return KeychainRoundTripResult(saveStatus = notMeasured, loadedEqual = false, clearedToNull = false)
}
