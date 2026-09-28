package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.ApiFailure
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.CallbackResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// AN4 increment 4 (AC2). Drives the App Link callback: validate the untrusted URI,
// bind it to the pending sign-in address (login-CSRF), exchange, store the pair,
// land signed in. Lives in auth/, not ui/ (fence 5): the screen reads this phase.
//
// The failure set is what the client can HONESTLY tell apart:
//   MALFORMED    - the URI failed validation (wrong host/scheme/path, no token)
//   MISMATCH     - a valid link for an account this device did not request (CSRF)
//   INVALID_LINK - the server's one 400 for unknown/expired/used/wrong-address
//   NETWORK      - could not reach the server
//   GENERIC      - any other refusal
// The server collapses expired/used/unknown into INVALID_LINK by design, so the
// client cannot split those three; that limit is stated in REPORT-AN4.txt.

enum class CallbackPhase { WORKING, SIGNED, INVALID_LINK, MALFORMED, MISMATCH, NETWORK_ERROR, GENERIC_ERROR }

data class CallbackState(val phase: CallbackPhase = CallbackPhase.WORKING)

class CallbackController(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val pending: PendingSignInStore,
    private val scope: CoroutineScope,
) {
    private val mutableState = MutableStateFlow(CallbackState())
    val state: StateFlow<CallbackState> = mutableState.asStateFlow()

    fun handle(uriString: String?) {
        val parsed = CallbackLink.parse(uriString)
        val remembered = pending.pending()?.trim()?.lowercase()
        val incoming = parsed?.email?.trim()?.lowercase()
        val phase =
            when {
                parsed == null -> CallbackPhase.MALFORMED
                remembered == null || remembered != incoming -> CallbackPhase.MISMATCH
                else -> null
            }
        if (phase != null) {
            mutableState.update { it.copy(phase = phase) }
            return
        }
        exchange(requireNotNull(parsed))
    }

    private fun exchange(parsed: CallbackLink.Parsed) {
        mutableState.update { it.copy(phase = CallbackPhase.WORKING) }
        scope.launch {
            val next =
                when (val result = api.exchangeCallback(parsed.token, parsed.email)) {
                    is CallbackResult.Signed -> {
                        tokenStore.save(result.pair)
                        pending.clear()
                        CallbackPhase.SIGNED
                    }
                    CallbackResult.InvalidLink -> CallbackPhase.INVALID_LINK
                    is CallbackResult.Failed ->
                        if (result.failure is ApiFailure.Network) {
                            CallbackPhase.NETWORK_ERROR
                        } else {
                            CallbackPhase.GENERIC_ERROR
                        }
                }
            mutableState.update { it.copy(phase = next) }
        }
    }
}
