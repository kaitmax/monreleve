package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
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
    // AN-FIX F4 / R303: the sign-in is the one place a NEW account becomes current. The address the
    // link carried is the only account identity the device can know (/api/v1/me omits it), so the
    // account tag is set here, from it, at the moment B signs in - which is exactly when A's pending
    // days must stop being this device's current record.
    private val accountStore: AccountStore,
    // AN-TOKEN-RACE (R509): the worker's drain, run once the account is current and before SIGNED - the link's half of
    // what CodeController does, so a forced sign-out's held days go up with either way back in. No default (R291).
    private val syncNow: suspend () -> Unit,
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
                        // AN-FIX F4 / R303: make this account current BEFORE clearing the pending address,
                        // from the address the validated link carried. accountTagOf returns null only for a
                        // blank address (which CallbackLink already rejects), so this fails closed rather
                        // than setting a blank tag two people could share.
                        accountTagOf(parsed.email)?.let { accountStore.setCurrent(it) }
                        pending.clear()
                        // R509: the account's held days go up NOW - after the account is current, before SIGNED.
                        sendHeldDays(syncNow)
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
