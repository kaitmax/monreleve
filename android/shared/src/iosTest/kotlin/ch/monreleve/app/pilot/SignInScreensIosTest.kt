package ch.monreleve.app.pilot

import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.test.ComposeUiTest
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
import ch.monreleve.app.Destination
import ch.monreleve.app.ShellRouter
import ch.monreleve.app.SignInRoute
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.auth.CallbackController
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEnds
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SignInLink
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.CallbackCopy
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.ui.screens.signin.CallbackScreen
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2a R772. THE SHARED SIGN-IN SCREENS, COMPOSED AND DRIVEN ON THE iOS SIMULATOR, OVER A FAKE TRANSPORT.
//
// IOS-SHELL-1 (R1328, R268). THE REAL ROUTE, NOT A REDUCTION OF IT. Until this task the sign-in routes were private to
// :app's MainActivity, so this file drove a hand-written SignInHost that "reduced MainActivity's SignInRoute to its
// calls". The routes are common now (ShellRoutes.kt), so the reduction is DELETED and the tests drive the extracted
// SignInRoute and ShellRouter themselves - the code both platforms run. THE CASE MAP:
//   aLinkIsRequestedAWrongCodeIsRefusedAndTheRightOneSignsIn (over SignInHost)
//     -> theRealSignInRouteRequestsACodeRefusesAWrongOneAndSignsInWithTheRightOne (over SignInRoute): the same
//        steps, stores, refusals and requests; "signed in" is now the route's own onSignedIn (the hand-off to
//        RESOLVING), where the reduction drew a CallbackScreen of its own choosing.
//   aRefusedLinkSaysSoAndOffersTheWayBack -> unchanged: it drives CallbackController and CallbackScreen, never the
//        reduction, so nothing about it was hand-written route code.
//   (new) theShellRouterTakesAFreshSignInThroughResolvingToMain: ShellRouter from SIGN_IN, the code accepted,
//        RESOLVING's GET /api/v1/me answered for a complete account, the MAIN slot shown - the switch iOS's
//        composition runs.
// The legal and mail hand-offs are recorded, not opened (iOS's are IOS-SHELL-2's, G7).
//
// R574: the six digits typed here are this file's fixtures, not a code anyone was sent, and nothing in this file
// prints a code or captures a screen. Strings are read from fr/, never retyped (R181). Every wait is bounded
// (BoundedWait.kt, R807): IOS-2c-FIX's allowlist line for this file is deleted with its six raw waits.

private const val ADDRESS = "ios-2a.pilot@monreleve.invalid"
private const val GOOD_CODE = "424242"
private const val WRONG_CODE = "111111"
private const val PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2099-06-15T11:00:00Z","refreshExpiresAt":"2099-09-13T10:00:00Z"}"""

// fixtures/me-cases.json's "route: complete, simplified basis, manual" - a complete account, so RESOLVING says Main.
private const val COMPLETE_ME =
    """{"name":"Camille Rey","canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240",""" +
        """"exactTotalWorkDays":null,"granularity":"DAY","activityStartDate":null,"reminderTime":"17:30",""" +
        """"reminderEnabled":false,"loggingMode":"MANUAL","detectionConsentAt":null}"""
private const val MAIN_MARKER = "the MAIN slot"
private const val TIMEOUT = 10_000L

/** The server, faked: a code is requested; the code is right or wrong; /me answers; a callback link is refused. */
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
            path == "/api/v1/me" && request.method == HttpMethod.GET -> HttpResponse(200, COMPLETE_ME)
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

/** No rows: the router reads observePending only for a server-ended session, which these cases are not. */
private class NoRows : EntryRepository {
    override suspend fun record(command: RecordCommand): RecordResult = error("the sign-in never records a day")

