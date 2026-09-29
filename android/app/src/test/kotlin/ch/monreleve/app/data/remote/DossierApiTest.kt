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
      "recordedEntries": 5
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
    }

    override fun clear() = store.clear()
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
})
