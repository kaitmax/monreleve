package ch.monreleve.app.ios

import ch.monreleve.app.data.remote.HttpBytesResponse
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSData
import platform.Foundation.NSError
import platform.Foundation.dataTaskWithRequest
import platform.Foundation.NSHTTPURLResponse
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSURL
import platform.Foundation.NSURLRequestReloadIgnoringCacheData
import platform.Foundation.NSURLResponse
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration
import platform.Foundation.NSURLSessionDataTask
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// IOS-1a R564. THE iOS HttpTransport: NSURLSession through Kotlin/Native's platform interop, no Ktor.
//
// THE CONTRACT IT KEEPS (HttpTransport, TransportException):
//   - a failure to REACH or READ FROM the server - an NSError of any domain or code - becomes
//     TransportException with the NSError kept as the cause (R386). Nothing else is caught: a bug in this file
//     propagates as a bug.
//   - a CANCELLED coroutine cancels the NSURLSessionTask (cancel() on the task, from invokeOnCancellation), so a
//     sign-in whose screen was left stops using the radio. CancellationException is never turned into a
//     TransportException.
//   - the body is the bytes handed in and the bytes the server sent, untouched; headers go on as given.
//
// TIMEOUTS, NAMED AND JUSTIFIED. Android sets connectTimeout = readTimeout = 15,000 ms
// (UrlConnectionTransport). NSURLSession has no separate connect timeout: timeoutIntervalForRequest is the longest
// the connection may sit with NO bytes moving (it covers connect and each read), which is exactly the pair above,
// so it is [REQUEST_TIMEOUT_SECONDS] = 15. timeoutIntervalForResource is the whole transfer, and it defaults to
// SEVEN DAYS; Android has no such ceiling either, but a transfer that never ends is a screen that never returns,
// so [RESOURCE_TIMEOUT_SECONDS] = 120 caps it: well above the largest body this app moves (the releve PDF) and
// far below a hang.
//
// AN EPHEMERAL SESSION, NO COOKIES, NO CACHE. The product is zero-cookie (the credential is a bearer token we
// attach ourselves), so nothing is accepted into a cookie jar, nothing is cached to disk, and every request goes
// to the network. waitsForConnectivity is FALSE, stated rather than inherited: offline must fail at once, as it
// does on Android, so the queue stays PENDING and the screen says so, rather than the request parking silently.

private const val REQUEST_TIMEOUT_SECONDS = 15.0
private const val RESOURCE_TIMEOUT_SECONDS = 120.0

/** The NSError behind a [TransportException]: domain, code and the system's own description, never the URL. */
class NsErrorException(
    val domain: String,
    val code: Long,
    description: String,
) : Exception("$domain $code: $description")

private class RawResponse(
    val status: Int,
    val data: NSData?,
    val headers: Map<String, String>,
)

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class NsUrlSessionTransport(
    private val session: NSURLSession = defaultSession(),
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse {
        val raw = perform(request)
        return HttpResponse(status = raw.status, body = raw.data?.toByteArray()?.decodeToString().orEmpty())
    }

    override suspend fun executeForBytes(request: HttpRequest): HttpBytesResponse {
        val raw = perform(request)
        return HttpBytesResponse(
            status = raw.status,
            bytes = raw.data?.toByteArray() ?: ByteArray(0),
            headers = raw.headers,
        )
    }

    private suspend fun perform(request: HttpRequest): RawResponse {
        val nsRequest = build(request)
        return suspendCancellableCoroutine { continuation ->
            val task: NSURLSessionDataTask =
                session.dataTaskWithRequest(nsRequest) { data: NSData?, response: NSURLResponse?, error: NSError? ->
                    when {
                        error != null ->
                            continuation.resumeWithException(
                                TransportException(
                                    "the request did not complete (NSError ${error.domain} ${error.code})",
                                    NsErrorException(error.domain.orEmpty(), error.code, error.localizedDescription),
                                ),
                            )
                        response !is NSHTTPURLResponse ->
                            continuation.resumeWithException(
                                TransportException("the server's answer was not an HTTP response"),
                            )
                        else -> continuation.resume(RawResponse(response.statusCode.toInt(), data, headersOf(response)))
                    }
                }
            continuation.invokeOnCancellation { task.cancel() }
            task.resume()
        }
    }

    private fun build(request: HttpRequest): NSMutableURLRequest {
        val url = NSURL.URLWithString(request.url) ?: throw TransportException("not a URL the platform can open")
        val nsRequest = NSMutableURLRequest.requestWithURL(url)
        nsRequest.setCachePolicy(NSURLRequestReloadIgnoringCacheData)
        nsRequest.HTTPMethod = request.method.wireName()
        request.headers.forEach { (name, value) -> nsRequest.setValue(value, forHTTPHeaderField = name) }
        request.body?.let { nsRequest.HTTPBody = it.encodeToByteArray().toNSData() }
        return nsRequest
    }

    private fun headersOf(response: NSHTTPURLResponse): Map<String, String> =
        response.allHeaderFields.entries.associate { (key, value) -> key.toString() to value.toString() }

    companion object {
        /** Ephemeral, cookie-free, uncached, impatient about being offline; see the header for each number. */
        fun defaultSession(): NSURLSession {
            val configuration = NSURLSessionConfiguration.ephemeralSessionConfiguration()
            configuration.timeoutIntervalForRequest = REQUEST_TIMEOUT_SECONDS
            configuration.timeoutIntervalForResource = RESOURCE_TIMEOUT_SECONDS
            configuration.waitsForConnectivity = false
            configuration.HTTPShouldSetCookies = false
            configuration.HTTPCookieStorage = null
            configuration.requestCachePolicy = NSURLRequestReloadIgnoringCacheData
            return NSURLSession.sessionWithConfiguration(configuration)
        }
    }
}

private fun HttpMethod.wireName(): String =
    when (this) {
        HttpMethod.GET -> "GET"
        HttpMethod.POST -> "POST"
        HttpMethod.PATCH -> "PATCH"
    }
