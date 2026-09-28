package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.AuthServerCode
import ch.monreleve.app.data.remote.AuthedResponse
import ch.monreleve.app.data.remote.RefreshResult
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// AN4 increment 5. Holds the session: refresh (single-flight), the authenticated
// call flow, and sign-out. Lives in auth/, not ui/ (fence 5).

sealed interface RefreshOutcome {
    data class Refreshed(val pair: TokenPair) : RefreshOutcome

    /** The refresh token is dead (invalid/expired/rotated/revoked/replayed) - sign in again. */
    data object Expired : RefreshOutcome

    data object NoSession : RefreshOutcome

    data object NetworkError : RefreshOutcome
}

sealed interface AuthedOutcome {
    data class Ok(val body: String) : AuthedOutcome

    /** Access expired and the refresh failed: an ordinary lapse - "session expirée". */
    data object SessionExpired : AuthedOutcome

    /** revoked_session/unknown_token on a still-held token - what a replay produces (R210) - "session fermée". */
    data object SessionEnded : AuthedOutcome

    data object NoSession : AuthedOutcome

    data object NetworkError : AuthedOutcome
}

/**
 * The outcome of an authenticated POST. Unlike the GET's, Ok carries the HTTP
 * STATUS as well as the body: the entries sync (AN5) branches on 200 vs 400/409/413
 * to tell a client-built defect (loud, never retried - R198) from a written batch.
 * The 401 path is identical to the GET's, so a replay ends the session the same way
 * (R210).
 */
sealed interface PostOutcome {
    data class Ok(val status: Int, val body: String) : PostOutcome

    data object SessionExpired : PostOutcome

    data object SessionEnded : PostOutcome

    data object NoSession : PostOutcome

    data object NetworkError : PostOutcome
}

/**
 * The one call the entries sync needs from the session (AN5). A seam, so SyncEngine
 * runs as a plain JVM test against a scripted fake rather than the real Keystore and
 * network - the same reason the transport is an interface (Http.kt).
 */
interface AuthenticatedPoster {
    suspend fun authenticatedPost(
        path: String,
        body: String,
    ): PostOutcome
}

