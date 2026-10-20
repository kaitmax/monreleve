package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// KMP-3 (R451). SIGN-OUT WIPES LOCALLY WHEN THE SERVER REVOKE *FAILS*, NOT ONLY WHEN IT IS CANCELLED.
//
// R451 names four cases the session has to keep across the move to :shared. Three were already
// pinned - SessionManagerTest covers refresh-on-expiry, refresh-failure-is-an-expiry and the
// ten-way single-flight race; SignOutNotCancellableTest covers a sign-out CANCELLED mid-revoke.
// The fourth, a revoke that FAILS, had no test: the two are different code paths and only one
// of them was proven.
//
// THEY LOOK ALIKE AND THEY ARE NOT. A cancellation unwinds through SessionManager's own
// `finally`, which KMP-1b wrapped in NonCancellable precisely so the wipe survives it. A
// NETWORK failure never reaches that machinery at all: AuthApi.signOut catches
// TransportException and returns false, so SessionManager sees an ordinary return and the
// wipe runs on the normal path. Each half rests on a different line, and a change to either -
// a runCatching removed here, a throw introduced there - leaves the other green.
//
// WHY IT MATTERS ON A PHONE RATHER THAN IN A SUITE. Signing out on a train is the ordinary
// case, not the exotic one. If an unreachable server left the tokens on the device, the person
// who believed they had signed out of a shared phone would be wrong, and nothing would say so.
// The server expires the token on its own schedule; the DEVICE is the half we promise.
//
// THIS TEST IS WRITTEN AGAINST THE CURRENT :app SessionManager AND IS NOT EDITED WHEN IT MOVES
// (R451: "same tests, unedited, on common code"). It names no package-private detail: it drives
// the real SessionManager through a transport that cannot connect.

/** A transport that cannot reach anything - the whole of "the revoke failed". */
private class UnreachableTransport : HttpTransport {
    var attempts = 0

    override suspend fun execute(request: HttpRequest): HttpResponse {
        attempts++
        throw TransportException("no route to host")
    }
}

/** This file's own store: the other fake stores in :app's test sources are private to their files. */
private class RevokeFailureFakeStore(private var pair: TokenPair? = null) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignOutWipesOnRevokeFailureTest {
    @Test
    fun signOutWipesTheDeviceWhenTheServerCannotBeReached() =
        runTest {
            val transport = UnreachableTransport()
            val store = RevokeFailureFakeStore(TokenPair("access", "refresh", "0", "0"))
            val session = SessionManager(AuthApi(transport, "https://example.test"), store)

            session.signOut()

            // THE POSITIVE CONTROL FIRST. Without it this test passes against a sign-out that
            // never tried to revoke at all - "the tokens are gone" is satisfied perfectly by a
            // method that skips the network and clears, which is NOT what the product does and
            // not what this is asserting (R133: an absence assertion needs presence established).
            assertTrue(
                "the revoke was never attempted, so nothing was proven about its failure",
                transport.attempts > 0,
            )
            assertNull("the server was unreachable and the tokens stayed on the device", store.load())
        }

    @Test
    fun signOutWithNoStoredSessionStillTouchesNothingAndLeavesTheStoreEmpty() =
        runTest {
            val transport = UnreachableTransport()
            val store = RevokeFailureFakeStore(null)
            val session = SessionManager(AuthApi(transport, "https://example.test"), store)

            session.signOut()

            // The other direction of the same guarantee: with no pair there is nothing to revoke,
            // so the network is not touched - and the store is still empty afterwards rather than
            // the call throwing on a null token.
            assertTrue("a sign-out with no session must not call the server", transport.attempts == 0)
            assertNull(store.load())
        }
}
