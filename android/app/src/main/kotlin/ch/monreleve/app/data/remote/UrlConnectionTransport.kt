package ch.monreleve.app.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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

                if (request.body != null) {
                    connection.doOutput = true
                    connection.outputStream.use { it.write(request.body.toByteArray(Charsets.UTF_8)) }
                }

                val status = connection.responseCode
                val stream =
                    if (status in HTTP_OK_MIN..HTTP_OK_MAX) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                HttpResponse(status = status, body = body)
            } finally {
                connection.disconnect()
            }
        }
}
