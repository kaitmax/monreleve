package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.TokenPair
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

// AN4 increment 3+. The typed calls onto the frozen auth contract (R195), built
// on the increment-1 transport seam and error mapping. requestMagicLink is
// increment 3; the callback exchange is increment 4; refresh, sign-out and
// revoke-all land in increment 5 on the same shape.
//
// KMP-1: moved to :shared commonMain, org.json -> kotlinx.serialization (wireJson, the one config). The request
// bodies are @Serializable DTOs so the Json flags (explicitNulls/encodeDefaults, WireJson.kt) govern their bytes;
// the token-pair response decodes into a @Serializable wire DTO and maps to the plain TokenPair (the credential
// type stays un-annotated). THE BYTES DO NOT CHANGE - proven by the commonTest goldens (R381). java.net.URLEncoder
// became a byte-for-byte common encoder (encode, below), and java.io.IOException became TransportException
// (R386): commonMain cannot name a JVM exception, so the TRANSPORT translates its platform failure into one
// common type and this file catches that and nothing wider. KMP-1 first tried "catch CancellationException,
// rethrow; then catch Exception", which needed a @Suppress and reported a bug inside the try as a network
// failure; KMP-1b replaced it (R387).

private const val HTTP_OK = 200
private const val HTTP_ACCEPTED = 202
private const val HTTP_BAD_REQUEST = 400
private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_TOO_MANY_REQUESTS = 429
private const val HTTP_OK_MAX = 299

/**
 * The outcome of asking for a sign-in link. `Sent` is the ONE answer for a 202,
 * whatever the server actually did (registered, unregistered, internally
 * rate-limited, provider down) - the client cannot enumerate because the server
 * does not let it (docs/api-v1.md 1.5). `RateLimited` is the edge's own 429, the
 * one refusal the client is entitled to show honestly; `Failed` carries the
 * distinct network/other failure.
 */
sealed interface MagicLinkResult {
    data object Sent : MagicLinkResult

    data object RateLimited : MagicLinkResult

    data class Failed(val failure: ApiFailure) : MagicLinkResult
}

/**
 * The outcome of exchanging a callback link. `Signed` carries the token pair from
 * a 200; `InvalidLink` is the server's ONE 400 answer for every callback failure -
 * unknown, expired, already used, wrong address - because the server refuses to
 * say which (docs/api-v1.md callback route, lines 43-52), and the client renders
 * one actionable "ask for a new link" state for all of them. `Failed` is the
 * distinct network/malformed case.
 */
sealed interface CallbackResult {
    data class Signed(val pair: TokenPair) : CallbackResult

    data object InvalidLink : CallbackResult

    data class Failed(val failure: ApiFailure) : CallbackResult
}

/**
 * AN-ONBOARD: the outcome of exchanging a six-digit code. `Signed` carries the pair from a 200 - the same
 * session the callback opens. Each refusal is its OWN result, because unlike the callback (one 400 for
 * everything) the code endpoint names them so the screen can tell the person how to recover: `WrongCode`
 * (check the digits or ask again), `Expired`, `TooManyAttempts` (the request is spent), `RateLimited`.
 * `Failed` is the network/malformed/unknown-code case - an unrecognised code is preserved, never guessed
 * into a known one (contract 6.5).
 */
sealed interface CodeExchangeResult {
    data class Signed(val pair: TokenPair) : CodeExchangeResult

    data object WrongCode : CodeExchangeResult

    data object Expired : CodeExchangeResult

    data object TooManyAttempts : CodeExchangeResult

    data object RateLimited : CodeExchangeResult

    data class Failed(val failure: ApiFailure) : CodeExchangeResult
}

/**
 * The outcome of a refresh. `Rotated` is a new pair; `Invalid` is the server's ONE
 * 401 answer for every unusable refresh token - unknown, expired, already rotated,
 * revoked, AND a detected replay - because the server refuses to say which
 * (docs/api-v1.md 1.5). The client cannot tell a replay from an expiry HERE; it
 * learns a replay only when a still-held access token later returns revoked_session
 * (R210), which is why SessionManager keeps those two paths distinct.
 */
sealed interface RefreshResult {
    data class Rotated(val pair: TokenPair) : RefreshResult

    data object Invalid : RefreshResult

    data class Failed(val failure: ApiFailure) : RefreshResult
}

/**
 * The outcome of an authenticated call, over any payload type T: a response with its status and value, a
 * 401 with its code, or a network failure. AN11 generalised this from a String-only shape so the SAME
 * SessionManager.attempt machinery drives the String reads (GET/POST/PATCH) AND the binary export read
 * (authenticatedGetBytes) - one code path, so the R210 refresh-and-replay handling cannot drift between
 * them (the reason SessionManager's own comment gives for keeping it single).
 */
