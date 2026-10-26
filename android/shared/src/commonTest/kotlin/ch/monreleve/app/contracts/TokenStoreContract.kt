package ch.monreleve.app.contracts

import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

// IOS-1a R565. THE TokenStore KDOC, AS TESTS, WRITTEN ONCE. The in-memory reference runs it on the JVM; the
// Keychain store runs it on the simulator when the Keychain is available to a test binary (see
// KeychainTokenStoreTest for what happens when it is not). Android's Keystore store needs a device and keeps
// its own instrumented test.

abstract class TokenStoreContract {
    protected abstract fun reset()

    protected abstract fun newInstance(): TokenStore

    /** Puts bytes in the storage that no pair decodes from: an invalidated key, a corrupted blob. */
    protected abstract fun corruptStoredValue()

    /** Whether ANYTHING is still stored for the pair (after the unreadable-value recovery it must be false). */
    protected abstract fun somethingIsStored(): Boolean

    @BeforeTest
    fun emptyStorage() = reset()

    private val pair = TokenPair("access-1", "refresh-1", "2027-06-18T16:18:00.000Z", "2027-09-16T16:03:00.000Z")

    @Test
    fun loadBeforeAnySaveIsNull() = assertNull(newInstance().load())

    @Test
    fun aSavedPairComesBackWholeThroughAnotherInstance() {
        newInstance().save(pair)
        assertEquals(pair, newInstance().load())
    }

    @Test
    fun saveReplacesTheWholePairNeverMixingTwo() {
        val store = newInstance()
        store.save(pair)
        val next = TokenPair("access-2", "refresh-2", "2027-06-18T17:18:00.000Z", "2027-09-16T17:03:00.000Z")
        store.save(next)
        assertEquals(next, newInstance().load())
    }

    @Test
    fun clearErasesThePairAndOnAnEmptyStoreIsANoOp() {
        val store = newInstance()
        store.clear()
        store.save(pair)
        store.clear()
        assertNull(newInstance().load())
        assertFalse(somethingIsStored())
        store.clear()
    }

    @Test
    fun anUnreadableValueLoadsAsNullAndIsClearedSoTheAppCannotLoop() {
        newInstance().save(pair)
        corruptStoredValue()
        assertNull(newInstance().load())
        assertFalse(somethingIsStored(), "the unreadable value must be gone after load()")
        assertNull(newInstance().load())
    }
}
