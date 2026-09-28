package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.ApiFailure
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.MagicLinkResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// AN4 increment 3. The sign-in request state holder. It lives in auth/, NOT ui/,
// because it calls AuthApi (data/remote) and fence 5 keeps the ui/ layer off the
// network directly. The screen reads this state and calls these methods; it never
// sees a MagicLinkResult or an ApiFailure - the phase is all it needs.
//
// The phase set is deliberately small and semantic: the enumeration guarantee
// (docs/api-v1.md 1.5) means Sent is the one outcome for a 202 whatever the truth,
// so there is no "unknown address" phase to leak one.

enum class SignInPhase { EDITING, SUBMITTING, LINK_SENT, RATE_LIMITED, NETWORK_ERROR, GENERIC_ERROR }

data class SignInState(
    val email: String = "",
    val phase: SignInPhase = SignInPhase.EDITING,
)

class SignInController(
    private val api: AuthApi,
    private val pending: PendingSignInStore,
    private val scope: CoroutineScope,
) {
    private val mutableState = MutableStateFlow(SignInState())
    val state: StateFlow<SignInState> = mutableState.asStateFlow()

    fun onEmailChange(email: String) {
        mutableState.update { it.copy(email = email) }
    }

    fun submit() {
        val email = mutableState.value.email.trim()
        if (email.isEmpty()) return
        // Remember the address BEFORE the request: the callback (increment 4) binds
        // to it, refusing a link fired for any other account (login-CSRF).
        pending.remember(email)
        mutableState.update { it.copy(phase = SignInPhase.SUBMITTING) }
        scope.launch {
            val phase =
                when (val result = api.requestMagicLink(email)) {
                    MagicLinkResult.Sent -> SignInPhase.LINK_SENT
                    MagicLinkResult.RateLimited -> SignInPhase.RATE_LIMITED
                    is MagicLinkResult.Failed ->
                        if (result.failure is ApiFailure.Network) {
                            SignInPhase.NETWORK_ERROR
                        } else {
                            SignInPhase.GENERIC_ERROR
                        }
                }
            mutableState.update { it.copy(phase = phase) }
        }
    }

    fun retry() {
        mutableState.update { it.copy(phase = SignInPhase.EDITING) }
    }
}
