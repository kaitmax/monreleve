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

class SessionManager(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
) {
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
    suspend fun authenticatedGet(path: String): AuthedOutcome {
        val pair = tokenStore.load() ?: return AuthedOutcome.NoSession
        return when (val response = api.authenticatedGet(path, pair.accessToken)) {
            is AuthedResponse.Ok -> AuthedOutcome.Ok(response.body)
            is AuthedResponse.Failed -> AuthedOutcome.NetworkError
            is AuthedResponse.Unauthorized -> onUnauthorized(response.code, path)
        }
    }

    private suspend fun onUnauthorized(
        code: AuthServerCode?,
        path: String,
    ): AuthedOutcome =
        if (code == AuthServerCode.EXPIRED_TOKEN || code == AuthServerCode.ROTATED_TOKEN) {
            retryAfterRefresh(path)
        } else {
            // revoked_session, unknown_token, or anything else: the session is dead.
            tokenStore.clear()
            AuthedOutcome.SessionEnded
        }

    private suspend fun retryAfterRefresh(path: String): AuthedOutcome =
        when (val outcome = refresh()) {
            is RefreshOutcome.Refreshed -> retryWith(outcome.pair, path)
            RefreshOutcome.Expired -> AuthedOutcome.SessionExpired
            RefreshOutcome.NetworkError -> AuthedOutcome.NetworkError
            RefreshOutcome.NoSession -> AuthedOutcome.NoSession
        }

    private suspend fun retryWith(
        pair: TokenPair,
        path: String,
    ): AuthedOutcome =
        when (val retry = api.authenticatedGet(path, pair.accessToken)) {
            is AuthedResponse.Ok -> AuthedOutcome.Ok(retry.body)
            is AuthedResponse.Failed -> AuthedOutcome.NetworkError
            is AuthedResponse.Unauthorized -> {
                tokenStore.clear()
                AuthedOutcome.SessionEnded
            }
        }

    /** End the session: revoke server-side (best-effort), then clear local storage unconditionally. */
    suspend fun signOut() {
        val pair = tokenStore.load()
        if (pair != null) api.signOut(pair.accessToken)
        tokenStore.clear()
    }
}
