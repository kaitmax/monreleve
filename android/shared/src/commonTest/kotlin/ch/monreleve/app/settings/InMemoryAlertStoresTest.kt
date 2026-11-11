package ch.monreleve.app.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2e R828. THE TWO NOTIFICATION STORES' IN-MEMORY IMPLEMENTATIONS, NOW IN commonMain, ASSERTED WHERE THEY LIVE.
//
// InMemoryThresholdAlertStore and InMemoryEveningNotificationStore moved to :shared with their interfaces,
// byte-identical (the SharedPreferences implementations stayed in :app, pinned there by ForcedSignOutTest's one
// in-memory detection file). Before this file nothing asserted the in-memory pair directly - every controller test
// built them as defaults - so this states their contract once, on every platform the shared code runs on: OFF and
// uncrossed by default (D19's safe default), each setter read back, "alerted today" answering only for the day it
// was marked, and AlertThreshold's two names in order (the SharedPreferences store writes the name and reads it back
// with valueOf).

class InMemoryAlertStoresTest {
    @Test
    fun theThresholdAlertStoreStartsOffAndUncrossedAndReadsBackWhatItIsGiven() {
        val store = InMemoryThresholdAlertStore()
        assertFalse(store.isEnabled(), "off by default")
        assertEquals(ThresholdCrossing(), store.crossing(), "neither threshold crossed by default")
        assertNull(store.activeThresholdToday("2026-06-15"), "nothing alerted by default")

        store.setEnabled(true)
        assertTrue(store.isEnabled(), "enabled")
        store.saveCrossing(ThresholdCrossing(fiscal = true, social = false))
        assertEquals(ThresholdCrossing(fiscal = true, social = false), store.crossing())
        store.markAlerted("2026-06-15", AlertThreshold.FISCAL)
        assertEquals(AlertThreshold.FISCAL, store.activeThresholdToday("2026-06-15"), "alerted today")
        assertNull(store.activeThresholdToday("2026-06-16"), "another day answers nothing")
        store.markAlerted("2026-06-16", AlertThreshold.SOCIAL)
        assertEquals(AlertThreshold.SOCIAL, store.activeThresholdToday("2026-06-16"), "the latest mark replaces")
        assertNull(store.activeThresholdToday("2026-06-15"), "the earlier day no longer answers")
        store.setEnabled(false)
        assertFalse(store.isEnabled(), "disabled again")
        val kept = store.crossing()
        assertEquals(ThresholdCrossing(fiscal = true, social = false), kept, "opting out keeps the crossing")
    }

    @Test
    fun theThresholdAlertStoreCanBeSeeded() {
        val store =
            InMemoryThresholdAlertStore(
                enabled = true,
                crossingState = ThresholdCrossing(fiscal = true, social = true),
                alertedDay = "2026-12-31",
                alertedThreshold = AlertThreshold.SOCIAL,
            )
        assertTrue(store.isEnabled())
        assertEquals(ThresholdCrossing(fiscal = true, social = true), store.crossing())
        assertEquals(AlertThreshold.SOCIAL, store.activeThresholdToday("2026-12-31"))
    }

    @Test
    fun alertThresholdHasItsTwoNamesInOrder() {
        assertEquals(listOf("FISCAL", "SOCIAL"), AlertThreshold.entries.map { it.name })
        assertEquals(AlertThreshold.SOCIAL, AlertThreshold.valueOf("SOCIAL"))
    }

    @Test
    fun theEveningStoreStartsOffAndNeverNotifiedAndReadsBackWhatItIsGiven() {
        val store = InMemoryEveningNotificationStore()
        assertFalse(store.isEnabled(), "off by default")
        assertNull(store.lastNotifiedDay(), "never notified by default")
        store.setEnabled(true)
        assertTrue(store.isEnabled())
        store.markNotified("2026-06-15")
        assertEquals("2026-06-15", store.lastNotifiedDay())
        store.markNotified("2026-06-16")
        assertEquals("2026-06-16", store.lastNotifiedDay(), "the latest day replaces")
        store.setEnabled(false)
        assertFalse(store.isEnabled())
        assertEquals("2026-06-16", store.lastNotifiedDay(), "opting out keeps the last day")

        val seeded = InMemoryEveningNotificationStore(enabled = true, lastDay = "2026-01-02")
        assertTrue(seeded.isEnabled())
        assertEquals("2026-01-02", seeded.lastNotifiedDay())
    }
}
