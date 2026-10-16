package ch.monreleve.app.data.remote

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

//
// KMP-1b / R388: cancelling a sign-in cancels it.
//
// ============================================================================
// THE BUG, AND WHY 29 GOLDEN TESTS COULD NOT SEE IT
// ============================================================================
//
// In a coroutine, cancelling a job throws CancellationException INSIDE it. The
// pre-KMP-1 AuthApi caught `IOException`, which does not include it, so a
// cancelled call unwound as a cancellation should.
//
// KMP-1 moved AuthApi to commonMain, where `java.io.IOException` cannot be
// named, and widened all eight catches to `Exception` - which DOES include
// CancellationException. From that commit, leaving the sign-in screen or
// stopping the sync worker made the in-flight call return
// Failed(ApiFailure.Network) and the caller carry on, instead of the job
// ending cancelled.
//
// The goldens test BYTES. This is CONTROL FLOW, so all 29 stayed green, and a
// class-level @Suppress("TooGenericExceptionCaught") kept detekt quiet about
// the shape that caused it.
//
// ============================================================================
// ONE OF THESE SITES WAS ALREADY BROKEN BEFORE KMP-1
// ============================================================================
//
// `signOut` has always been `runCatching { transport.execute(...) }`
// (pre-KMP-1 AuthApi.kt:357, today AuthApi.kt:441). `runCatching` catches
// Throwable, and `execute` is a SUSPEND function, so that one swallowed
// cancellation before the move too.
//
// So the fix there is a BEHAVIOUR CHANGE, not a restoration, and it is called
// out as such in REPORT-KMP-1b.txt. A sign-out whose scope is cancelled now
// ends cancelled rather than reporting `false`.
//

/** Suspends until the test releases it, so a call can be cancelled while in flight. */
private class HangingTransport : HttpTransport {
    val entered = CompletableDeferred<Unit>()
    private val never = CompletableDeferred<HttpResponse>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        entered.complete(Unit)

        return never.await()
    }
}

/** Throws whatever the test hands it, on the first call. */
private class ThrowingTransport(private val error: Throwable) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse = throw error
}

private const val BASE = "https://example.test"

@OptIn(ExperimentalCoroutinesApi::class)
class CancellationTest {
    // -----------------------------------------------------------------------
    // 1. CANCELLATION PROPAGATES
    // -----------------------------------------------------------------------

    @Test
    fun cancellingAnInFlightSignInCancelsTheJob() =
        runTest {
            val transport = HangingTransport()
            val api = AuthApi(transport, BASE)

            // THE FLAG, NOT job.isCancelled. The first version of this test
            // asserted isCancelled and PASSED on the broken code, because
            // cancel() marks the job the instant it is CALLED - whatever the
            // body then does. It was satisfied by cancellation being
            // requested, never by its being honoured.
            //
            // If AuthApi swallows the CancellationException and returns
            // Failed, the line after the call still runs, so this flag is the
            // signal that the call RETURNED instead of unwinding.
            var returned = false
            val job =
                launch {
                    api.requestMagicLink("a@b.ch")
                    returned = true
                }

            transport.entered.await()
            job.cancel()
            yield()

            assertFalse(returned, "a cancelled sign-in returned a result instead of being cancelled")
        }

    @Test
    fun cancellingAnInFlightSignOutCancelsTheJob() =
        runTest {
            // THE SITE THAT WAS BROKEN BEFORE KMP-1 TOO: runCatching around a
            // suspend call. See the file header - this one is a behaviour
            // change rather than a restoration.
            val transport = HangingTransport()
            val api = AuthApi(transport, BASE)

            var returned = false
            val job =
                launch {
                    api.signOut("token")
                    returned = true
                }

            transport.entered.await()
            job.cancel()
            yield()

            assertFalse(returned, "a cancelled sign-out returned false instead of being cancelled")
        }

    // -----------------------------------------------------------------------
    // 2. A TRANSPORT FAILURE IS STILL A NETWORK FAILURE - UNCHANGED OUTCOMES
    // -----------------------------------------------------------------------

    @Test
    fun aTransportExceptionIsStillReportedAsANetworkFailure() =
        runTest {
            // R387's other direction (R196): narrowing the catch must not stop
            // a genuine transport failure being reported exactly as before.
            val api = AuthApi(ThrowingTransport(TransportException("unreachable")), BASE)

            assertTrue(
                api.requestMagicLink("a@b.ch") is MagicLinkResult.Failed,
                "a TransportException must still become Failed(Network)",
            )
            assertTrue(
                api.exchangeCode("a@b.ch", "000000") is CodeExchangeResult.Failed,
                "a TransportException must still become Failed(Network)",
            )
            assertEquals(
                false,
                api.signOut("token"),
                "signOut reports false on a transport failure, as it always has",
            )
        }

    // -----------------------------------------------------------------------
    // 3. A BUG IS NOT A NETWORK FAILURE
    // -----------------------------------------------------------------------

    @Test
    fun aNonTransportExceptionIsNotTurnedIntoANetworkFailure() =
        runTest {
            // The cost of the broad catch, stated as a test: an
            // IllegalStateException inside the try was reported to the caller
            // as "network unreachable", so a programming error read as a
            // connectivity problem. It must propagate.
            val api = AuthApi(ThrowingTransport(IllegalStateException("a bug, not the network")), BASE)

            assertFailsWith<IllegalStateException> { api.requestMagicLink("a@b.ch") }
        }

    @Test
    fun aNonTransportExceptionPropagatesOutOfSignOutToo() =
        runTest {
            val api = AuthApi(ThrowingTransport(IllegalStateException("a bug, not the network")), BASE)

            assertFailsWith<IllegalStateException> { api.signOut("token") }
        }
}
