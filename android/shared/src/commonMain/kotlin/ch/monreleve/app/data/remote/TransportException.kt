package ch.monreleve.app.data.remote

/**
 * A failure to REACH or READ FROM the server. KMP-1b / R386.
 *
 * ============================================================================
 * WHY THIS TYPE EXISTS
 * ============================================================================
 *
 * Before KMP-1, AuthApi caught `java.io.IOException` - the JVM's name for
 * "the network did not work" - and turned it into ApiFailure.Network. That
 * name cannot be spoken in commonMain, which is the entire point of the
 * module, and Kotlin's common stdlib has no transport-failure supertype to
 * put in its place.
 *
 * KMP-1 reached for the only thing available, `catch (e: Exception)`, and it
 * is too wide in two directions that matter:
 *
 *   CANCELLATION. In a coroutine, cancelling a job throws
 *   CancellationException inside it, and `Exception` catches it. A sign-in
 *   whose screen was left, or a sync whose worker was stopped, returned
 *   Failed(Network) and the caller carried on instead of the job ending
 *   cancelled.
 *
 *   BUGS. An IllegalStateException or an NPE inside the try was reported to
 *   the caller as "network unreachable" - a programming error wearing a
 *   connectivity problem's clothes, which is the most expensive kind of
 *   misreport because it sends the reader to check their wifi.
 *
 * ============================================================================
 * THE SEAM OWNS THE TRANSLATION, NOT THE CALLER
 * ============================================================================
 *
 * The fix is not a wider catch written more carefully. It is that the only
 * code which KNOWS what a transport failure looks like on a given platform is
 * the transport itself:
 *
 *   UrlConnectionTransport (:app, JVM/Android) wraps IOException and its
 *   subclasses - exactly what HttpsURLConnection is documented to throw.
 *
 *   A future iOS transport wraps its NSError-derived throwables the same way.
 *
 * So AuthApi catches THIS, and nothing wider. Anything else escaping a
 * transport is a bug in that transport, and it propagates as one.
 *
 * `cause` is preserved at every wrap. It is the only remaining way to see the
 * platform exception, and a log that says "unreachable" with no cause is a
 * support conversation that cannot start.
 */
class TransportException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
