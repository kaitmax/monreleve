package ch.monreleve.app.data.remote

// AN4 increment 1. The one seam between the auth/refresh logic and the network.
// A thin execute(request) -> response, so the refresh state machine and the
// single-flight proof (increment 5) run as plain JVM tests against a scripted
// fake, and the platform HttpsURLConnection (R136) lives behind it in
// UrlConnectionTransport. Nothing here knows about tokens or codes; those are
// the layers above.

enum class HttpMethod { GET, POST }

data class HttpRequest(
    val method: HttpMethod,
    val url: String,
    val headers: Map<String, String> = emptyMap(),
    val body: String? = null,
)

data class HttpResponse(
    val status: Int,
    val body: String,
)

/** The seam. A fake in tests, UrlConnectionTransport on a device. */
interface HttpTransport {
    suspend fun execute(request: HttpRequest): HttpResponse
}
