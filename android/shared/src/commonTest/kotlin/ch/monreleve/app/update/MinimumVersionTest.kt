package ch.monreleve.app.update

import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import ch.monreleve.app.update.MinimumVersionAnswer.Minimum
import ch.monreleve.app.update.MinimumVersionAnswer.NoMinimum
import ch.monreleve.app.update.MinimumVersionAnswer.Unusable
import ch.monreleve.app.update.MinimumVersionAnswer.UnusableReason
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// AN-FORCE-UPDATE (R1111). THE DECISION, ON EVERY BRANCH THE PROMPT NAMES - written RED before the code.
//
// The expensive error is a false "required": the update screen replaces the whole app, and its one button leads to a
// listing that may hold nothing newer. So the tests are strict about what counts as a minimum (a JSON integer, never
// a quoted "5", a 5.0, a 0, a negative or a number above Play's ceiling) and loose about everything else: every answer
// that is not this product saying, with a valid integer, that the running versionCode is below it, FAILS OPEN.
//
// The route's own readings of its setting are joined to this parser by fixtures/android-minimum-version-cases.json
// (MinimumVersionFixtureTest in :app, R204); this file owns the client-only branches the route can never produce -
// an unreachable server, a non-200, a foreign or malformed body.

private const val OURS = "monreleve"

private fun body(minimum: String): String = """{"service":"$OURS","minimumVersionCode":$minimum}"""

private class ScriptedTransport(
    private val answer: () -> HttpResponse,
) : HttpTransport {
    val requests = mutableListOf<HttpRequest>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        requests += request
        return answer()
    }
}

class MinimumVersionParseTest {
    @Test
    fun aValidMinimumIsBelieved() {
        assertEquals(Minimum(2), parseMinimumVersion(200, body("2")))
        assertEquals(Minimum(2_100_000_000), parseMinimumVersion(200, body("2100000000")))
    }

    @Test
    fun anExplicitNullIsNoMinimum() {
        assertEquals(NoMinimum, parseMinimumVersion(200, body("null")))
    }

    @Test
    fun unknownKeysAreIgnored() {
        // docs/api-v1.md 6.5: additive change must not break a shipped client.
        val wider = """{"service":"$OURS","minimumVersionCode":3,"ios":{"minimum":"1.2"}}"""
        assertEquals(Minimum(3), parseMinimumVersion(200, wider))
    }

    @Test
    fun anyStatusButOkIsUnusable() {
        for (status in listOf(201, 204, 301, 304, 401, 404, 429, 500, 502, 503)) {
            assertEquals(Unusable(UnusableReason.STATUS), parseMinimumVersion(status, body("99")), "status $status")
        }
    }

    @Test
    fun aBodyThatIsNotJsonIsUnusable() {
        // A bare token (minimumVersionCode=9) is NOT here: kotlinx reads it as a JSON primitive, so it is MALFORMED
        // (not an object) below - found by this file's first green run, and still Unusable either way.
        for (text in listOf("", "<html>502 Bad Gateway</html>", "{", """{"service":"monreleve",""")) {
            assertEquals(Unusable(UnusableReason.NOT_JSON), parseMinimumVersion(200, text), "body '$text'")
        }
    }

    @Test
    fun aForeignOrNamelessServerIsUnusable() {
        // R169: another project on the port answering 200 with a plausible field must not lock the app.
        val foreign =
            listOf(
                """{"service":"tizicorp","minimumVersionCode":99}""",
                """{"minimumVersionCode":99}""",
                """{"service":null,"minimumVersionCode":99}""",
                """{"service":7,"minimumVersionCode":99}""",
                """{"service":"MONRELEVE","minimumVersionCode":99}""",
            )
        for (text in foreign) {
            assertEquals(Unusable(UnusableReason.FOREIGN), parseMinimumVersion(200, text), text)
        }
    }

    @Test
    fun aMinimumThatIsNotAPositiveIntegerIsMalformed() {
        val malformed = listOf("\"5\"", "5.0", "5.5", "0", "-1", "1e3", "2100000001", "99999999999999999999", "true")
        for (value in malformed) {
            assertEquals(Unusable(UnusableReason.MALFORMED), parseMinimumVersion(200, body(value)), "value $value")
        }
        // Not an object at all, and a missing field (absent is NOT null: the route always says null explicitly).
        for (text in listOf("[]", "42", "\"monreleve\"", "minimumVersionCode=9", """{"service":"$OURS"}""")) {
            assertEquals(Unusable(UnusableReason.MALFORMED), parseMinimumVersion(200, text), text)
        }
        assertEquals(
            Unusable(UnusableReason.MALFORMED),
            parseMinimumVersion(200, """{"service":"$OURS","minimumVersionCode":{"code":5}}"""),
        )
    }
}

