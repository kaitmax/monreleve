package ch.monreleve.app.ios

import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull

// IOS-2a R768. The iOS pending-address store on the simulator's real Keychain (booted, entitled - IOS-1a R565): what
// the sign-in remembers reads back trimmed and lower-cased as Android's does, survives a NEW instance (the app killed
// between the request and the link), is replaced by the next request, and clears; and it is a different item from the
// token pair, so clearing one never touches the other.
class KeychainPendingSignInStoreTest {
    private val service = uniqueName("ch.monreleve.app.test.pending")

    @AfterTest
    fun cleanUp() {
        KeychainPendingSignInStore(service).clear()
    }

    @Test
    fun nothingIsPendingBeforeAnyRequest() {
        assertNull(KeychainPendingSignInStore(service).pending())
    }

    @Test
    fun theAddressSurvivesANewInstanceNormalisedAsAndroidStoresIt() {
        KeychainPendingSignInStore(service).remember("  A@B.ch ")
        assertEquals("a@b.ch", KeychainPendingSignInStore(service).pending())
    }

    @Test
    fun theNextRequestReplacesTheAddressAndClearEmptiesIt() {
        val store = KeychainPendingSignInStore(service)
        store.remember("a@b.ch")
        store.remember("c@d.ch")
        assertEquals("c@d.ch", store.pending())
        store.clear()
        assertNull(store.pending())
        store.clear()
        assertNull(store.pending())
    }

    @Test
    fun itIsNotTheTokenPairsItem() {
        // The production identities, not the test ones: a pending address written under the token pair's service
        // and account would overwrite the session (the Keychain item is service + account).
        assertNotEquals(KEYCHAIN_SERVICE to KEYCHAIN_ACCOUNT, PENDING_KEYCHAIN_SERVICE to PENDING_KEYCHAIN_ACCOUNT)
    }
}
