package ch.monreleve.app.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI

// AN4 increment 1. The platform HTTP client (R136: prefer the platform - no
// OkHttp, Ktor or Retrofit for a handful of JSON endpoints). URL.openConnection
// returns an HttpsURLConnection for the release https base and a plain
// HttpURLConnection for the debug 10.0.2.2 base; both are HttpURLConnection, so
// one path serves both. Runs on Dispatchers.IO.
//
// IT READS THE ERROR STREAM, not only the success stream: a 4xx body carries the
// `code` this client branches on (R198), and reading only inputStream would throw
// on every refusal and lose it. It NEVER logs a header or a body - these requests
// carry the token (AC3 / the log fence).

private const val DEFAULT_CONNECT_TIMEOUT_MS = 15_000
private const val DEFAULT_READ_TIMEOUT_MS = 15_000
private const val HTTP_OK_MIN = 200
private const val HTTP_OK_MAX = 299

class UrlConnectionTransport(
    private val connectTimeoutMs: Int = DEFAULT_CONNECT_TIMEOUT_MS,
    private val readTimeoutMs: Int = DEFAULT_READ_TIMEOUT_MS,
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse =
        withContext(Dispatchers.IO) {
            // URI(...).toURL(), not the URL(String) constructor: the latter is
            // deprecated from JDK 20 (this toolchain builds on a newer JDK).
            val connection = URI(request.url).toURL().openConnection() as HttpURLConnection
            try {
                connection.requestMethod = request.method.name
                connection.connectTimeout = connectTimeoutMs
                connection.readTimeout = readTimeoutMs
                connection.instanceFollowRedirects = false
                request.headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }

                // KMP-1: HttpRequest.body is now a public property in :shared, so it cannot be smart-cast
                // across the module boundary - capture it locally first (the KMP-0 cross-module cast fix).
                val requestBody = request.body
                if (requestBody != null) {
                    connection.doOutput = true
                    connection.outputStream.use { it.write(requestBody.toByteArray(Charsets.UTF_8)) }
                }

                val status = connection.responseCode
                val stream =
                    if (status in HTTP_OK_MIN..HTTP_OK_MAX) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                HttpResponse(status = status, body = body)
            } catch (e: IOException) {
                // R386: THE SEAM OWNS THE TRANSLATION. This is the only code that knows
                // what "the network did not work" looks like on this platform, so it is
                // the only code that should say so. AuthApi then catches TransportException
                // and nothing wider, which is what stopped a bug inside its try blocks
                // being reported to the reader as "network unreachable" (R387).
                //
                // THE CAUSE IS KEPT. It is the only remaining way to see which
                // IOException this was, and a log saying "unreachable" with no cause is a
                // support conversation that cannot start.
                throw TransportException(e.message ?: "network unreachable", e)
            } finally {
                connection.disconnect()
            }
        }

    // AN11: the binary path for the PDF and CSV exports. Reads the stream as BYTES - the PDF is binary and
    // the CSV's BOM and CRLF must survive verbatim, both of which a text reader would corrupt - and keeps the
    // response headers so the caller reads the Content-Disposition filename (R237). Same connection handling
    // as execute; a GET export carries no request body.
    override suspend fun executeForBytes(request: HttpRequest): HttpBytesResponse =
        withContext(Dispatchers.IO) {
            val connection = URI(request.url).toURL().openConnection() as HttpURLConnection
            try {
                connection.requestMethod = request.method.name
                connection.connectTimeout = connectTimeoutMs
                connection.readTimeout = readTimeoutMs
                connection.instanceFollowRedirects = false
                request.headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }

                val status = connection.responseCode
                val stream =
                    if (status in HTTP_OK_MIN..HTTP_OK_MAX) connection.inputStream else connection.errorStream
                val bytes = stream?.use { it.readBytes() } ?: ByteArray(0)
                val headers =
                    buildMap {
                        connection.headerFields.forEach { (key, values) ->
                            if (key != null) put(key, values.joinToString(","))
                        }
                    }
                HttpBytesResponse(status = status, bytes = bytes, headers = headers)
            } finally {
                connection.disconnect()
            }
        }
}
