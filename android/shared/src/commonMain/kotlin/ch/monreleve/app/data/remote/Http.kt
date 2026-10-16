package ch.monreleve.app.data.remote

// AN4 increment 1. The one seam between the auth/refresh logic and the network.
// A thin execute(request) -> response, so the refresh state machine and the
// single-flight proof (increment 5) run as plain JVM tests against a scripted
// fake, and the platform HttpsURLConnection (R136) lives behind it in
// UrlConnectionTransport. Nothing here knows about tokens or codes; those are
// the layers above.

// PATCH is added for /api/v1/me (AN5b). Android's HttpURLConnection is OkHttp-backed and accepts
// PATCH via requestMethod; the desktop JDK's own implementation rejects it, but this runs on-device
// and the JVM tests drive the fake transport, never HttpURLConnection.
enum class HttpMethod { GET, POST, PATCH }

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

/**
 * A binary response (AN11: the PDF and CSV exports). The bytes are the file, unaltered; the headers carry
 * Content-Disposition, which is the ONLY place the CSV names its titulaire (R237). Header keys are as the
 * server sent them; a reader matches them case-insensitively (HTTP header names are case-insensitive).
 */
data class HttpBytesResponse(
    val status: Int,
    val bytes: ByteArray,
    val headers: Map<String, String>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is HttpBytesResponse) return false
        return status == other.status && bytes.contentEquals(other.bytes) && headers == other.headers
    }

    override fun hashCode(): Int = 31 * (31 * status + bytes.contentHashCode()) + headers.hashCode()
}

/** The seam. A fake in tests, UrlConnectionTransport on a device. */
interface HttpTransport {
    suspend fun execute(request: HttpRequest): HttpResponse

    /**
     * Fetch a binary response (AN11 exports). Default THROWS rather than returning a plausible empty
     * response: a fake that has not implemented it must fail loudly, never look like it succeeded.
     */
    suspend fun executeForBytes(request: HttpRequest): HttpBytesResponse =
        throw UnsupportedOperationException("this transport does not implement executeForBytes")
}
