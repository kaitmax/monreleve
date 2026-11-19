package ch.monreleve.app.data.remote

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * KMP-1b / R386: the transport translates its platform failure, and keeps the cause.
 *
 * WHY THIS LIVES IN :app. UrlConnectionTransport is the JVM/Android implementation of the
 * HttpTransport seam - it is the only code that knows what "the network did not work" looks
 * like on this platform, which is precisely why the translation belongs to it and not to
 * AuthApi. commonTest cannot reach it.
 *
 * WHY A REFUSED CONNECTION AND NOT A MOCK SERVER. KMP-1b may not add a dependency, and a
 * connection to a port nothing listens on is a real IOException raised by the real
 * HttpURLConnection - which is the thing under test. Port 1 is reserved and unused; the
 * timeouts are set short so a hostile environment fails fast rather than hanging the suite.
 */
class UrlConnectionTransportWrapTest {
    private val unreachable =
        HttpRequest(method = HttpMethod.GET, url = "http://127.0.0.1:1/api/v1/auth/magic-link")

    @Test
    fun aRefusedConnectionBecomesATransportException() =
        runTest {
            val transport = UrlConnectionTransport(connectTimeoutMs = 500, readTimeoutMs = 500)

            var thrown: Throwable? = null
            try {
                transport.execute(unreachable)
            } catch (e: Throwable) {
                thrown = e
            }

            assertNotNull("the transport returned instead of failing", thrown)
            assertTrue(
                "expected TransportException, got ${thrown!!::class.simpleName}: ${thrown.message}",
                thrown is TransportException,
            )
        }

    @Test
    fun thePlatformExceptionIsReachableFromTheCauseChain() =
        runTest {
            // R386: the cause is the only remaining way to see WHICH IOException this was.
            // A log that says "unreachable" with no cause is a support conversation that
            // cannot start.
            //
            // THE CHAIN IS WALKED, NOT READ ONE LEVEL DEEP, and the first version of this
            // test failed because it read one level. kotlinx-coroutines performs STACK-TRACE
            // RECOVERY across a dispatcher boundary: crossing withContext(Dispatchers.IO) it
            // copies the thrown exception and sets the ORIGINAL as the copy's cause. So the
            // caller sees TransportException -> TransportException -> ConnectException, and
            // asserting cause is IOException reported "was TransportException".
            //
            // Walking is also the right assertion on its own terms: what matters is that the
            // platform exception is REACHABLE for a log, not how many frames the coroutine
            // machinery inserted on the way.
            val transport = UrlConnectionTransport(connectTimeoutMs = 500, readTimeoutMs = 500)

            var thrown: Throwable? = null
            try {
                transport.execute(unreachable)
            } catch (e: Throwable) {
                thrown = e
            }

            val chain = generateSequence(thrown) { it.cause }.toList()

            assertTrue(
                "no IOException anywhere in the cause chain: " +
                    chain.joinToString(" -> ") { it::class.java.simpleName },
                chain.any { it is IOException },
            )
        }

    // AN-API36-PASS (R1082): the BYTES path keeps the same contract. executeForBytes (the PDF and CSV exports,
    // AN11) had no IOException translation, so a refused connection or a read timeout escaped as a raw
    // IOException past AuthApi.authenticatedGetBytes - which catches TransportException and nothing wider (R387) -
    // and crashed the app on Dispatchers.Main. Found on the emulator API 36: "Exporter en PDF" offline ->
    // FATAL java.net.ConnectException, and a 14 993 ms cold render -> FATAL SocketTimeoutException.
    @Test
    fun aRefusedConnectionOnTheBytesPathBecomesATransportException() =
        runTest {
            val transport = UrlConnectionTransport(connectTimeoutMs = 500, readTimeoutMs = 500)

            var thrown: Throwable? = null
            try {
                transport.executeForBytes(unreachable)
            } catch (e: Throwable) {
                thrown = e
            }

            assertNotNull("the bytes transport returned instead of failing", thrown)
            assertTrue(
                "expected TransportException, got ${thrown!!::class.simpleName}: ${thrown.message}",
                thrown is TransportException,
            )
            val chain = generateSequence(thrown) { it.cause }.toList()
            assertTrue(
                "no IOException anywhere in the cause chain: " +
                    chain.joinToString(" -> ") { it::class.java.simpleName },
                chain.any { it is IOException },
            )
        }
}
