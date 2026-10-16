package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import org.junit.Assert.assertNull
import org.junit.Test

// KMP-1b: SIGNING OUT IS A PROMISE ABOUT THE DEVICE, AND CANCELLATION MUST NOT BREAK IT.
//
// R387 made AuthApi propagate CancellationException instead of swallowing it - correct
// coroutine behaviour, and the change that exposed this. SessionManager.signOut read:
//
//     val pair = tokenStore.load()
//     if (pair != null) api.signOut(pair.accessToken)   <- cancellable server call
//     tokenStore.clear()                                 <- the wipe, skipped on cancel
//
// The wipe was only ever safe because api.signOut's runCatching swallowed the
// cancellation. Once it propagated, a person who taps "Se deconnecter" and leaves the
// screen - cancelling the scope mid-request - keeps their tokens on the device.
//
// This test is the one that would have caught it: cancel DURING the revoke, then assert
// the store is empty. It is written against the real SessionManager, not a fake of it.

/** This file's own store: the other FakeTokenStores in :app test sources are private. */
private class SignOutFakeStore(private var pair: TokenPair? = null) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

/** Hangs inside the revoke so the job can be cancelled while the request is in flight. */
private class HangingTransport : HttpTransport {
    val entered = CompletableDeferred<Unit>()
    private val never = CompletableDeferred<HttpResponse>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        entered.complete(Unit)

        return never.await()
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignOutNotCancellableTest {
    @Test
    fun cancellingDuringTheRevokeStillWipesTheTokens() =
        runTest {
            val transport = HangingTransport()
            val store = SignOutFakeStore(TokenPair("access", "refresh", "0", "0"))

            val session = SessionManager(AuthApi(transport, "https://example.test"), store)

            val job = launch { session.signOut() }

            transport.entered.await()
            job.cancel()
            yield()

            // THE ASSERTION. Before the NonCancellable finally, the clear never ran and this
            // returned the saved pair - the tokens the person believed they had just removed.
            assertNull("sign-out was cancelled and left the tokens on the device", store.load())
        }
}
