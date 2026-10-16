package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.AuthServerCode
import ch.monreleve.app.data.remote.AuthedResult
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.remote.RefreshResult
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

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
 * The outcome of an authenticated binary GET (AN11: the PDF and CSV exports). Ok carries the HTTP status
 * (so the export screen tells a 200 from a 503 renderer error) and the [ExportBytes] (the file and its
 * Content-Disposition filename). The session states mirror the other verbs, so a replay ends an export the
 * same way (R210).
 */
sealed interface BytesOutcome {
    data class Ok(val status: Int, val export: ExportBytes) : BytesOutcome

    data object SessionExpired : BytesOutcome

    data object SessionEnded : BytesOutcome

    data object NoSession : BytesOutcome

    data object NetworkError : BytesOutcome
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
            is Attempt.Ok -> AuthedOutcome.Ok(attempt.value)
            Attempt.SessionExpired -> AuthedOutcome.SessionExpired
            Attempt.SessionEnded -> AuthedOutcome.SessionEnded
            Attempt.NoSession -> AuthedOutcome.NoSession
            Attempt.NetworkError -> AuthedOutcome.NetworkError
        }

    // The shared machinery for EVERY authenticated call (AN5, generalised for the AN11 byte exports): load
    // the token, issue the request, and on a 401 refresh ONCE and retry - EXPIRED/ROTATED refresh, anything
    // else ends the session (R210, replay). The verbs differ only in the request lambda's payload type T
    // and how each maps the result; ONE generic code path means the replay handling cannot drift between a
    // String read and a byte export.
    private suspend fun <T> attempt(request: suspend (String) -> AuthedResult<T>): Attempt<T> {
        val pair = tokenStore.load() ?: return Attempt.NoSession
        return when (val response = request(pair.accessToken)) {
            is AuthedResult.Ok -> Attempt.Ok(response.status, response.value)
            is AuthedResult.Failed -> Attempt.NetworkError
            is AuthedResult.Unauthorized -> onUnauthorized(response.code, request)
        }
    }

    private suspend fun <T> onUnauthorized(
        code: AuthServerCode?,
        request: suspend (String) -> AuthedResult<T>,
    ): Attempt<T> =
        if (code == AuthServerCode.EXPIRED_TOKEN || code == AuthServerCode.ROTATED_TOKEN) {
            retryAfterRefresh(request)
        } else {
            // revoked_session, unknown_token, or anything else: the session is dead.
            tokenStore.clear()
            Attempt.SessionEnded
        }

    private suspend fun <T> retryAfterRefresh(request: suspend (String) -> AuthedResult<T>): Attempt<T> =
        when (val outcome = refresh()) {
            is RefreshOutcome.Refreshed -> retryWith(outcome.pair, request)
            RefreshOutcome.Expired -> Attempt.SessionExpired
            RefreshOutcome.NetworkError -> Attempt.NetworkError
            RefreshOutcome.NoSession -> Attempt.NoSession
        }

    private suspend fun <T> retryWith(
        pair: TokenPair,
        request: suspend (String) -> AuthedResult<T>,
    ): Attempt<T> =
        when (val retry = request(pair.accessToken)) {
            is AuthedResult.Ok -> Attempt.Ok(retry.status, retry.value)
            is AuthedResult.Failed -> Attempt.NetworkError
            is AuthedResult.Unauthorized -> {
                tokenStore.clear()
                Attempt.SessionEnded
            }
        }

    /** The internal result of one authenticated attempt, mapped by each caller to its own outcome type. */
    private sealed interface Attempt<out T> {
        data class Ok<out T>(val status: Int, val value: T) : Attempt<T>

        data object SessionExpired : Attempt<Nothing>

        data object SessionEnded : Attempt<Nothing>

        data object NoSession : Attempt<Nothing>

        data object NetworkError : Attempt<Nothing>
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
            is Attempt.Ok -> PostOutcome.Ok(attempt.status, attempt.value)
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
            is Attempt.Ok -> PostOutcome.Ok(attempt.status, attempt.value)
            Attempt.SessionExpired -> PostOutcome.SessionExpired
            Attempt.SessionEnded -> PostOutcome.SessionEnded
            Attempt.NoSession -> PostOutcome.NoSession
            Attempt.NetworkError -> PostOutcome.NetworkError
        }

    /**
     * An authenticated binary GET with the SAME refresh-once-and-replay handling as the other verbs (R210),
     * through the shared generic `attempt`. AN11: the PDF and CSV exports. Ok carries the status and the
     * bytes+filename, so the export screen branches on the status and hands the file to the platform.
     */
    suspend fun authenticatedGetBytes(path: String): BytesOutcome =
        when (val attempt = attempt { token -> api.authenticatedGetBytes(path, token) }) {
            is Attempt.Ok -> BytesOutcome.Ok(attempt.status, attempt.value)
            Attempt.SessionExpired -> BytesOutcome.SessionExpired
            Attempt.SessionEnded -> BytesOutcome.SessionEnded
            Attempt.NoSession -> BytesOutcome.NoSession
            Attempt.NetworkError -> BytesOutcome.NetworkError
        }

    /**
     * End the session: revoke server-side (best-effort), then clear local storage UNCONDITIONALLY.
     *
     * THE WIPE IS NonCancellable, AND KMP-1b IS WHY. This used to read
     *
     *     if (pair != null) api.signOut(pair.accessToken)
     *     tokenStore.clear()
     *
     * and it was only safe by accident: api.signOut wrapped the call in runCatching, which
     * swallowed CancellationException, so the clear below it still ran. KMP-1b (R387) made
     * cancellation propagate - correctly - and that turned the accident into a security
     * regression: a person taps sign out, leaves the screen, the scope is cancelled mid-request
     * and THE TOKENS STAY ON THE DEVICE.
     *
     * The revoke is still attempted first, because it needs the token this clear destroys. What
     * changed is that the clear can no longer be skipped: a finally inside NonCancellable runs
     * whether the revoke returned, threw, or was cancelled. Signing out is a promise about the
     * device, and it is the half that must not depend on the network.
     */
    suspend fun signOut() {
        val pair = tokenStore.load()
        try {
            if (pair != null) api.signOut(pair.accessToken)
        } finally {
            withContext(NonCancellable) { tokenStore.clear() }
        }
    }

    /**
     * Revoke the session on the server, best-effort, WITHOUT clearing any local storage. AN12/R295 gives ALL
     * local clearing to the LocalStore - which clears the tokens along with the record, the cache and the
     * queued sync - so a full sign-out revokes here and clears there, one owner each. A network failure is
     * swallowed (as signOut's is): a device with no connectivity must still be able to sign out and wipe its
     * local record.
     */
    suspend fun revokeServerSession() {
        val pair = tokenStore.load() ?: return
        api.signOut(pair.accessToken)
    }
}
