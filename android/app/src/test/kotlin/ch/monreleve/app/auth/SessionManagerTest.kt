package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.util.concurrent.atomic.AtomicInteger

// AN4 increment 5. Refresh (single-flight), the authenticated-call flow, and
// sign-out. The single-flight test is the one that matters: FW22's report records
// a TWO-way race passing against a broken implementation and only the ten-way
// catching it, so this fires TEN concurrent refreshes and asserts EXACTLY ONE
// rotation reached the server - a second refresh of a rotated token is a replay,
// and a replay would end the whole session (R210 turned against ourselves).

private const val EXP_A = "2027-06-18T16:18:00.000Z"
private const val EXP_R = "2027-09-16T16:03:00.000Z"

private fun pair(version: String): TokenPair = TokenPair("acc-$version", "ref-$version", EXP_A, EXP_R)

private const val ROTATED_BODY =
    """{"status":"ok","accessToken":"acc-v2","refreshToken":"ref-v2",""" +
        """"accessExpiresAt":"$EXP_A","refreshExpiresAt":"$EXP_R"}"""

private class MutableTokenStore(initial: TokenPair?) : TokenStore {
    private var pair: TokenPair? = initial

    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

/** Counts refresh calls and delays each, so ten concurrent callers overlap on the mutex. */
private class SlowRefreshTransport(
    val refreshCount: AtomicInteger = AtomicInteger(0),
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse {
        refreshCount.incrementAndGet()
        delay(DELAY_MS)
        return HttpResponse(HTTP_OK, ROTATED_BODY)
    }

    private companion object {
        const val DELAY_MS = 50L
        const val HTTP_OK = 200
    }
}

/** Routes by method/path so a test can script the GET, the refresh and the sign-out separately. */
private class RoutingTransport(
    private val onGet: () -> HttpResponse = { HttpResponse(200, "{}") },
    private val onRefresh: () -> HttpResponse = { HttpResponse(200, ROTATED_BODY) },
) : HttpTransport {
    val refreshCount = AtomicInteger(0)
    val signOutCount = AtomicInteger(0)

    override suspend fun execute(request: HttpRequest): HttpResponse =
        when {
            request.url.contains("/auth/refresh") -> {
                refreshCount.incrementAndGet()
                onRefresh()
            }
            request.url.contains("/auth/sign-out") -> {
                signOutCount.incrementAndGet()
                HttpResponse(200, "{}")
            }
            request.method == HttpMethod.GET -> onGet()
            else -> HttpResponse(200, "{}")
        }
}

private fun manager(
    transport: HttpTransport,
    store: TokenStore,
): SessionManager = SessionManager(AuthApi(transport, "http://10.0.2.2:3000"), store)

@OptIn(ExperimentalCoroutinesApi::class)
class SessionManagerTest : FunSpec({
    test("single-flight: ten concurrent refreshes rotate EXACTLY ONCE") {
        runTest {
            val transport = SlowRefreshTransport()
            val store = MutableTokenStore(pair("v1"))
            val session = manager(transport, store)

            val results = List(10) { async { session.refresh() } }.awaitAll()
            advanceUntilIdle()

            transport.refreshCount.get() shouldBe 1
            results.forEach { it.shouldBeInstanceOf<RefreshOutcome.Refreshed>() }
            store.load()?.refreshToken shouldBe "ref-v2"
        }
    }

    test("an authenticated call with a live token returns Ok") {
        runTest {
            val session =
                manager(RoutingTransport(onGet = { HttpResponse(200, "settings") }), MutableTokenStore(pair("v1")))
            session.authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.Ok("settings")
        }
    }

    test("an expired access token refreshes once and retries transparently") {
        runTest {
            val getCount = AtomicInteger(0)
            val transport =
                RoutingTransport(
                    onGet = {
                        if (getCount.getAndIncrement() == 0) {
                            HttpResponse(401, """{"code":"expired_token"}""")
                        } else {
                            HttpResponse(200, "settings")
                        }
                    },
                )
            val session = manager(transport, MutableTokenStore(pair("v1")))
            session.authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.Ok("settings")
            transport.refreshCount.get() shouldBe 1
        }
    }

    test("an expired token whose refresh fails is SessionExpired - an ordinary lapse") {
        runTest {
            val transport =
                RoutingTransport(
                    onGet = { HttpResponse(401, """{"code":"expired_token"}""") },
                    onRefresh = { HttpResponse(401, """{"code":"invalid_refresh_token"}""") },
                )
            val store = MutableTokenStore(pair("v1"))
            manager(transport, store).authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.SessionExpired
            store.load() shouldBe null
        }
    }

    test("revoked_session is SessionEnded (what a replay produces), distinct from an expiry, tokens cleared") {
        runTest {
            val transport = RoutingTransport(onGet = { HttpResponse(401, """{"code":"revoked_session"}""") })
            val store = MutableTokenStore(pair("v1"))
            manager(transport, store).authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.SessionEnded
            store.load() shouldBe null
        }
    }

    test("sign-out revokes server-side, clears local, and the next call has no session") {
        runTest {
            val transport = RoutingTransport()
            val store = MutableTokenStore(pair("v1"))
            val session = manager(transport, store)
            session.signOut()
            transport.signOutCount.get() shouldBe 1
            store.load() shouldBe null
            session.authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.NoSession
        }
    }
})