    override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())
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

    private fun ComposeUiTest.waitFor(text: String) = waitBounded("shows <$text>", TIMEOUT) { shows(text) }

    /** Welcome -> the address -> the code screen, then a wrong code refused - the steps both cases share. */
    private fun ComposeUiTest.toTheCodeAndAWrongOne(
        pending: MemoryPending,
        tokens: MemoryTokens,
    ) {
        waitFor(WelcomeCopy.TITLE)
        tap(WelcomeCopy.START)
        waitFor(SignInCopy.TITLE)
        onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(ADDRESS)
        tap(SignInCopy.SUBMIT)
        waitFor(CodeCopy.TITLE)
        assertEquals(ADDRESS, pending.value, "the address is remembered for the callback's MISMATCH check")
        assertTrue(shows(CodeCopy.SENT_TO_PREFIX + ADDRESS), "the code screen names the address")
        digitBox(1).performTextReplacement(WRONG_CODE)
        waitFor(CodeCopy.ERROR_WRONG_CODE)
        assertNull(tokens.pair, "a refused code stores nothing")
    }

    @Test
    fun theRealSignInRouteRequestsACodeRefusesAWrongOneAndSignsInWithTheRightOne() =
        runComposeUiTest {
            val server = FakeAuthServer()
            val pending = MemoryPending()
            val tokens = MemoryTokens()
            val account = MemoryAccount()
            var signedIn = 0
            val legal = mutableListOf<LegalPage>()
            setContent {
                FrontierTheme {
                    SignInRoute(
                        api = AuthApi(server, "https://monreleve.invalid"),
                        tokenStore = tokens,
                        pending = pending,
                        accountStore = account,
                        scope = rememberCoroutineScope(),
                        sessionClosed = false,
                        sessionClosedHeldDays = null,
                        syncNow = {},
                        onOpenLegal = { legal += it },
                        onOpenMail = {},
                        onSignedIn = { signedIn += 1 },
                    )
                }
            }
            toTheCodeAndAWrongOne(pending, tokens)
            assertNull(account.tag)
            assertEquals(0, signedIn, "a refused code hands nothing on")

            digitBox(1).performTextReplacement(GOOD_CODE)
            waitBounded("the route hands the sign-in on", TIMEOUT) { signedIn == 1 }
            assertEquals("acc", tokens.pair?.accessToken)
            assertEquals(accountTagOf(ADDRESS), account.tag)
            assertNull(pending.value, "signed in: the pending address is cleared")
            assertEquals(
                listOf("POST /api/v1/auth/magic-link", "POST /api/v1/auth/code", "POST /api/v1/auth/code"),
                server.paths,
            )
            assertEquals(emptyList(), legal, "nothing here opened a legal page")
        }

    @Test
    fun theShellRouterTakesAFreshSignInThroughResolvingToMain() =
        runComposeUiTest {
            val server = FakeAuthServer()
            val pending = MemoryPending()
            val tokens = MemoryTokens()
            val account = MemoryAccount()
            val api = AuthApi(server, "https://monreleve.invalid")
            val settings = InMemorySettingsStore(null)
            val modes = mutableListOf<LoggingMode>()
            val reminders = mutableListOf<Boolean>()
            var afterSignIn = 0
            setContent {
                FrontierTheme {
                    ShellRouter(
                        start = Destination.SIGN_IN,
                        session = remember { SessionManager(api, tokens) },
                        api = api,
                        tokenStore = tokens,
                        pending = pending,
                        accountStore = account,
                        repository = remember { NoRows() },
                        settingsStore = settings,
                        scope = rememberCoroutineScope(),
                        sessionEnds = remember { SessionEnds() },
                        syncNow = {},
                        onOpenLegal = {},
                        onOpenMail = {},
                        restoreMode = { modes += it },
                        restoreReminder = { reminders += it },
                        afterSignIn = { afterSignIn += 1 },
                        onboarding = { _, _ -> Text("onboarding") },
                        main = { _ -> Text(MAIN_MARKER) },
                    )
                }
            }
            toTheCodeAndAWrongOne(pending, tokens)
            digitBox(1).performTextReplacement(GOOD_CODE)
            waitFor(MAIN_MARKER)
            assertEquals(accountTagOf(ADDRESS), account.tag)
            assertEquals(1, afterSignIn, "RESOLVING starts the year download once")
            assertEquals(listOf(LoggingMode.MANUAL), modes, "the server's mode restored on the phone")
            assertEquals(listOf(false), reminders, "the server's evening opt-in restored on the phone")
            assertEquals("GE", settings.load()?.canton, "a complete account's settings are cached")
            assertEquals("GET /api/v1/me", server.paths.last(), "RESOLVING asked GET /api/v1/me")
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
            waitFor(CallbackCopy.INVALID_LINK)
            assertTrue(shows(CallbackCopy.BACK_TO_SIGN_IN), "the refusal offers the way back")
            assertNull(tokens.pair)
            assertEquals(ADDRESS, pending.value, "a refused link leaves the request pending")
        }
}
