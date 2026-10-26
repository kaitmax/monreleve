package ch.monreleve.app.contracts

import ch.monreleve.app.data.local.DossierCache
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-1a R566. THE DossierCache KDOC, AS TESTS, WRITTEN ONCE. Every implementation subclasses this and supplies
// [newInstance]; the contract runs unchanged on the JVM (against the in-memory reference) and on the iPhone
// simulator (against FileDossierCache). Android's SharedPrefsDossierCache lives in :app and needs a Context
// (:app has no Robolectric), so it cannot subclass this from here: its subclass is a one-file follow-up, REPORT
// IOS-1a QUESTIONS.
//
// [reset] empties the storage every instance made by [newInstance] reads from, so each test starts empty.
// [newInstance] returns a NEW object over the SAME storage, because the contract says a flag set through one
// instance is visible through any other (the sync worker and the screen are different objects).

abstract class DossierCacheContract {
    protected abstract fun reset()

    protected abstract fun newInstance(): DossierCache

    @BeforeTest
    fun emptyStorage() = reset()

    @Test
    fun loadReturnsNullForAYearNeverSavedEvenWhenOthersWere() {
        val cache = newInstance()
        assertNull(cache.load(2026))
        cache.save(2025, BODY_2025)
        assertNull(cache.load(2026))
    }

    @Test
    fun saveStoresTheServersBytesVerbatim() {
        val cache = newInstance()
        val awkward = "{\"titulaire\":\"Zoé \\\"Z\\\" Müller\",\"n\":[1,2]}\n  "
        cache.save(2026, awkward)
        assertEquals(awkward, newInstance().load(2026))
    }

    @Test
    fun saveReplacesThatYearAndLeavesOthersAlone() {
        val cache = newInstance()
        cache.save(2025, BODY_2025)
        cache.save(2026, "first")
        cache.save(2026, "second")
        assertEquals("second", cache.load(2026))
        assertEquals(BODY_2025, cache.load(2025))
    }

    @Test
    fun clearErasesEveryYearAndEveryFlag() {
        val cache = newInstance()
        cache.save(2025, BODY_2025)
        cache.save(2026, "x")
        cache.markStale(2025)
        cache.markStale(2027)
        cache.clear()
        assertNull(cache.load(2025))
        assertNull(cache.load(2026))
        assertFalse(cache.isStale(2025))
        assertFalse(cache.isStale(2027))
    }

    @Test
    fun clearOnAnEmptyCacheIsANoOp() {
        val cache = newInstance()
        cache.clear()
        cache.clear()
        assertNull(cache.load(2026))
    }

    @Test
    fun aYearNeverMarkedIsNotStale() {
        val cache = newInstance()
        cache.save(2026, "x")
        assertFalse(cache.isStale(2026))
        assertFalse(cache.isStale(2024))
    }

    @Test
    fun markStaleNeverTouchesTheBodyAndYearsAreIndependent() {
        val cache = newInstance()
        cache.save(2025, BODY_2025)
        cache.save(2026, "keep me")
        cache.markStale(2026)
        assertTrue(cache.isStale(2026))
        assertEquals("keep me", cache.load(2026))
        assertFalse(cache.isStale(2025))
        assertEquals(BODY_2025, cache.load(2025))
    }

    @Test
    fun markingAYearWithNoCopyIsAllowedCreatesNoBodyAndReadsStale() {
        val cache = newInstance()
        cache.markStale(2026)
        assertNull(cache.load(2026))
        assertTrue(cache.isStale(2026))
    }

    @Test
    fun markingAnAlreadyStaleYearIsANoOp() {
        val cache = newInstance()
        cache.save(2026, "body")
        cache.markStale(2026)
        cache.markStale(2026)
        assertTrue(cache.isStale(2026))
        assertEquals("body", cache.load(2026))
    }

    @Test
    fun saveClearsThatYearsFlagAndNoOtherYears() {
        val cache = newInstance()
        cache.save(2026, "old")
        cache.save(2025, BODY_2025)
        cache.markStale(2026)
        cache.markStale(2025)
        cache.save(2026, "new")
        assertFalse(cache.isStale(2026))
        assertEquals("new", cache.load(2026))
        assertTrue(cache.isStale(2025))
    }

    @Test
    fun theFlagIsVisibleThroughAnotherInstanceAtOnce() {
        val writer = newInstance()
        val reader = newInstance()
        writer.save(2026, "body")
        writer.markStale(2026)
        assertTrue(reader.isStale(2026))
        writer.save(2026, "fresh")
        assertFalse(reader.isStale(2026))
        assertEquals("fresh", reader.load(2026))
    }

    private companion object {
        const val BODY_2025 = "{\"generatedAt\":\"2025-12-31T23:00:00.000Z\"}"
    }
}
