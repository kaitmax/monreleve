package ch.monreleve.app.ios

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.contracts.AccountStoreContract
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2f R889. The iOS account store against the AccountStore contract (commonTest - the JVM runs it against the
// in-memory reference), on the simulator's real Keychain (booted, entitled - IOS-1a R565), under a unique service so a
// run never touches the production item. Plus what is iOS's own: it is a separate Keychain item from the token pair and
// the pending address, so clearing one never touches another.

class KeychainAccountStoreContractTest : AccountStoreContract() {
    private val service = uniqueName("ch.monreleve.app.test.account")

    override fun reset() = KeychainAccountStore(service).clear()

    override fun newInstance(): AccountStore = KeychainAccountStore(service)

    @AfterTest
    fun cleanUp() = reset()
}

class KeychainAccountStoreItemTest {
    private val accountService = uniqueName("ch.monreleve.app.test.account-item")
    private val tokenService = uniqueName("ch.monreleve.app.test.token-item")
    private val pendingService = uniqueName("ch.monreleve.app.test.pending-item")

    @AfterTest
    fun cleanUp() {
        KeychainAccountStore(accountService).clear()
        KeychainTokenStore(tokenService).clear()
        KeychainPendingSignInStore(pendingService).clear()
    }

    @Test
    fun itsProductionIdentityIsNeitherTheTokenPairsNorThePendingAddresss() {
        val account = ACCOUNT_KEYCHAIN_SERVICE to ACCOUNT_KEYCHAIN_ACCOUNT
        assertTrue(account != (KEYCHAIN_SERVICE to KEYCHAIN_ACCOUNT), "the tag would overwrite the session")
        val pending = PENDING_KEYCHAIN_SERVICE to PENDING_KEYCHAIN_ACCOUNT
        assertTrue(account != pending, "the tag would overwrite the address")
    }

    @Test
    fun clearingTheTagLeavesTheOtherItemsAndClearingThemLeavesTheTag() {
        val tag = "c".repeat(64)
        KeychainAccountStore(accountService).setCurrent(tag)
        KeychainPendingSignInStore(pendingService).remember("a@b.ch")
        KeychainAccountStore(accountService).clear()
        assertNull(KeychainAccountStore(accountService).current(), "the tag is cleared")
        assertEquals("a@b.ch", KeychainPendingSignInStore(pendingService).pending(), "the address is not")
        KeychainAccountStore(accountService).setCurrent(tag)
        KeychainPendingSignInStore(pendingService).clear()
        KeychainTokenStore(tokenService).clear()
        assertEquals(tag, KeychainAccountStore(accountService).current(), "clearing the others leaves the tag")
    }
}
