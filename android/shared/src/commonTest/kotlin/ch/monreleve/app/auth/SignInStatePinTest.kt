package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2a R768. THE SIGN-IN STATE, PINNED BEFORE IT MOVES - written in kotlin.test and kotlinx-coroutines-test only, so
// the SAME file runs in :app's test source set against the code as it stands, and then, `git mv`-ed unedited, in
// :shared commonTest against the moved code - on the JVM and on the iOS simulator (R457, the KMP-3 way).
//
// What it pins is what the screens read and the platforms store: each phase each server answer produces, the
// order of the sign-in's side effects (the pair saved, the account made current from the TYPED address, the pending
// address cleared, the held days sent - all before SIGNED), the restore seed's in-flight coercion, CODE_LENGTH and
// the resend cooldown, and the account tag's exact digest (a known SHA-256 vector, so a platform's own digest is
// checked against the one Android has always written into its rows).
//
// The callback's own pins stay in CallbackControllerTest (Kotest, :app): its entry point takes the received URI,
// which stays native (R770). The platform-free half it moves to is pinned by SignInLinkStateTest, written with the
// move - it cannot be pinned before the seam it tests exists.

private const val BASE = "http://test.invalid"
private const val EMAIL = "a@b.ch"

/** SHA-256 of "a@b.ch", computed outside this codebase (node:crypto) - the tag Android has always written. */
private const val EMAIL_TAG = "78ba66f420e8b1af4efef2bc5adb53528eba6959a2e1f2180819a1b92f4200d3"

private const val PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2026-06-15T11:00:00Z","refreshExpiresAt":"2026-09-13T10:00:00Z"}"""

/** Answers every request with the next scripted response (the last one repeats); records what was asked. */
private class PinTransport(
    vararg responses: HttpResponse,
    private val failWith: String? = null,
) : HttpTransport {
    private val queue = responses.toMutableList()
    val asked = mutableListOf<HttpRequest>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        asked += request
        failWith?.let { throw TransportException(it) }
        return if (queue.size > 1) queue.removeAt(0) else queue.single()
    }
}

private class PinPendingStore(
    initial: String? = null,
    val events: MutableList<String> = mutableListOf(),
) : PendingSignInStore {
    var value: String? = initial

    override fun remember(email: String) {
        value = email
        events += "remember"
    }

    override fun pending(): String? = value

    override fun clear() {
        value = null
        events += "clear"
    }
}

private class PinTokenStore(
    private val events: MutableList<String>,
) : TokenStore {
    var saved: TokenPair? = null

    override fun save(pair: TokenPair) {
        saved = pair
        events += "save"
    }

    override fun load(): TokenPair? = saved

    override fun clear() {
        saved = null
    }
}

private class PinAccountStore(
    private val events: MutableList<String>,
) : AccountStore {
    var tag: String? = null

    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
        events += "account"
    }

    override fun clear() {
        tag = null
    }
}

private fun refusal(code: String): String = """{"status":"error","code":"$code"}"""

@OptIn(ExperimentalCoroutinesApi::class)
class SignInStatePinTest {
    // --- the request screen ---------------------------------------------------------------------------------------

    private fun TestScope.signIn(
        transport: HttpTransport,
        pending: PendingSignInStore = PinPendingStore(),
        restored: SignInSnapshot? = null,
    ) = SignInController(AuthApi(transport, BASE), pending, this, restored)

    @Test
    fun aBlankAddressNeverLeavesEditingAndAsksNothing() =
        runTest {
            val transport = PinTransport(HttpResponse(202, ""))
            val controller = signIn(transport)
            controller.onEmailChange("   ")
            controller.submit()
            advanceUntilIdle()
            assertEquals(SignInPhase.EDITING, controller.state.value.phase)
            assertTrue(transport.asked.isEmpty())
        }

