package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2a R770. THE PLATFORM-FREE HALF OF THE CALLBACK, ON ITS CONTRACT (SignInLink.kt) - on the JVM and on the iOS
// simulator. What a platform's receipt hands over decides MALFORMED (null); everything after it is shared: MISMATCH
// against the pending address (trimmed, lower-cased, the login-CSRF defence), the exchange to the app's OWN base
// URL, and SIGNED's side effects in the code screen's order. Written with the move - the seam did not exist before
// it; CallbackControllerTest (:app, unedited) still drives the whole Android path through the received URI.

private const val BASE = "http://test.invalid"
private const val LINK_PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2026-06-15T11:00:00Z","refreshExpiresAt":"2026-09-13T10:00:00Z"}"""

private class LinkTransport(
    private val response: HttpResponse,
    private val failWith: String? = null,
) : HttpTransport {
    val asked = mutableListOf<HttpRequest>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        asked += request
        failWith?.let { throw TransportException(it) }
        return response
    }
}

private class LinkStores(
    pendingAddress: String?,
) : PendingSignInStore,
    TokenStore,
    AccountStore {
    val events = mutableListOf<String>()
    var pendingValue: String? = pendingAddress
    var pair: TokenPair? = null
    var tag: String? = null

    override fun remember(email: String) {
        pendingValue = email
    }

    override fun pending(): String? = pendingValue

    override fun save(pair: TokenPair) {
        this.pair = pair
        events += "save"
    }

    override fun load(): TokenPair? = pair

    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
        events += "account"
    }

    override fun clear() {
        // PendingSignInStore, TokenStore and AccountStore all declare clear(); only the pending one is cleared here.
        pendingValue = null
        events += "clear"
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignInLinkStateTest {
    private fun TestScope.callback(
        transport: LinkTransport,
        stores: LinkStores,
    ) = CallbackController(
        AuthApi(transport, BASE),
        stores,
        stores,
        this,
        stores,
        syncNow = { stores.events += "sync" },
    )

    @Test
    fun noLinkIsMalformedAndAsksNothing() =
        runTest {
            val transport = LinkTransport(HttpResponse(200, LINK_PAIR_BODY))
            val controller = callback(transport, LinkStores("a@b.ch"))
            controller.handleLink(null)
            runCurrent()
            assertEquals(CallbackPhase.MALFORMED, controller.state.value.phase)
            assertTrue(transport.asked.isEmpty())
        }

    @Test
    fun aLinkForAnotherAddressOrWithNothingPendingIsMismatchAndAsksNothing() =
        runTest {
            for (pending in listOf("victim@b.ch", null)) {
                val transport = LinkTransport(HttpResponse(200, LINK_PAIR_BODY))
                val stores = LinkStores(pending)
                val controller = callback(transport, stores)
                controller.handleLink(SignInLink(token = "tok", email = "a@b.ch"))
                runCurrent()
                assertEquals(CallbackPhase.MISMATCH, controller.state.value.phase, "pending = $pending")
                assertTrue(transport.asked.isEmpty())
                assertNull(stores.pair)
            }
        }

    @Test
    fun aMatchingLinkSignsInToTheAppsOwnServerInTheCodeScreensOrder() =
        runTest {
            val transport = LinkTransport(HttpResponse(200, LINK_PAIR_BODY))
            val stores = LinkStores("a@b.ch")
            val controller = callback(transport, stores)
            controller.handleLink(SignInLink(token = "t k", email = " A@B.ch"))
            assertEquals(CallbackPhase.WORKING, controller.state.value.phase)
            runCurrent()
            assertEquals(CallbackPhase.SIGNED, controller.state.value.phase)
            assertEquals("$BASE/api/v1/auth/callback?token=t+k&email=+A%40B.ch", transport.asked.single().url)
            assertEquals("acc", stores.pair?.accessToken)
            assertEquals(accountTagOf("a@b.ch"), stores.tag)
            assertNull(stores.pendingValue)
            assertEquals(listOf("save", "account", "clear", "sync"), stores.events)
        }

    @Test
    fun eachExchangeRefusalHasItsPhase() =
        runTest {
            val cases =
                listOf(
                    LinkTransport(HttpResponse(400, """{"status":"error","code":"invalid_link"}""")) to
                        CallbackPhase.INVALID_LINK,
                    LinkTransport(HttpResponse(500, "")) to CallbackPhase.GENERIC_ERROR,
                    LinkTransport(HttpResponse(200, LINK_PAIR_BODY), failWith = "no route") to
                        CallbackPhase.NETWORK_ERROR,
                )
            for ((transport, expected) in cases) {
                val stores = LinkStores("a@b.ch")
                val controller = callback(transport, stores)
                controller.handleLink(SignInLink(token = "tok", email = "a@b.ch"))
                runCurrent()
                assertEquals(expected, controller.state.value.phase)
                assertNull(stores.pair)
                assertEquals("a@b.ch", stores.pendingValue, "a refused link leaves the request pending")
            }
        }
}