// One cohesive responsibility - the session - across three authenticated verbs (GET/POST/PATCH) that
// share the R210 refresh-once-and-replay machinery in `attempt`, plus refresh and sign-out. Splitting
// it would scatter the replay handling the shared machinery exists to keep in one place.
@Suppress("TooManyFunctions")
class SessionManager(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
) : AuthenticatedPoster {
    private val refreshMutex = Mutex()

    fun isSignedIn(): Boolean = tokenStore.load() != null

    /**
     * Single-flight refresh. Concurrent callers that entered holding the same
     * refresh token share ONE rotation: the first rotates and stores; a caller
     * that finds the stored token already changed while it waited returns the new
     * pair rather than refreshing again. A second refresh of an already-rotated
     * token IS a replay, and a replay ends the whole session (R210 turned against
     * ourselves) - so two requests racing an expiry must never both refresh.
     */
    suspend fun refresh(): RefreshOutcome {
        val before = tokenStore.load() ?: return RefreshOutcome.NoSession
        return refreshMutex.withLock {
            val latest = tokenStore.load()
            if (latest != null && latest.refreshToken != before.refreshToken) {
                RefreshOutcome.Refreshed(latest)
            } else {
                applyRefresh(before)
            }
        }
    }

    private suspend fun applyRefresh(before: TokenPair): RefreshOutcome =
        when (val result = api.refresh(before.refreshToken)) {
            is RefreshResult.Rotated -> {
                tokenStore.save(result.pair)
                RefreshOutcome.Refreshed(result.pair)
            }
            RefreshResult.Invalid -> {
                tokenStore.clear()
                RefreshOutcome.Expired
            }
            is RefreshResult.Failed -> RefreshOutcome.NetworkError
        }

    /**
     * An authenticated GET that refreshes ONCE on an expired/rotated access token
     * and retries, and keeps a dead session (revoked_session/unknown_token, what a
     * replay produces on a still-held token) distinct from an ordinary expiry, so
     * the two render different copy (R210).
     */
    suspend fun authenticatedGet(path: String): AuthedOutcome =
        when (val attempt = attempt { token -> api.authenticatedGet(path, token) }) {
            is Attempt.Ok -> AuthedOutcome.Ok(attempt.body)
            Attempt.SessionExpired -> AuthedOutcome.SessionExpired
            Attempt.SessionEnded -> AuthedOutcome.SessionEnded
            Attempt.NoSession -> AuthedOutcome.NoSession
            Attempt.NetworkError -> AuthedOutcome.NetworkError
        }

    // The shared machinery for BOTH authenticated calls (AN5): load the token, issue the
    // request, and on a 401 refresh ONCE and retry - EXPIRED/ROTATED refresh, anything
    // else ends the session (R210, replay). GET and POST differ only in the request
    // lambda and how each maps the result; one code path means the replay handling cannot
    // drift between them.
    private suspend fun attempt(request: suspend (String) -> AuthedResponse): Attempt {
        val pair = tokenStore.load() ?: return Attempt.NoSession
        return when (val response = request(pair.accessToken)) {
            is AuthedResponse.Ok -> Attempt.Ok(response.status, response.body)
            is AuthedResponse.Failed -> Attempt.NetworkError
            is AuthedResponse.Unauthorized -> onUnauthorized(response.code, request)
        }
    }

    private suspend fun onUnauthorized(
        code: AuthServerCode?,
        request: suspend (String) -> AuthedResponse,
    ): Attempt =
        if (code == AuthServerCode.EXPIRED_TOKEN || code == AuthServerCode.ROTATED_TOKEN) {
            retryAfterRefresh(request)
        } else {
            // revoked_session, unknown_token, or anything else: the session is dead.
            tokenStore.clear()
            Attempt.SessionEnded
        }

    private suspend fun retryAfterRefresh(request: suspend (String) -> AuthedResponse): Attempt =
        when (val outcome = refresh()) {
            is RefreshOutcome.Refreshed -> retryWith(outcome.pair, request)
            RefreshOutcome.Expired -> Attempt.SessionExpired
            RefreshOutcome.NetworkError -> Attempt.NetworkError
            RefreshOutcome.NoSession -> Attempt.NoSession
        }

    private suspend fun retryWith(
        pair: TokenPair,
        request: suspend (String) -> AuthedResponse,
    ): Attempt =
        when (val retry = request(pair.accessToken)) {
            is AuthedResponse.Ok -> Attempt.Ok(retry.status, retry.body)
            is AuthedResponse.Failed -> Attempt.NetworkError
            is AuthedResponse.Unauthorized -> {
                tokenStore.clear()
                Attempt.SessionEnded
            }
        }

    /** The internal result of one authenticated attempt, mapped by each caller to its own outcome type. */
    private sealed interface Attempt {
        data class Ok(val status: Int, val body: String) : Attempt

        data object SessionExpired : Attempt

        data object SessionEnded : Attempt

        data object NoSession : Attempt

        data object NetworkError : Attempt
    }

    /**
     * An authenticated POST with the SAME refresh-once-and-retry and replay handling as
     * the GET (R210), through the shared `attempt` machinery. The status is returned so
     * the caller maps the entries route's 400/409/413 to a client defect (AN5).
     */
    override suspend fun authenticatedPost(
        path: String,
        body: String,
    ): PostOutcome =
        when (val attempt = attempt { token -> api.authenticatedPost(path, body, token) }) {
            is Attempt.Ok -> PostOutcome.Ok(attempt.status, attempt.body)
            Attempt.SessionExpired -> PostOutcome.SessionExpired
            Attempt.SessionEnded -> PostOutcome.SessionEnded
            Attempt.NoSession -> PostOutcome.NoSession
            Attempt.NetworkError -> PostOutcome.NetworkError
        }

    /**
     * An authenticated PATCH with the SAME refresh-once-and-retry and replay handling as the GET
     * and POST (R210), through the shared `attempt` machinery. AN5b: the settings write
     * (/api/v1/me). Returns PostOutcome so the caller can branch on 400 (the database's named
     * refusal, R198) versus 200.
     */
    suspend fun authenticatedPatch(
        path: String,
        body: String,
    ): PostOutcome =
        when (val attempt = attempt { token -> api.authenticatedPatch(path, body, token) }) {
            is Attempt.Ok -> PostOutcome.Ok(attempt.status, attempt.body)
            Attempt.SessionExpired -> PostOutcome.SessionExpired
            Attempt.SessionEnded -> PostOutcome.SessionEnded
            Attempt.NoSession -> PostOutcome.NoSession
            Attempt.NetworkError -> PostOutcome.NetworkError
        }

    /** End the session: revoke server-side (best-effort), then clear local storage unconditionally. */
    suspend fun signOut() {
        val pair = tokenStore.load()
        if (pair != null) api.signOut(pair.accessToken)
        tokenStore.clear()
    }
}