    @Test
    fun eachRequestAnswerHasItsPhase() =
        runTest {
            val cases =
                listOf(
                    PinTransport(HttpResponse(202, "")) to SignInPhase.LINK_SENT,
                    PinTransport(HttpResponse(429, "")) to SignInPhase.RATE_LIMITED,
                    PinTransport(HttpResponse(500, "")) to SignInPhase.GENERIC_ERROR,
                    PinTransport(HttpResponse(202, ""), failWith = "no route") to SignInPhase.NETWORK_ERROR,
                )
            for ((transport, expected) in cases) {
                val controller = signIn(transport)
                controller.onEmailChange(EMAIL)
                controller.submit()
                assertEquals(SignInPhase.SUBMITTING, controller.state.value.phase)
                advanceUntilIdle()
                assertEquals(expected, controller.state.value.phase)
            }
        }

    @Test
    fun submitRemembersTheTrimmedAddressBeforeItAsks() =
        runTest {
            val pending = PinPendingStore()
            val transport = PinTransport(HttpResponse(202, ""))
            val controller = signIn(transport, pending)
            controller.onEmailChange("  $EMAIL  ")
            controller.submit()
            assertEquals(EMAIL, pending.value)
            assertTrue(transport.asked.isEmpty(), "the address is remembered before the request is sent")
            advanceUntilIdle()
            assertEquals(1, transport.asked.size)
            assertEquals("$BASE/api/v1/auth/magic-link", transport.asked.single().url)
        }

    @Test
    fun retryReturnsToEditingWithTheAddressKept() =
        runTest {
            val controller = signIn(PinTransport(HttpResponse(500, "")))
            controller.onEmailChange(EMAIL)
            controller.submit()
            advanceUntilIdle()
            controller.retry()
            assertEquals(SignInPhase.EDITING, controller.state.value.phase)
            assertEquals(EMAIL, controller.state.value.email)
        }

    @Test
    fun aRestoredSubmitBecomesEditingAndAStablePhaseIsKept() =
        runTest {
            val idle = PinTransport(HttpResponse(202, ""))
            val inFlight = signIn(idle, restored = SignInSnapshot(EMAIL, SignInPhase.SUBMITTING))
            assertEquals(SignInPhase.EDITING, inFlight.state.value.phase)
            assertEquals(EMAIL, inFlight.state.value.email)
            val sent = signIn(idle, restored = SignInSnapshot(EMAIL, SignInPhase.LINK_SENT))
            assertEquals(SignInPhase.LINK_SENT, sent.state.value.phase)
        }

    // --- the code screen ------------------------------------------------------------------------------------------

    private fun TestScope.code(
        transport: HttpTransport,
        events: MutableList<String> = mutableListOf(),
        pending: PinPendingStore = PinPendingStore(EMAIL),
        restored: CodeSnapshot? = null,
    ): Triple<CodeController, PinTokenStore, PinAccountStore> {
        val tokens = PinTokenStore(events)
        val accounts = PinAccountStore(events)
        val controller =
            CodeController(
                AuthApi(transport, BASE),
                tokens,
                pending,
                accounts,
                EMAIL,
                this,
                syncNow = { events += "sync" },
                restored = restored,
            )
        return Triple(controller, tokens, accounts)
    }

    @Test
    fun theCodeIsSixDigitsAndTheCooldownSixtySeconds() {
        assertEquals(6, CODE_LENGTH)
        assertEquals(60, RESEND_COOLDOWN_SECONDS)
    }

    @Test
    fun onlyDigitsAreKeptAndTheSixthSubmits() =
        runTest {
            val transport = PinTransport(HttpResponse(400, refusal("invalid_code")))
            val (controller) = code(transport)
            controller.onCodeChange("12a 3")
            assertEquals("123", controller.state.value.code)
            assertEquals(CodePhase.EDITING, controller.state.value.phase)
            controller.submit()
            runCurrent()
            assertTrue(transport.asked.isEmpty(), "fewer than six digits never submits")
            controller.onCodeChange("1234567")
            assertEquals("123456", controller.state.value.code)
            assertEquals(CodePhase.SUBMITTING, controller.state.value.phase)
            runCurrent()
            assertEquals("$BASE/api/v1/auth/code", transport.asked.single().url)
            assertEquals(CodePhase.WRONG_CODE, controller.state.value.phase)
            controller.onCodeChange("12345")
            assertEquals(CodePhase.EDITING, controller.state.value.phase, "a changed digit clears the refusal")
            advanceUntilIdle()
        }

