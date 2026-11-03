package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.auth.CallbackController
import ch.monreleve.app.auth.CallbackPhase
import ch.monreleve.app.auth.CallbackState
import ch.monreleve.app.auth.CodeController
import ch.monreleve.app.auth.CodePhase
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.auth.SignInLink
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.CallbackCopy
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.ui.screens.signin.CallbackScreen
import ch.monreleve.app.ui.screens.signin.CodeActions
import ch.monreleve.app.ui.screens.signin.CodeScreen
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen
import ch.monreleve.app.ui.screens.signin.SignInActions
import ch.monreleve.app.ui.screens.signin.WelcomeScreen
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2a R772. THE SHARED SIGN-IN SCREENS, COMPOSED AND DRIVEN ON THE iOS SIMULATOR, OVER A FAKE TRANSPORT.
//
// The four screens and the three controllers that moved to commonMain, hosted the way MainActivity hosts them on
// Android (Welcome -> the address -> the code -> signed in), with the REAL controllers over the REAL AuthApi on an
// in-memory transport: no server, no account, no real address (the domain is .invalid). One refusal is driven on the
// code screen (a wrong code), one on the callback screen (a refused link through the R770 contract).
//
// R574: the six digits typed here are this file's fixtures, not a code anyone was sent, and nothing in this file
// prints a code or captures a screen. Strings are read from fr/, never retyped (R181).

private const val ADDRESS = "ios-2a.pilot@monreleve.invalid"
private const val GOOD_CODE = "424242"
private const val WRONG_CODE = "111111"
private const val PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2026-06-15T11:00:00Z","refreshExpiresAt":"2026-09-13T10:00:00Z"}"""

/** The server, faked: a link request is accepted; the code is right or wrong; a callback link is refused. */
private class FakeAuthServer : HttpTransport {
    val paths = mutableListOf<String>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        val path = request.url.substringAfter("monreleve.invalid").substringBefore('?')
        paths += "${request.method} $path"
        return when {
            path == "/api/v1/auth/magic-link" -> HttpResponse(202, "")
            path == "/api/v1/auth/code" && request.method == HttpMethod.POST &&
                request.body?.contains(GOOD_CODE) == true ->
                HttpResponse(200, PAIR_BODY)
            path == "/api/v1/auth/code" -> HttpResponse(400, """{"status":"error","code":"invalid_code"}""")
            else -> HttpResponse(400, """{"status":"error","code":"invalid_link"}""")
        }
    }
}

private class MemoryPending : PendingSignInStore {
    var value: String? = null

    override fun remember(email: String) {
        value = email.trim().lowercase()
    }

    override fun pending(): String? = value

    override fun clear() {
        value = null
    }
}

private class MemoryTokens : TokenStore {
    var pair: TokenPair? = null

    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

private class MemoryAccount : AccountStore {
    var tag: String? = null

    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
    }

    override fun clear() {
        tag = null
    }
}

private enum class Step { WELCOME, EMAIL, CODE, SIGNED }

/** MainActivity's SignInRoute, reduced to its calls: the same screens, the same controllers, the same hand-offs. */
@Composable
private fun SignInHost(
    api: AuthApi,
    pending: MemoryPending,
    tokens: MemoryTokens,
    account: MemoryAccount,
) {
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(Step.WELCOME) }
    val signIn = remember { SignInController(api, pending, scope) }
    val signInState by signIn.state.collectAsState()
    LaunchedEffect(signInState.phase) { if (signInState.phase == SignInPhase.LINK_SENT) step = Step.CODE }
    FrontierTheme {
        when (step) {
            Step.WELCOME -> WelcomeScreen(onStart = { step = Step.EMAIL })
            Step.EMAIL ->
                RequestLinkScreen(
                    state = signInState,
                    actions = SignInActions(signIn::onEmailChange, signIn::submit, signIn::retry, {}, {}, {}),
                    sessionClosedHeldDays = null,
                )
            Step.CODE -> {
                val code =
                    remember {
                        CodeController(api, tokens, pending, account, signInState.email.trim(), scope, syncNow = {})
                    }
                val codeState by code.state.collectAsState()
                LaunchedEffect(codeState.phase) { if (codeState.phase == CodePhase.SIGNED) step = Step.SIGNED }
                CodeScreen(
                    email = signInState.email.trim(),
                    state = codeState,
                    actions = CodeActions(code::onCodeChange, code::submit, {}, code::resend, {}),
                )
            }
            Step.SIGNED -> CallbackScreen(state = CallbackState(CallbackPhase.SIGNED), onBackToSignIn = {})
        }
    }
}

