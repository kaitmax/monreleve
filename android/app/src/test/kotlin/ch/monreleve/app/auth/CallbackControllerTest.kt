package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.IOException

// AN4 increment 4 (AC2). The callback state machine, driven with fakes so it runs
// as a JVM test. The two that matter most are MISMATCH (a valid link for an
// account this device did not request is refused and never exchanged - login-CSRF)
// and MALFORMED (a foreign host/scheme is refused before any network call). RED
// first: CallbackController did not exist.

private class FakeTokenStore : TokenStore {
    var saved: TokenPair? = null

    override fun save(pair: TokenPair) {
        saved = pair
    }

    override fun load(): TokenPair? = saved

    override fun clear() {
        saved = null
    }
}

private class RememberingPendingStore(initial: String?) : PendingSignInStore {
    private var value = initial
    var cleared = false

    override fun remember(email: String) {
        value = email
    }

    override fun pending(): String? = value

    override fun clear() {
        value = null
        cleared = true
    }
}

private class FakeAccountStore : AccountStore {
    var tag: String? = null

    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
    }

    override fun clear() {
        tag = null
    }
}

private class CbTransport(
    private val response: HttpResponse = HttpResponse(200, ""),
    private val throwable: Throwable? = null,
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse {
        throwable?.let { throw it }
        return response
    }
}

private const val OK_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2027-06-18T16:18:00.000Z","refreshExpiresAt":"2027-09-16T16:03:00.000Z"}"""
private const val VALID_URI = "https://monreleve.ch/api/v1/auth/callback?token=tok&email=a%40b.ch"

@Suppress("LongParameterList")
private fun controller(
    scope: CoroutineScope,
    store: TokenStore,
    pending: PendingSignInStore,
    response: HttpResponse = HttpResponse(200, OK_BODY),
    throwable: Throwable? = null,
    account: AccountStore = FakeAccountStore(),
): CallbackController {
    val api = AuthApi(CbTransport(response, throwable), "http://10.0.2.2:3000")
    return CallbackController(api, store, pending, scope, account)
}

@OptIn(ExperimentalCoroutinesApi::class)
class CallbackControllerTest : FunSpec({
    test("a valid link matching the pending email signs in, stores the pair, clears pending, sets the account") {
        runTest {
            val store = FakeTokenStore()
            val pending = RememberingPendingStore("a@b.ch")
            val account = FakeAccountStore()
            controller(this, store, pending, account = account).handle(VALID_URI)
            advanceUntilIdle()
            store.saved.shouldNotBeNull()
            store.saved?.accessToken shouldBe "acc"
            pending.cleared shouldBe true
            // AN-FIX F4 / R303: sign-in makes this account current, as the opaque tag of the link's address.
            account.current() shouldBe accountTagOf("a@b.ch")
            account.current().shouldNotBeNull()
        }
    }

    test("a foreign host is MALFORMED and never exchanges (no token stored)") {
        runTest {
            val store = FakeTokenStore()
            controller(this, store, RememberingPendingStore("a@b.ch"))
                .handle("https://evil.example/api/v1/auth/callback?token=t&email=a%40b.ch")
            advanceUntilIdle()
            store.saved.shouldBeNull()
        }
    }

    test("a valid link for a DIFFERENT account than requested is MISMATCH, never exchanges (login-CSRF)") {
        runTest {
            val store = FakeTokenStore()
            controller(this, store, RememberingPendingStore("victim@b.ch")).handle(VALID_URI)
            advanceUntilIdle()
            store.saved.shouldBeNull()
        }
    }

    test("no pending request is MISMATCH - the app must initiate sign-in") {
        runTest {
            val controller = controller(this, FakeTokenStore(), RememberingPendingStore(null))
            controller.handle(VALID_URI)
            advanceUntilIdle()
            controller.state.value.phase shouldBe CallbackPhase.MISMATCH
        }
    }

    test("a 400 is INVALID_LINK") {
        runTest {
            val body = """{"status":"error","code":"invalid_link"}"""
            val controller =
                controller(this, FakeTokenStore(), RememberingPendingStore("a@b.ch"), HttpResponse(400, body))
            controller.handle(VALID_URI)
            advanceUntilIdle()
            controller.state.value.phase shouldBe CallbackPhase.INVALID_LINK
        }
    }

    test("a network failure is NETWORK_ERROR") {
        runTest {
            val controller =
                controller(this, FakeTokenStore(), RememberingPendingStore("a@b.ch"), throwable = IOException("x"))
            controller.handle(VALID_URI)
            advanceUntilIdle()
            controller.state.value.phase shouldBe CallbackPhase.NETWORK_ERROR
        }
    }
})