class UpdateDecisionTest {
    @Test
    fun requiredOnlyStrictlyBelowAValidMinimum() {
        assertTrue(updateRequired(appVersionCode = 1, answer = Minimum(2), showingNow = false))
        assertFalse(updateRequired(appVersionCode = 2, answer = Minimum(2), showingNow = false), "equal is supported")
        assertFalse(updateRequired(appVersionCode = 3, answer = Minimum(2), showingNow = false))
    }

    @Test
    fun aKnownAnswerReplacesWhatIsShowing() {
        // The server lowered or removed the minimum: the screen goes.
        assertFalse(updateRequired(appVersionCode = 1, answer = NoMinimum, showingNow = true))
        assertFalse(updateRequired(appVersionCode = 5, answer = Minimum(2), showingNow = true))
        assertTrue(updateRequired(appVersionCode = 1, answer = Minimum(9), showingNow = true))
    }

    @Test
    fun noMinimumNeverShowsTheScreen() {
        assertFalse(updateRequired(appVersionCode = 1, answer = NoMinimum, showingNow = false))
    }

    @Test
    fun anUnusableAnswerFailsOpenAndNeverChangesWhatIsShowing() {
        for (reason in UnusableReason.entries) {
            // FAIL OPEN: nothing known -> the app as it is today.
            assertFalse(updateRequired(1, Unusable(reason), showingNow = false), "$reason from nothing shown")
            // An answer that says nothing does not undo one that did (the emulator's own Wi-Fi drops every 12-20 s;
            // a flapping network must not flicker the app in and out). The orchestrator's question QD1.
            assertTrue(updateRequired(1, Unusable(reason), showingNow = true), "$reason with the screen shown")
        }
    }
}

class MinimumVersionClientTest {
    @Test
    fun asksTheOneRouteWithAPlainGetAndNoCredentials() =
        runTest {
            val transport = ScriptedTransport { HttpResponse(200, body("4")) }
            val answer = MinimumVersionClient(transport, "http://10.0.2.2:3970").fetch()

            assertEquals(Minimum(4), answer)
            val request = transport.requests.single()
            assertEquals(HttpMethod.GET, request.method)
            assertEquals("http://10.0.2.2:3970/api/v1/android/minimum-version", request.url)
            assertEquals(MINIMUM_VERSION_PATH, "/api/v1/android/minimum-version")
            assertFalse(request.headers.keys.any { it.equals("Authorization", ignoreCase = true) })
            assertEquals(null, request.body)
        }

    @Test
    fun anUnreachableServerIsUnusable() =
        runTest {
            val transport = ScriptedTransport { throw TransportException("connection refused") }
            assertEquals(Unusable(UnusableReason.UNREACHABLE), MinimumVersionClient(transport, "http://x").fetch())
        }

    @Test
    fun aNonOkStatusIsUnusableThroughTheClientToo() =
        runTest {
            val transport = ScriptedTransport { HttpResponse(404, "<html>Not found</html>") }
            assertEquals(Unusable(UnusableReason.STATUS), MinimumVersionClient(transport, "http://x").fetch())
        }
}

class UpdateGateTest {
    @Test
    fun startsOpenAndFollowsEachCheck() =
        runTest {
            val answers =
                ArrayDeque(
                    listOf<MinimumVersionAnswer>(
                        Unusable(UnusableReason.UNREACHABLE),
                        Minimum(2),
                        Unusable(UnusableReason.UNREACHABLE),
                        NoMinimum,
                    ),
                )
            val gate = UpdateGate(appVersionCode = 1) { answers.removeFirst() }
            val seen = mutableListOf(gate.required.value)
            repeat(4) {
                gate.check()
                seen += gate.required.value
            }
            // Open before any answer; open on the unreachable first; required on 2; KEPT on the next unreachable;
            // released when the server says there is no minimum.
            assertEquals(listOf(false, false, true, true, false), seen)
        }
}