@OptIn(ExperimentalTestApi::class)
class SignInScreensIosTest {
    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    private fun SemanticsNodeInteractionsProvider.tap(label: String) =
        onAllNodes(hasText(label) and hasClickAction()).onFirst().performClick()

    /** The code screen's n-th box: the text field that carries that box's spoken label. */
    private fun SemanticsNodeInteractionsProvider.digitBox(n: Int) =
        onAllNodes(hasContentDescription(CodeCopy.digitLabel(n)) and hasSetTextAction()).onFirst()

    @Test
    fun aLinkIsRequestedAWrongCodeIsRefusedAndTheRightOneSignsIn() =
        runComposeUiTest {
            val server = FakeAuthServer()
            val pending = MemoryPending()
            val tokens = MemoryTokens()
            val account = MemoryAccount()
            setContent { SignInHost(AuthApi(server, "https://monreleve.invalid"), pending, tokens, account) }

            waitUntil(timeoutMillis = TIMEOUT) { shows(WelcomeCopy.TITLE) }
            tap(WelcomeCopy.START)

            waitUntil(timeoutMillis = TIMEOUT) { shows(SignInCopy.TITLE) }
            onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(ADDRESS)
            tap(SignInCopy.SUBMIT)

            waitUntil(timeoutMillis = TIMEOUT) { shows(CodeCopy.TITLE) }
            assertEquals(ADDRESS, pending.value, "the address is remembered for the callback's MISMATCH check")
            assertTrue(shows(CodeCopy.SENT_TO_PREFIX + ADDRESS), "the code screen names the address")

            digitBox(1).performTextReplacement(WRONG_CODE)
            waitUntil(timeoutMillis = TIMEOUT) { shows(CodeCopy.ERROR_WRONG_CODE) }
            assertNull(tokens.pair, "a refused code stores nothing")
            assertNull(account.tag)

            digitBox(1).performTextReplacement(GOOD_CODE)
            waitUntil(timeoutMillis = TIMEOUT) { shows(CallbackCopy.SIGNED_TITLE) }
            assertEquals("acc", tokens.pair?.accessToken)
            assertEquals(accountTagOf(ADDRESS), account.tag)
            assertNull(pending.value, "signed in: the pending address is cleared")
            assertEquals(
                listOf("POST /api/v1/auth/magic-link", "POST /api/v1/auth/code", "POST /api/v1/auth/code"),
                server.paths,
            )
        }

    @Test
    fun aRefusedLinkSaysSoAndOffersTheWayBack() =
        runComposeUiTest {
            val pending = MemoryPending().also { it.remember(ADDRESS) }
            val tokens = MemoryTokens()
            var controller: CallbackController? = null
            setContent {
                val scope = rememberCoroutineScope()
                val callback =
                    remember {
                        CallbackController(
                            AuthApi(FakeAuthServer(), "https://monreleve.invalid"),
                            tokens,
                            pending,
                            scope,
                            MemoryAccount(),
                            syncNow = {},
                        ).also { controller = it }
                    }
                val state by callback.state.collectAsState()
                FrontierTheme { CallbackScreen(state = state, onBackToSignIn = {}) }
            }
            waitForIdle()
            checkNotNull(controller).handleLink(SignInLink(token = "fixture-token", email = ADDRESS))
            waitUntil(timeoutMillis = TIMEOUT) { shows(CallbackCopy.INVALID_LINK) }
            assertTrue(shows(CallbackCopy.BACK_TO_SIGN_IN), "the refusal offers the way back")
            assertNull(tokens.pair)
            assertEquals(ADDRESS, pending.value, "a refused link leaves the request pending")
        }

    private companion object {
        const val TIMEOUT = 10_000L
    }
}