sealed interface AuthedResult<out T> {
    data class Ok<out T>(val status: Int, val value: T) : AuthedResult<T>

    data class Unauthorized(val code: AuthServerCode?) : AuthedResult<Nothing>

    data class Failed(val failure: ApiFailure) : AuthedResult<Nothing>
}

/** A binary export (the PDF, the CSV): the bytes and the filename the server named in Content-Disposition. */
data class ExportBytes(val bytes: ByteArray, val filename: String?) {
    // ByteArray needs structural equals/hashCode for value semantics (the IDE/detekt convention).
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ExportBytes) return false
        return bytes.contentEquals(other.bytes) && filename == other.filename
    }

    override fun hashCode(): Int = 31 * bytes.contentHashCode() + (filename?.hashCode() ?: 0)
}

// KMP-1: the request bodies as @Serializable DTOs - wireJson encodes them, so WireJson.kt's flags decide the
// bytes. All fields are required and non-null, so encodeDefaults never drops one and explicitNulls never fires:
// each body is exactly the keys org.json's put() set. The response pair decodes into AuthTokenPairWire (its four
// fields mandatory - a missing one throws, reproducing getString's throw -> runCatching -> null -> Malformed).
@Serializable
private data class MagicLinkRequest(val email: String)

@Serializable
private data class CodeRequest(val email: String, val code: String)

@Serializable
private data class RefreshRequest(val refreshToken: String)

@Serializable
private data class AuthTokenPairWire(
    val accessToken: String,
    val refreshToken: String,
    val accessExpiresAt: String,
    val refreshExpiresAt: String,
)