    @Test
    fun eachRefusalHasItsOwnPhase() =
        runTest {
            val cases =
                listOf(
                    HttpResponse(400, refusal("invalid_code")) to CodePhase.WRONG_CODE,
                    HttpResponse(400, refusal("code_expired")) to CodePhase.EXPIRED,
                    HttpResponse(429, refusal("too_many_attempts")) to CodePhase.TOO_MANY,
                    HttpResponse(429, refusal("rate_limited")) to CodePhase.RATE_LIMITED,
                    HttpResponse(500, "") to CodePhase.GENERIC_ERROR,
                )
            for ((response, expected) in cases) {
                val (controller, tokens, accounts) = code(PinTransport(response))
                controller.onCodeChange("123456")
                runCurrent()
                assertEquals(expected, controller.state.value.phase, "for ${response.status} ${response.body}")
                assertNull(tokens.saved)
                assertNull(accounts.tag)
            }
            val (offline) = code(PinTransport(HttpResponse(200, PAIR_BODY), failWith = "no route"))
            offline.onCodeChange("123456")
            runCurrent()
            assertEquals(CodePhase.NETWORK_ERROR, offline.state.value.phase)
            advanceUntilIdle()
        }

    @Test
    fun signedSavesTheAccountClearsThePendingAndSendsBeforeReportingSigned() =
        runTest {
            val events = mutableListOf<String>()
            val pending = PinPendingStore(EMAIL, events)
            val (controller, tokens, accounts) = code(PinTransport(HttpResponse(200, PAIR_BODY)), events, pending)
            controller.onCodeChange("123456")
            runCurrent()
            assertEquals(CodePhase.SIGNED, controller.state.value.phase)
            assertEquals("acc", tokens.saved?.accessToken)
            assertEquals(EMAIL_TAG, accounts.tag)
            assertNull(pending.value)
            assertEquals(listOf("save", "account", "clear", "sync"), events)
            advanceUntilIdle()
        }

    @Test
    fun theResendWaitsForTheCountdownThenAsksAgainAndRestartsIt() =
        runTest {
            val transport = PinTransport(HttpResponse(202, ""))
            val (controller) = code(transport)
            assertEquals(RESEND_COOLDOWN_SECONDS, controller.state.value.resendSeconds)
            controller.resend()
            runCurrent()
            assertTrue(transport.asked.isEmpty(), "no resend before the cooldown ends")
            advanceTimeBy(RESEND_COOLDOWN_SECONDS * 1000L + 1)
            assertEquals(0, controller.state.value.resendSeconds)
            controller.onCodeChange("12")
            controller.resend()
            runCurrent()
            assertEquals("$BASE/api/v1/auth/magic-link", transport.asked.single().url)
            assertEquals("", controller.state.value.code)
            assertEquals(CodePhase.EDITING, controller.state.value.phase)
            assertEquals(RESEND_COOLDOWN_SECONDS, controller.state.value.resendSeconds)
            advanceUntilIdle()
        }

    @Test
    fun aRestoredCodeKeepsItsDigitsAndNeverAnInFlightSubmit() =
        runTest {
            val idle = PinTransport(HttpResponse(202, ""))
            val (controller) = code(idle, restored = CodeSnapshot("123", CodePhase.SUBMITTING))
            assertEquals("123", controller.state.value.code)
            assertEquals(CodePhase.EDITING, controller.state.value.phase)
            val (wrong) = code(idle, restored = CodeSnapshot("123456", CodePhase.WRONG_CODE))
            assertEquals(CodePhase.WRONG_CODE, wrong.state.value.phase)
            advanceUntilIdle()
        }

    // --- the account tag ------------------------------------------------------------------------------------------

    @Test
    fun theAccountTagIsTheSha256OfTheNormalisedAddress() {
        assertEquals(EMAIL_TAG, accountTagOf(EMAIL))
        assertEquals(EMAIL_TAG, accountTagOf("  A@B.CH "))
        assertNull(accountTagOf("   "))
    }
}
