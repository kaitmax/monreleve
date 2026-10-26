package ch.monreleve.app.contracts

import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-1a R566. THE SettingsStore KDOC, AS TESTS, WRITTEN ONCE (see DossierCacheContract for how it is used and
// why Android's SharedPrefs implementation cannot subclass it from :shared).

abstract class SettingsStoreContract {
    protected abstract fun reset()

    protected abstract fun newInstance(): SettingsStore

    @BeforeTest
    fun emptyStorage() = reset()

    private val full =
        Settings(
            canton = "GE",
            employmentRate = 80,
            denominatorKind = "EXACT",
            exactTotalWorkDays = 218,
            granularity = "DAY",
            activityStartDate = "2026-03-01",
            name = "Zoé Müller",
        )

    @Test
    fun loadIsNullUntilACompleteSetIsSavedAndNotOnboarded() {
        val store = newInstance()
        assertNull(store.load())
        assertFalse(store.isOnboarded())
    }

    @Test
    fun aSavedSetRoundTripsFieldForField() {
        val store = newInstance()
        store.save(full)
        assertEquals(full, newInstance().load())
    }

    @Test
    fun absentAndNullStayNullNotZeroNotEmptyNotADefaultDate() {
        val store = newInstance()
        store.save(full.copy(exactTotalWorkDays = null, activityStartDate = null, name = null))
        val loaded = newInstance().load()
        assertNull(loaded?.exactTotalWorkDays)
        assertNull(loaded?.activityStartDate)
        assertNull(loaded?.name)
        assertEquals("GE", loaded?.canton)
    }

    @Test
    fun saveReplacesTheWholeSetWithNoMerge() {
        val store = newInstance()
        store.save(full)
        store.save(full.copy(canton = "VD", exactTotalWorkDays = null))
        val loaded = store.load()
        assertEquals("VD", loaded?.canton)
        assertNull(loaded?.exactTotalWorkDays)
        assertEquals(80, loaded?.employmentRate)
    }

    @Test
    fun clearErasesEveryFieldAndIsANoOpWhenEmpty() {
        val store = newInstance()
        store.clear()
        store.save(full)
        store.clear()
        assertNull(newInstance().load())
        assertFalse(newInstance().isOnboarded())
        store.clear()
    }

    @Test
    fun isOnboardedFollowsTheOneCompletenessDefinition() {
        val store = newInstance()
        store.save(full)
        assertTrue(store.isOnboarded())
        store.save(full.copy(name = null))
        assertFalse(store.isOnboarded())
    }
}