// R387: THE CATCHES NAME WHAT THEY MEAN, so there is no @Suppress here any more.
//
// KMP-1 widened all eight transport catches from `java.io.IOException` to
// `Exception`, because commonMain cannot name the former. That silenced detekt
// with a class-level @Suppress("TooGenericExceptionCaught") and cost two real
// things: a bug inside the try (an NPE, an IllegalStateException) was reported
// to the caller as "network unreachable", and the suppression would have hidden
// the next wide catch somebody added.
//
// Each site now catches TransportException - the type the SEAM throws (R386) -
// and nothing wider. The explicit `catch (CancellationException) { throw e }`
// that used to precede each one is gone with it: it was there to undo the
// over-wide catch below it, and with a narrow catch it is dead code that
// implies the opposite of what the code now does.
class AuthApi(
    private val transport: HttpTransport,
    private val baseUrl: String,
) {
    suspend fun requestMagicLink(email: String): MagicLinkResult {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.POST,
                        url = "$baseUrl/api/v1/auth/magic-link",
                        headers = mapOf("Content-Type" to "application/json"),
                        body = wireJson.encodeToString(MagicLinkRequest(email)),
                    ),
                )
            } catch (e: TransportException) {
                return MagicLinkResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return when (response.status) {
            HTTP_ACCEPTED -> MagicLinkResult.Sent
            HTTP_TOO_MANY_REQUESTS -> MagicLinkResult.RateLimited
            else -> MagicLinkResult.Failed(parseServerFailure(response.status, response.body))
        }
    }

    /**
     * Exchange a validated callback link for a token pair. The token and email are
     * URL-encoded onto the app's OWN configured base URL (never a host taken from
     * the incoming intent - CallbackLink validated the URI, this call does not
     * trust it as an address).
     */
    suspend fun exchangeCallback(
        token: String,
        email: String,
    ): CallbackResult {
        val url = "$baseUrl/api/v1/auth/callback?token=${encode(token)}&email=${encode(email)}"
        val response =
            try {
                transport.execute(HttpRequest(method = HttpMethod.GET, url = url))
            } catch (e: TransportException) {
                return CallbackResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return when (response.status) {
            HTTP_OK ->
                parseTokenPair(response.body)?.let { CallbackResult.Signed(it) }
                    ?: CallbackResult.Failed(ApiFailure.Malformed("callback 200 carried no token pair"))
            HTTP_BAD_REQUEST -> CallbackResult.InvalidLink
            else -> CallbackResult.Failed(parseServerFailure(response.status, response.body))
        }
    }

    /**
     * AN-ONBOARD: exchange an address and a six-digit code for a token pair. Like the callback it opens the
     * same session; unlike the callback it maps each NAMED refusal (docs/api-v1.md 1.4/1.6) to its own result.
     * The code travels in the body of a POST to the app's OWN base url.
     */
    suspend fun exchangeCode(
        email: String,
        code: String,
    ): CodeExchangeResult {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.POST,
                        url = "$baseUrl/api/v1/auth/code",
                        headers = mapOf("Content-Type" to "application/json"),
                        body = wireJson.encodeToString(CodeRequest(email, code)),
                    ),
                )
            } catch (e: TransportException) {
                return CodeExchangeResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return when (response.status) {
            HTTP_OK ->
                parseTokenPair(response.body)?.let { CodeExchangeResult.Signed(it) }
                    ?: CodeExchangeResult.Failed(ApiFailure.Malformed("code 200 carried no token pair"))
            else -> codeRefusalOf(parseServerFailure(response.status, response.body))
        }
    }

    /** Rotate a refresh token for a new pair. The refresh token travels in the BODY (docs/api-v1.md 1.3). */
    suspend fun refresh(refreshToken: String): RefreshResult {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.POST,
                        url = "$baseUrl/api/v1/auth/refresh",
                        headers = mapOf("Content-Type" to "application/json"),
                        body = wireJson.encodeToString(RefreshRequest(refreshToken)),
                    ),
                )
            } catch (e: TransportException) {
                return RefreshResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return when (response.status) {
            HTTP_OK ->
                parseTokenPair(response.body)?.let { RefreshResult.Rotated(it) }
                    ?: RefreshResult.Failed(ApiFailure.Malformed("refresh 200 carried no token pair"))
            else -> RefreshResult.Invalid
        }
    }

    /** A GET carrying the access token as a bearer, returning its status/body or the 401 code. */
    suspend fun authenticatedGet(
        path: String,
        accessToken: String,
    ): AuthedResult<String> {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.GET,
                        url = "$baseUrl$path",
                        headers = mapOf("Authorization" to "Bearer $accessToken"),
                    ),
                )
            } catch (e: TransportException) {
                return AuthedResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return if (response.status == HTTP_UNAUTHORIZED) {
            AuthedResult.Unauthorized(parseServerFailure(response.status, response.body).code)
        } else {
            AuthedResult.Ok(response.status, response.body)
        }
    }

    /**
     * A POST carrying the access token as a bearer and a JSON body, returning its
     * status/body or the 401 code. AN5: the entries sync uses this; the 401 path is
     * identical to authenticatedGet's so SessionManager applies R210 the same way.
     */
    suspend fun authenticatedPost(
        path: String,
        body: String,
        accessToken: String,
    ): AuthedResult<String> {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.POST,
                        url = "$baseUrl$path",
                        headers =
                            mapOf(
                                "Authorization" to "Bearer $accessToken",
                                "Content-Type" to "application/json",
                            ),
                        body = body,
                    ),
                )
            } catch (e: TransportException) {
                return AuthedResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return if (response.status == HTTP_UNAUTHORIZED) {
            AuthedResult.Unauthorized(parseServerFailure(response.status, response.body).code)
        } else {
            AuthedResult.Ok(response.status, response.body)
        }
    }

    /**
     * A PATCH carrying the access token as a bearer and a JSON body, returning its
     * status/body or the 401 code. AN5b: the settings write (/api/v1/me) uses this; the 401 path is
     * identical to authenticatedGet/Post so SessionManager applies R210 the same way.
     */
    suspend fun authenticatedPatch(
        path: String,
        body: String,
        accessToken: String,
    ): AuthedResult<String> {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.PATCH,
                        url = "$baseUrl$path",
                        headers =
                            mapOf(
                                "Authorization" to "Bearer $accessToken",
                                "Content-Type" to "application/json",
                            ),
                        body = body,
                    ),
                )
            } catch (e: TransportException) {
                return AuthedResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return if (response.status == HTTP_UNAUTHORIZED) {
            AuthedResult.Unauthorized(parseServerFailure(response.status, response.body).code)
        } else {
            AuthedResult.Ok(response.status, response.body)
        }
    }

    /**
     * A GET whose success is BYTES, carrying the access token as a bearer (AN11: the PDF and CSV exports).
     * Returns the status and the [ExportBytes] (bytes + the Content-Disposition filename, R237), or the 401
     * code - the same three-way shape as the String verbs, so SessionManager.attempt drives it identically
     * and R210 applies unchanged. A non-2xx non-401 (e.g. a 503 renderer error) still returns Ok with its
     * status and whatever bytes came back; the caller branches on the status.
     */
    suspend fun authenticatedGetBytes(
        path: String,
        accessToken: String,
    ): AuthedResult<ExportBytes> {
        val response =
            try {
                transport.executeForBytes(
                    HttpRequest(
                        method = HttpMethod.GET,
                        url = "$baseUrl$path",
                        headers = mapOf("Authorization" to "Bearer $accessToken"),
                    ),
                )
            } catch (e: TransportException) {
                return AuthedResult.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return if (response.status == HTTP_UNAUTHORIZED) {
            // The 401 body is small JSON; decode it just to read the code, as the String verbs do.
            AuthedResult.Unauthorized(
                parseServerFailure(response.status, response.bytes.decodeToString()).code,
            )
        } else {
            AuthedResult.Ok(response.status, ExportBytes(response.bytes, filenameOf(response.headers)))
        }
    }

    /**
     * End this session server-side. Best-effort: a network failure returns false,
     * and the caller clears local storage regardless.
     */
    suspend fun signOut(accessToken: String): Boolean {
        val request =
            HttpRequest(
                method = HttpMethod.POST,
                url = "$baseUrl/api/v1/auth/sign-out",
                headers = mapOf("Authorization" to "Bearer $accessToken"),
            )
        // R387: NOT runCatching. `transport.execute` is a SUSPEND function and
        // runCatching catches Throwable, so this swallowed CancellationException -
        // before KMP-1 as well as after, making it the one site here whose fix is a
        // BEHAVIOUR CHANGE rather than a restoration. A sign-out whose scope is
        // cancelled now ends cancelled instead of reporting `false`.
        return try {
            transport.execute(request).status in HTTP_OK..HTTP_OK_MAX
        } catch (_: TransportException) {
            // Sign-out is best-effort: the local session is cleared regardless, and the
            // server expires the token anyway, so "unreachable" means "not confirmed"
            // and nothing more. The exception is named `_` because nothing here acts on
            // it - commonMain has no logger - and detekt's SwallowedException rule is
            // right to ask which of those two it is.
            false
        }
    }
}

