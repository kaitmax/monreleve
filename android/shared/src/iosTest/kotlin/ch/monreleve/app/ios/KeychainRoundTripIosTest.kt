package ch.monreleve.app.ios

import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-HOST R1212 (1). THE ROUND-TRIP THE APP HOST'S PROBE RUNS, pinned here first on the simulator test binary
// (entitlements in its __TEXT,__entitlements section, IOS-1a R565), so the app's -probe launch measures only what is
// new there: the ad-hoc-signed bundle. Every pair below is a FAKE made up here - no server issued it.

class KeychainRoundTripIosTest {
    private val service = uniqueName("ch.monreleve.app.iosHostProbeTest")

    private val fake =
        TokenPair(
            accessToken = "fake-access-not-a-token",
            refreshToken = "fake-refresh-not-a-token",
            accessExpiresAt = "2000-01-01T00:00:00Z",
            refreshExpiresAt = "2000-01-02T00:00:00Z",
        )

    @AfterTest
    fun leaveNothingBehind() = KeychainTokenStore(service).clear()

    @Test
    fun theRealKeychainStoreSavesReadsBackEqualAndClears() {
        val store = KeychainTokenStore(service)

        val result = keychainRoundTrip(store, fake)

        assertEquals(0, result.saveStatus, "save returned (no KeychainException)")
        assertTrue(result.loadedEqual, "the pair read back equals the pair saved")
        assertTrue(result.clearedToNull, "after clear, load is null")
        assertTrue(result.passed, "the positive signal")
        assertNull(store.load(), "the round-trip leaves no item behind")
    }

    @Test
    fun aRefusedSaveIsReportedByItsStatusAndDoesNotThrow() {
        val refusing = FakeStore(saveRefusal = MISSING_ENTITLEMENT)

        val result = keychainRoundTrip(refusing, fake)

        assertEquals(MISSING_ENTITLEMENT, result.saveStatus, "the OSStatus of the refusal, by number")
        assertFalse(result.passed, "a refused save is not a pass")
    }

    @Test
    fun aPairThatComesBackDifferentIsNotAPass() {
        val wrong = fake.copy(refreshToken = "fake-refresh-other")
        val store = FakeStore(loads = wrong)

        val result = keychainRoundTrip(store, fake)

        assertEquals(0, result.saveStatus)
        assertFalse(result.loadedEqual, "the comparison is real: a different pair is not equal")
        assertFalse(result.passed)
    }

    private class FakeStore(
        private val saveRefusal: Int? = null,
        private val loads: TokenPair? = null,
    ) : TokenStore {
        private var cleared = false

        override fun save(pair: TokenPair) {
            saveRefusal?.let { throw KeychainException(it) }
        }

        override fun load(): TokenPair? = if (cleared) null else loads

        override fun clear() {
            cleared = true
        }
    }

    private companion object {
        /** errSecMissingEntitlement - the refusal IOS-1a met for an unsigned test binary. */
        const val MISSING_ENTITLEMENT = -34018
    }
}
