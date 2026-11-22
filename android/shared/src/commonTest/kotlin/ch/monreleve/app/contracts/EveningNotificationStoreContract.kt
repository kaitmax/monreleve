package ch.monreleve.app.contracts

import ch.monreleve.app.settings.EveningNotificationStore
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-SHELL-2 (R1337, iOS Ruling 13). THE EveningNotificationStore KDOC, AS TESTS, WRITTEN ONCE - the shape the other
// store contracts have (SettingsStoreContract): the JVM runs it against the in-memory reference
// (ReferenceContractTests.kt), and the simulator against iOS's persistent store (UserDefaultsEveningNotificationStore,
// iosTest ImplementationContractTests.kt). "Another instance" is what a relaunch reads: a store that kept the opt-in
// only in memory - IOS-SHELL-1's DEVIATION 7 - fails the round-trip tests below.

abstract class EveningNotificationStoreContract {
    protected abstract fun reset()

    /** A store over the SAME storage as every other instance this test made (a relaunch's view of it). */
    protected abstract fun newInstance(): EveningNotificationStore

    @BeforeTest
    fun emptyStorage() = reset()

    @Test
    fun theOptInIsOffByDefaultAndNoDayWasNotified() {
        val store = newInstance()
        assertFalse(store.isEnabled(), "D19's safe default: off until the person opts in")
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun anOptInRoundTripsThroughAnotherInstance() {
        newInstance().setEnabled(true)
        assertTrue(newInstance().isEnabled(), "the opt-in outlives the instance that wrote it")
        newInstance().setEnabled(false)
        assertFalse(newInstance().isEnabled(), "turning it off is read back too")
    }

    @Test
    fun theLastNotifiedDayRoundTripsAndIsReplaced() {
        newInstance().markNotified("2026-11-16")
        assertEquals("2026-11-16", newInstance().lastNotifiedDay())
        newInstance().markNotified("2026-11-17")
        assertEquals("2026-11-17", newInstance().lastNotifiedDay())
    }

    @Test
    fun theOptInAndTheDayAreIndependent() {
        val store = newInstance()
        store.markNotified("2026-11-16")
        store.setEnabled(true)
        store.setEnabled(false)
        assertEquals("2026-11-16", newInstance().lastNotifiedDay(), "switching off does not forget the day")
        assertFalse(newInstance().isEnabled())
    }
}
