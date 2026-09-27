package ch.monreleve.app.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

// AN4 increment 2. The real Keystore round-trip. KeystoreTokenStore uses the
// AndroidKeyStore, which does not exist under a plain JVM unit test (it needs the
// device runtime), so this is an instrumented test - run on the emulator, not by
// `./gradlew test` (the gate names connectedDebugAndroidTest among what it skips
// for that reason). It proves save -> load returns the same pair through real
// AES-256-GCM encryption, that clear() drops it, and that an empty store loads
// null.
@RunWith(AndroidJUnit4::class)
class KeystoreTokenStoreInstrumentedTest {
    private lateinit var store: KeystoreTokenStore

    private val pair =
        TokenPair(
            accessToken = "access-abc-123",
            refreshToken = "refresh-xyz-789",
            accessExpiresAt = "2027-06-18T16:18:00.000Z",
            refreshExpiresAt = "2027-09-16T16:03:00.000Z",
        )

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        store = KeystoreTokenStore(context)
        store.clear()
    }

    @After
    fun tearDown() {
        store.clear()
    }

    @Test
    fun savedPairRoundTripsThroughKeystoreEncryption() {
        store.save(pair)
        assertEquals(pair, store.load())
    }

    @Test
    fun clearRemovesThePairSoTheNextLoadIsNull() {
        store.save(pair)
        store.clear()
        assertNull(store.load())
    }

    @Test
    fun loadWithoutASaveIsNull() {
        assertNull(store.load())
    }
}
