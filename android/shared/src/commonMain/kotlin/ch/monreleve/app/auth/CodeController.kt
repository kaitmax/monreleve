package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.remote.ApiFailure
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.CodeExchangeResult
import ch.monreleve.app.data.remote.MagicLinkResult
import ch.monreleve.app.shared.PlatformSerializable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// AN-ONBOARD. The six-digit code screen's state holder - the second way in beside the App Link callback
// (R195 leaves the callback exactly as it was; this is ADDITIONAL). Lives in auth/, not ui/ (fence 5): it
// calls AuthApi and stores the pair; the screen reads this phase.
//
// On SIGNED it does exactly what CallbackController does on a valid link: store the pair, make this account
// current (from the address the person typed - /api/v1/me omits it), clear the pending sign-in, land signed
// in. Each refusal is its OWN phase so the screen can say how to recover (R198), never just "erreur".
//
// IOS-2a R768: MOVED TO :shared commonMain with its state, package unchanged, so every :app import resolves as before.
// The restore seed's supertype is PlatformSerializable: java.io.Serializable on Android, the same bytes in the Bundle.

enum class CodePhase {
    EDITING,
    SUBMITTING,
    SIGNED,
    WRONG_CODE,
    EXPIRED,
    TOO_MANY,
    RATE_LIMITED,
    NETWORK_ERROR,
    GENERIC_ERROR,
}

const val CODE_LENGTH = 6

/** The resend cooldown, in seconds (the mockup's "0:42" countdown). */
const val RESEND_COOLDOWN_SECONDS = 60

data class CodeState(
    val code: String = "",
    val phase: CodePhase = CodePhase.EDITING,
    val resendSeconds: Int = RESEND_COOLDOWN_SECONDS,
    val resending: Boolean = false,
)

/**
 * AN-ONBOARD (R310): the typed digits and a stable phase restored across a rebuild. The resend countdown is
 * NOT preserved - it restarts from the full cooldown, which is the safe direction (a person is never shown
 * "resend now" earlier than the cooldown allows). An in-flight SUBMITTING is coerced to EDITING on restore
 * (R181: a spinner attached to no request is a lie).
 */
data class CodeSnapshot(
    val code: String = "",
    val phase: CodePhase = CodePhase.EDITING,
) : PlatformSerializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
}

// LongParameterList suppressed: these ARE the sign-in dependencies (the same set CallbackController takes,
// plus the address this screen exchanges and the restore seam) - bundling them into a holder would only move
// the list. auth/ is not scanned by the no-literal fence, so the annotation is permitted here.
@Suppress("LongParameterList")
class CodeController(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val pending: PendingSignInStore,
    private val accountStore: AccountStore,
    private val email: String,
    private val scope: CoroutineScope,
    // AN-TOKEN-RACE (R509): the drain the worker runs (buildSyncEngine), run once the account is current and before
    // SIGNED, so days a forced sign-out left held go up with the sign-in (SignInSync.kt says why there and then).
    // No default (R291): a sign-in that forgot it would leave them waiting for the next tap again.
    private val syncNow: suspend () -> Unit,
    restored: CodeSnapshot? = null,
) {
    private val mutableState =
        MutableStateFlow(
            restored?.let {
                CodeState(
                    code = it.code,
                    phase = if (it.phase == CodePhase.SUBMITTING) CodePhase.EDITING else it.phase,
                )
            } ?: CodeState(),
        )
    val state: StateFlow<CodeState> = mutableState.asStateFlow()

    init {
        startCountdown()
    }

    private fun startCountdown() {
        mutableState.update { it.copy(resendSeconds = RESEND_COOLDOWN_SECONDS) }
        scope.launch {
            while (mutableState.value.resendSeconds > 0) {
                delay(1000)
                mutableState.update { it.copy(resendSeconds = (it.resendSeconds - 1).coerceAtLeast(0)) }
            }
        }
    }

    /** Keep only digits, cap at six; a wrong-code error clears as soon as a digit changes; the sixth submits. */
    fun onCodeChange(raw: String) {
        val digits = raw.filter(Char::isDigit).take(CODE_LENGTH)
        mutableState.update { it.copy(code = digits, phase = CodePhase.EDITING) }
        if (digits.length == CODE_LENGTH) submit()
    }

    fun submit() {
        val code = mutableState.value.code
        if (code.length != CODE_LENGTH) return
        mutableState.update { it.copy(phase = CodePhase.SUBMITTING) }
        scope.launch {
            val next =
                when (val result = api.exchangeCode(email, code)) {
                    is CodeExchangeResult.Signed -> {
                        tokenStore.save(result.pair)
                        // From the address the person typed, make this account current BEFORE clearing the
                        // pending address (the same order and reason as CallbackController, AN-FIX F4 / R303).
                        accountTagOf(email)?.let { accountStore.setCurrent(it) }
                        pending.clear()
                        // R509: what this phone holds for the account goes up NOW - after the account is
                        // current, before SIGNED sends the screen on to the year download.
                        sendHeldDays(syncNow)
                        CodePhase.SIGNED
                    }
                    CodeExchangeResult.WrongCode -> CodePhase.WRONG_CODE
                    CodeExchangeResult.Expired -> CodePhase.EXPIRED
                    CodeExchangeResult.TooManyAttempts -> CodePhase.TOO_MANY
                    CodeExchangeResult.RateLimited -> CodePhase.RATE_LIMITED
                    is CodeExchangeResult.Failed ->
                        if (result.failure is ApiFailure.Network) CodePhase.NETWORK_ERROR else CodePhase.GENERIC_ERROR
                }
            mutableState.update { it.copy(phase = next) }
        }
    }

    /** Ask for a fresh link+code (only enabled once the countdown ends), then restart the cooldown. */
    fun resend() {
        if (mutableState.value.resendSeconds > 0 || mutableState.value.resending) return
        mutableState.update { it.copy(resending = true) }
        scope.launch {
            val phase =
                when (api.requestMagicLink(email)) {
                    MagicLinkResult.Sent -> CodePhase.EDITING
                    MagicLinkResult.RateLimited -> CodePhase.RATE_LIMITED
                    is MagicLinkResult.Failed -> CodePhase.NETWORK_ERROR
                }
            mutableState.update { it.copy(code = "", phase = phase, resending = false) }
            if (phase == CodePhase.EDITING) startCountdown()
        }
    }
}