private const val HEX = "0123456789ABCDEF"

/**
 * URL-encode a query value, reproducing java.net.URLEncoder.encode(value, "UTF-8") BYTE FOR BYTE (the JVM
 * encoder AuthApi used before the move to commonMain, where it is unavailable): a-z A-Z 0-9 and - _ . * pass
 * through, a space becomes '+', and every other byte of the UTF-8 encoding becomes %XX with UPPERCASE hex. The
 * server decodes the query; AuthApiCallbackTest pins "t o k" -> "t+o+k" and "a@b.ch" -> "a%40b.ch", so this is
 * not interchangeable with a %20-style encoder.
 */
private fun encode(value: String): String {
    val out = StringBuilder()
    for (byte in value.encodeToByteArray()) {
        val code = byte.toInt() and 0xFF
        val ch = code.toChar()
        when {
            ch in 'a'..'z' || ch in 'A'..'Z' || ch in '0'..'9' ||
                ch == '-' || ch == '_' || ch == '.' || ch == '*' -> out.append(ch)
            code == 0x20 -> out.append('+')
            else -> {
                out.append('%')
                out.append(HEX[code shr 4])
                out.append(HEX[code and 0x0F])
            }
        }
    }
    return out.toString()
}

/** U+0022-quoted filename from a Content-Disposition header. R237: the CSV's only carrier of its titulaire. */
private val FILENAME = Regex("""filename\*?=(?:UTF-8'')?"?([^\";]+)"?""", RegexOption.IGNORE_CASE)

/** The download filename the server named in Content-Disposition, or null if it named none. */
internal fun filenameOf(headers: Map<String, String>): String? {
    val disposition =
        headers.entries.firstOrNull { it.key.equals("Content-Disposition", ignoreCase = true) }?.value
            ?: return null
    return FILENAME.find(disposition)?.groupValues?.get(1)?.trim()?.ifEmpty { null }
}

/**
 * AN-ONBOARD: map a code-exchange refusal to its result. Branch on the RAW wire code, not AuthServerCode:
 * these are exchange-specific refusals, outside the bearer/token code family, and an unrecognised one stays
 * Failed with its raw code intact (contract 6.5).
 */
internal fun codeRefusalOf(failure: ApiFailure.Server): CodeExchangeResult =
    when (failure.rawCode) {
        "invalid_code" -> CodeExchangeResult.WrongCode
        "code_expired" -> CodeExchangeResult.Expired
        "too_many_attempts" -> CodeExchangeResult.TooManyAttempts
        "rate_limited" -> CodeExchangeResult.RateLimited
        else -> CodeExchangeResult.Failed(failure)
    }

/**
 * The token pair carried by a callback or refresh 200, or null if the body is not that shape. KMP-1: decode the
 * four mandatory fields via the @Serializable wire DTO and map to the plain TokenPair; a missing field throws
 * (reproducing org.json getString) and runCatching turns it into null, which the callers render as Malformed.
 */
internal fun parseTokenPair(body: String): TokenPair? =
    runCatching {
        val wire = wireJson.decodeFromString<AuthTokenPairWire>(body)
        TokenPair(
            accessToken = wire.accessToken,
            refreshToken = wire.refreshToken,
            accessExpiresAt = wire.accessExpiresAt,
            refreshExpiresAt = wire.refreshExpiresAt,
        )
    }.getOrNull()
