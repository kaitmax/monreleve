package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.TokenPair
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder

// AN4 increment 3+. The typed calls onto the frozen auth contract (R195), built
// on the increment-1 transport seam and error mapping. requestMagicLink is
// increment 3; the callback exchange is increment 4; refresh, sign-out and
// revoke-all land in increment 5 on the same shape.

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

/** The outcome of an authenticated call: a 2xx body, a 401 with its code, or a network failure. */
sealed interface AuthedResponse {
    data class Ok(val status: Int, val body: String) : AuthedResponse

    data class Unauthorized(val code: AuthServerCode?) : AuthedResponse

    data class Failed(val failure: ApiFailure) : AuthedResponse
}

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
                        body = JSONObject().put("email", email).toString(),
                    ),
                )
            } catch (e: IOException) {
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
            } catch (e: IOException) {
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

    /** Rotate a refresh token for a new pair. The refresh token travels in the BODY (docs/api-v1.md 1.3). */
    suspend fun refresh(refreshToken: String): RefreshResult {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.POST,
                        url = "$baseUrl/api/v1/auth/refresh",
                        headers = mapOf("Content-Type" to "application/json"),
                        body = JSONObject().put("refreshToken", refreshToken).toString(),
                    ),
                )
            } catch (e: IOException) {
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
    ): AuthedResponse {
        val response =
            try {
                transport.execute(
                    HttpRequest(
                        method = HttpMethod.GET,
                        url = "$baseUrl$path",
                        headers = mapOf("Authorization" to "Bearer $accessToken"),
                    ),
                )
            } catch (e: IOException) {
                return AuthedResponse.Failed(ApiFailure.Network(e.message ?: "network unreachable"))
            }
        return if (response.status == HTTP_UNAUTHORIZED) {
            AuthedResponse.Unauthorized(parseServerFailure(response.status, response.body).code)
        } else {
            AuthedResponse.Ok(response.status, response.body)
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
        return runCatching { transport.execute(request).status in HTTP_OK..HTTP_OK_MAX }.getOrDefault(false)
    }
}

private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

/** The token pair carried by a callback or refresh 200, or null if the body is not that shape. */
internal fun parseTokenPair(body: String): TokenPair? =
    runCatching {
        val json = JSONObject(body)
        TokenPair(
            accessToken = json.getString("accessToken"),
            refreshToken = json.getString("refreshToken"),
            accessExpiresAt = json.getString("accessExpiresAt"),
            refreshExpiresAt = json.getString("refreshExpiresAt"),
        )
    }.getOrNull()
