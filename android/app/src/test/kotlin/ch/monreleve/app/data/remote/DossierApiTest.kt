package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.DossierCache
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.test.runTest

// AN11 increments 1, 3. DossierApi against a scripted authenticated GET and a fake cache. R288: a 200 body
// is parsed and CACHED; a network failure falls back to the cache as a DATED copy; a session failure does
// NOT (the problem is the session, not connectivity); a body that will not parse is neither returned nor
// cached.

private const val YEAR = 2026

private val VALID_BODY =
    """
    {
      "taxYear": 2026,
      "period": { "fraction": 1.0, "startDate": null },
      "titulaire": "Camille Rey",
      "generatedAt": "2026-06-18T18:04:00.000Z",
      "canton": "GE",
      "employmentRate": 100,
      "denominatorKind": "SIMPLIFIED240",
      "tiles": { "workedDays": 240, "swissDays": 75, "teleworkDays": 43, "missionDays": 1 },
      "zone": {
        "declarableRate": 42.70, "rawRate": 43.60, "ratesDiffer": true,
        "fiscalCeilingDays": 96, "remainingToFiscal": 5.5, "remainingToSocial": 20, "warnings": []
      },
      "months": [],
      "annex": [],
      "absenceDays": 3,
      "recordedEntries": 5,
      "creditedMissionDays": 1,
      "rateWithoutMissions": 42.08
    }
    """.trimIndent()

private class FakeCache(seed: Map<Int, String> = emptyMap()) : DossierCache {
    val store = seed.toMutableMap()

    override fun load(year: Int): String? = store[year]

    override fun save(
        year: Int,
        body: String,
    ) {
        store[year] = body
        stale -= year
    }

    val stale = mutableSetOf<Int>()

    override fun clear() {
        store.clear()
        stale.clear()
    }

    override fun markStale(year: Int) {
        stale += year
    }

    override fun isStale(year: Int): Boolean = year in stale
}

class DossierApiTest : FunSpec({
    test("a 200 body is parsed, returned, and cached (R288)") {
        runTest {
            val cache = FakeCache()
            val api = DossierApi(get = { AuthedOutcome.Ok(VALID_BODY) }, cache = cache)

            val result = api.fetch(YEAR).shouldBeInstanceOf<DossierResult.Loaded>()
            result.document.titulaire shouldBe "Camille Rey"
            // The RAW body is cached, so the offline copy re-parses the server's own bytes (its date included).
            cache.store[YEAR] shouldBe VALID_BODY
        }
    }

    test("a network failure with a cache serves the cached copy, marked Cached (R288)") {
        runTest {
            val cache = FakeCache(mapOf(YEAR to VALID_BODY))
            val api = DossierApi(get = { AuthedOutcome.NetworkError }, cache = cache)

            val result = api.fetch(YEAR).shouldBeInstanceOf<DossierResult.Cached>()
            result.document.titulaire shouldBe "Camille Rey"
        }
    }

    test("a network failure with no cache is NetworkError, not a blank document") {
        runTest {
            val api = DossierApi(get = { AuthedOutcome.NetworkError }, cache = FakeCache())
            api.fetch(YEAR) shouldBe DossierResult.NetworkError
        }
    }

    test("an unparseable 200 is Unreadable and is NOT cached") {
        runTest {
            val cache = FakeCache()
            val api = DossierApi(get = { AuthedOutcome.Ok("this is not json") }, cache = cache)

            api.fetch(YEAR) shouldBe DossierResult.Unreadable
            cache.store.containsKey(YEAR) shouldBe false
        }
    }

    test("a corrupt cache on a network failure is NetworkError, never a half-parsed document") {
        runTest {
            val cache = FakeCache(mapOf(YEAR to "{ truncated"))
            val api = DossierApi(get = { AuthedOutcome.NetworkError }, cache = cache)

            api.fetch(YEAR) shouldBe DossierResult.NetworkError
        }
    }

    test("a session failure does NOT fall back to the cache - the session is the problem, not the network") {
        runTest {
            val cache = FakeCache(mapOf(YEAR to VALID_BODY))
            val api = DossierApi(get = { AuthedOutcome.SessionExpired }, cache = cache)

            api.fetch(YEAR) shouldBe DossierResult.SessionExpired
        }
    }

    test("R560: staleCopy is the cached document only while the year is stale, and never touches the network") {
        var gets = 0
        val cache = FakeCache(mapOf(YEAR to VALID_BODY))
        val api =
            DossierApi(
                get = {
                    gets++
                    AuthedOutcome.NetworkError
                },
                cache = cache,
            )

        // Fresh: no refresh is due.
        api.staleCopy(YEAR) shouldBe null
        cache.markStale(YEAR)
        api.staleCopy(YEAR)?.titulaire shouldBe "Camille Rey"
        // Another year is independent, and a stale year with no copy has nothing to show meanwhile.
        cache.markStale(YEAR - 1)
        api.staleCopy(YEAR - 1) shouldBe null
        // A copy that will not parse is never shown half-read.
        cache.store[YEAR] = "{ truncated"
        api.staleCopy(YEAR) shouldBe null
        gets shouldBe 0
    }

    test("R559: a fetched body clears the year's stale flag; a refused or failed fetch leaves it") {
        runTest {
            val cache = FakeCache(mapOf(YEAR to VALID_BODY))
            cache.markStale(YEAR)
            DossierApi(get = { AuthedOutcome.NetworkError }, cache = cache).fetch(YEAR)
            cache.isStale(YEAR) shouldBe true
            DossierApi(get = { AuthedOutcome.Ok("this is not json") }, cache = cache).fetch(YEAR)
            cache.isStale(YEAR) shouldBe true
            DossierApi(get = { AuthedOutcome.Ok(VALID_BODY) }, cache = cache).fetch(YEAR)
            cache.isStale(YEAR) shouldBe false
        }
    }
})
