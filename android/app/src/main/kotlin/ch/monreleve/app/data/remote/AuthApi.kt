package ch.monreleve.app.data.remote

import org.json.JSONObject
import java.io.IOException

// AN4 increment 3+. The typed calls onto the frozen auth contract (R195), built
// on the increment-1 transport seam and error mapping. requestMagicLink is
// increment 3; the callback exchange, refresh, sign-out and revoke-all land in
// increments 4-5 on the same shape.

private const val HTTP_ACCEPTED = 202
private const val HTTP_TOO_MANY_REQUESTS = 429

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
}
