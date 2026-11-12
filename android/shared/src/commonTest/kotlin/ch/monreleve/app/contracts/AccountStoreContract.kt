package ch.monreleve.app.contracts

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.UNOWNED_ACCOUNT
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull

// IOS-2f R889. THE AccountStore KDOC, AS TESTS, WRITTEN ONCE (DossierCacheContract's shape: the in-memory reference
// runs it on the JVM, the Keychain store runs it on the simulator; Android's SharedPreferences store needs a device and
// cannot subclass this from :shared).
//
// What the contract (account/AccountStore.kt) and its callers rely on, each a test below:
//   - no account until one is set: current() is null on a fresh store (a null account drains NOTHING - SyncEngine);
//   - the tag set at sign-in is the tag every later reader sees - through ANOTHER instance, because the drain, the
//     repository and the screens each build their own (SyncWorker.buildSyncEngine reads it at drain time);
//   - a second sign-in REPLACES the tag (one current account, never two);
//   - clear() leaves no account, and on an empty store is a no-op (sign-out, deletion);
//   - the store keeps exactly what it was given (an opaque 64-hex digest), and is never the UNOWNED sentinel.

abstract class AccountStoreContract {
    protected abstract fun reset()

    protected abstract fun newInstance(): AccountStore

    @BeforeTest
    fun emptyStorage() = reset()

    // Two real accountTagOf digests' SHAPE (64 lowercase hex characters); the values are arbitrary.
    private val tagA = "a".repeat(32) + "0123456789abcdef0123456789abcdef"
    private val tagB = "b".repeat(32) + "fedcba9876543210fedcba9876543210"

    @Test
    fun noAccountUntilOneIsSet() = assertNull(newInstance().current())

    @Test
    fun theTagSetComesBackThroughAnotherInstance() {
        newInstance().setCurrent(tagA)
        assertEquals(tagA, newInstance().current())
    }

    @Test
    fun aSecondSignInReplacesTheTag() {
        val store = newInstance()
        store.setCurrent(tagA)
        store.setCurrent(tagB)
        assertEquals(tagB, newInstance().current())
    }

    @Test
    fun clearLeavesNoAccountForAnyInstance() {
        val store = newInstance()
        store.setCurrent(tagA)
        assertEquals(tagA, newInstance().current(), "positive control: the tag was stored before the clear")
        store.clear()
        assertNull(newInstance().current())
    }

    @Test
    fun clearOnAnEmptyStoreIsANoOp() {
        newInstance().clear()
        assertNull(newInstance().current())
        newInstance().setCurrent(tagA)
        assertEquals(tagA, newInstance().current(), "the store still works after a clear of nothing")
    }

    @Test
    fun theTagIsKeptVerbatimAndIsNeverTheSentinel() {
        newInstance().setCurrent(tagA)
        val read = newInstance().current()
        assertEquals(64, read?.length)
        assertNotEquals(UNOWNED_ACCOUNT, read)
    }
}
