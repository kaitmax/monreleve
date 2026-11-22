package ch.monreleve.app.ios

import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.sync.ENTRIES_PATH
import ch.monreleve.app.data.sync.serverRow
import ch.monreleve.app.data.sync.yearBody
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.fr.WelcomeCopy
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSLock
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-SHELL-3 R1371 (iOS Ruling 15 Q2 - A SHIP BLOCKER). THE YEAR DOWNLOADS ON iOS, PROVEN THROUGH THE SHELL (R204):
// never by calling the downloader - the person signs in on the shell's own screens, or the signed-in shell opens, and
// the server's year is asserted IN THE iOS DATABASE (the real one, in the rig's temporary directory).
//
//   - a sign-in brings the prior year down (R481): the rows land under the account the sign-in tagged;
//   - an ending stops a download in flight (iOS's session-end seam): a GET that answers AFTER the sign-out writes
//     NOTHING, neither under the account that left nor under the next one to sign in - and its POSITIVE CONTROL, the
//     same held GET released with no ending, writes;
//   - a day the download brings for today takes today's evening reminder off the plan (the ruling's own reason: "
//     reminders fire for days already recorded elsewhere").
//
// THE HELD GET ANSWERS AS NSURLSession WOULD: it resumes through a NON-cancellable suspension (suspendCoroutine), so a
// stop that relied only on the double being cancellable would be caught - the body still arrives after the ending.
// R574: the six digits typed here are a fixture, not a code anyone was sent; nothing prints a code or captures a
// screen.

private const val FIXTURE_CODE = "424242"
private const val SIGN_IN_PAIR =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2099-06-15T11:00:00Z","refreshExpiresAt":"2099-09-13T10:00:00Z"}"""

/** One server row of [day] for this file's years - a full home day, as 6.2 serves it. */
private fun dayRow(day: String) = serverRow(id = "srv-$day", mutation = "m-$day", day = day, kind = "HOME")

/** The answers a person signing in by code meets: the request, the code, a complete /me. */
private fun signInAnswers(
    method: String,
    path: String,
): HttpResponse =
    when {
        path == "/api/v1/auth/magic-link" -> HttpResponse(202, "")
        method == "POST" && path == "/api/v1/auth/code" -> HttpResponse(200, SIGN_IN_PAIR)
        method == "GET" && path == "/api/v1/me" -> HttpResponse(200, SHELL_COMPLETE_ME)
        else -> HttpResponse(200, "{}")
    }

/** A GET that waits for [gate] the way an NSURLSession completion would: not cancellable, it always comes back. */
private suspend fun heldUntil(gate: CompletableDeferred<Unit>) =
    suspendCoroutine { done -> gate.invokeOnCompletion { done.resume(Unit) } }

@OptIn(ExperimentalTestApi::class)
class IosShellYearDownloadsIosTest {
    private fun ComposeUiTest.signInThroughTheShell() {
        tap(WelcomeCopy.START)
        waitFor("the address screen") { shows(SignInCopy.TITLE) }
        onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(SHELL_ADDRESS)
        tap(SignInCopy.SUBMIT)
        waitFor("the code screen") { shows(CodeCopy.TITLE) }
        onAllNodes(hasContentDescription(CodeCopy.digitLabel(1)) and hasSetTextAction())
            .onFirst()
            .performTextReplacement(FIXTURE_CODE)
        waitFor("the tabs, after RESOLVING") { clickable(NavCopy.PARAMETRES) }
    }

    private fun ComposeUiTest.signOutThroughTheShell() {
        openParametres()
        waitFor("the Paramètres tab's sign-out row") { clickable(ParametresCopy.SIGN_OUT) }
        onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onFirst().performScrollTo()
        onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onFirst().performClick()
        waitFor("the sign-out confirmation") { shows(ParametresCopy.SIGN_OUT_CONFIRM_BODY) }
        onAllNodes(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()).onLast().performClick()
        waitFor("back on Bienvenue after the sign-out") { shows(WelcomeCopy.TITLE) }
    }

    private fun ShellRig.days(): List<String> = runBlocking { database.entryDao().all() }.map { it.dayDate }

    private fun ShellRig.daysOf(account: String): List<String> =
        runBlocking { database.entryDao().all() }.filter { it.accountTag == account }.map { it.dayDate }

    private fun ShellRig.entryGets(): Int = transport.requests.count { it == "GET $ENTRIES_PATH" }

    @Test
    fun aSignInThroughTheShellBringsThePriorYearIntoTheIosDatabase() =
        runComposeUiTest {
            val server =
                RecordingTransport(
                    route = { request, path ->
                        if (request.method.name == "GET" && path == ENTRIES_PATH) {
                            val year = checkNotNull(yearOf(request))
                            val prior = listOf(dayRow("2025-12-30"), dayRow("2025-12-31"))
                            HttpResponse(200, yearBody(year, if (year == 2025) prior else emptyList()))
                        } else {
                            null
                        }
                    },
                    answer = ::signInAnswers,
                )
            val rig =
                ShellRig(
                    marked = true,
                    pair = null,
                    pendingAddress = null,
                    account = null,
                    settings = null,
                    transport = server,
                )
            try {
                setShellContent(rig)
                assertEquals(emptyList(), rig.days(), "the BEFORE: a fresh phone holds no day")
                signInThroughTheShell()
                val account = checkNotNull(accountTagOf(SHELL_ADDRESS))
                waitFor("R481: the prior year's two days are in the iOS database, under the signed-in account") {
                    rig.daysOf(account).containsAll(listOf("2025-12-30", "2025-12-31"))
                }
                assertTrue(
                    server.fullRequests.containsAll(
                        listOf("GET $ENTRIES_PATH?year=2026", "GET $ENTRIES_PATH?year=2025"),
                    ),
                    "R481: both tax years asked, the current and the one before: ${server.fullRequests}",
                )
            } finally {
                rig.close()
            }
        }

    @Test
    fun aDownloadThatAnswersAfterASignOutWritesNothingForEitherAccount() =
        runComposeUiTest {
            val gate = CompletableDeferred<Unit>()
            val lock = NSLock()
            var entryCalls = 0
            val server =
                RecordingTransport(
                    route = { request, path ->
                        if (request.method.name == "GET" && path == ENTRIES_PATH) {
                            val year = checkNotNull(yearOf(request))
                            lock.lock()
                            val call = ++entryCalls
                            lock.unlock()
                            // The FIRST year asked - the signed-in account's - is held, then answers with a day.
                            if (call == 1) {
                                heldUntil(gate)
                                HttpResponse(200, yearBody(year, listOf(dayRow("$year-04-07"))))
                            } else {
                                HttpResponse(200, yearBody(year, emptyList()))
                            }
                        } else {
                            null
                        }
                    },
                    answer = ::signInAnswers,
                )
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    transport = server,
                )
            try {
                setShellContent(rig)
                waitFor("R485: the start check asked for the first empty year, and the server holds it") {
                    rig.entryGets() >= 1
                }
                signOutThroughTheShell()

                gate.complete(Unit)
                runBlocking { delay(SETTLE_MILLIS) }
                assertEquals(emptyList(), rig.days(), "a year that answered AFTER the sign-out landed nowhere")
                assertEquals(1, rig.entryGets(), "and the stopped download asked for no further year")

                // The next account on this phone: its own download runs (the presence), the old year never lands.
                signInThroughTheShell()
                waitFor("the next account's own download asked for both its years") { rig.entryGets() >= 3 }
                runBlocking { delay(SETTLE_MILLIS) }
                assertTrue(
                    rig.days().none { it.endsWith("-04-07") },
                    "one account's year never lands in the next account's database: ${rig.days()}",
                )
            } finally {
                rig.close()
            }
        }

    @Test
    fun theSameHeldDownloadWithNoEndingWrites() =
        runComposeUiTest {
            val gate = CompletableDeferred<Unit>()
            val server =
                RecordingTransport(
                    route = { request, path ->
                        if (request.method.name == "GET" && path == ENTRIES_PATH) {
                            val year = checkNotNull(yearOf(request))
                            if (year == 2026) {
                                heldUntil(gate)
                                HttpResponse(200, yearBody(year, listOf(dayRow("2026-04-07"))))
                            } else {
                                HttpResponse(200, yearBody(year, emptyList()))
                            }
                        } else {
                            null
                        }
                    },
                    answer = ::signInAnswers,
                )
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    transport = server,
                )
            try {
                setShellContent(rig)
                waitFor("the held year was asked for") { rig.entryGets() >= 1 }
                assertEquals(emptyList(), rig.days(), "nothing before the answer")
                gate.complete(Unit)
                waitFor("POSITIVE CONTROL: the same held year, with no ending, lands") {
                    rig.daysOf("this-install") == listOf("2026-04-07")
                }
            } finally {
                rig.close()
            }
        }

    @Test
    fun aDayTheDownloadBringsForTodayTakesTodaysReminderOffThePlan() =
        runComposeUiTest {
            val week = (16..20).map { EVENING_REMINDER_ID_PREFIX + "2026-11-$it" }.toSet()
            val today = EVENING_REMINDER_ID_PREFIX + SHELL_TODAY
            val server =
                RecordingTransport(
                    route = { request, path ->
                        if (request.method.name == "GET" && path == ENTRIES_PATH) {
                            val year = checkNotNull(yearOf(request))
                            val rows = if (year == 2026) listOf(dayRow(SHELL_TODAY)) else emptyList()
                            HttpResponse(200, yearBody(year, rows))
                        } else {
                            null
                        }
                    },
                    answer = ::signInAnswers,
                )
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    transport = server,
                    eveningOptedIn = true,
                )
            try {
                setShellContent(rig)
                waitFor("today, recorded on another phone, arrived in the iOS database") {
                    rig.daysOf("this-install") == listOf(SHELL_TODAY)
                }
                waitFor("the plan no longer asks about today: it was recorded elsewhere") {
                    rig.centre.pendingNow() == week - today
                }
            } finally {
                rig.close()
            }
        }

    private companion object {
        /** How long a released answer is given to land - or, here, to prove it does not. */
        const val SETTLE_MILLIS = 1_500L
    }
}
