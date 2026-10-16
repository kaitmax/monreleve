package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.TokenPair
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// KMP-1 increments 4 (R381, R383). The auth-wire GOLDENS, moved to commonTest from :app with the SAME expected
// fixture data, now driving the MOVED (kotlinx.serialization) AuthApi on COMMON code - so iOS runs them the day
// it builds. The harness is re-homed only in its mechanism (kotlin.test + the kotlinx tree here; Kotest + org.json
// in the pre-move :app copy); the expectations are byte-identical, which is the whole point of a golden captured
// before the move. The in-memory [FakeTransport] IS the R383 fake: it drives every AuthApi branch the :app tests
// cover - request shapes, each success, each documented refusal, and the network-failure path - without a device.
//
// The server's schemas are .strict(): one extra key is a 400. So each request body is compared by its EXACT key
// set, read from the kotlinx JSON tree, and the byte-for-byte URL encoder is pinned (t+o+k, a%40b.ch).

private class FakeTransport(
    private val response: HttpResponse = HttpResponse(200, ""),
    private val error: Throwable? = null,
) : HttpTransport {
    var lastRequest: HttpRequest? = null

    override suspend fun execute(request: HttpRequest): HttpResponse {
        lastRequest = request
        error?.let { throw it }
        return response
    }
}

private const val BASE = "http://10.0.2.2:3000"

private const val PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2027-06-18T16:18:00.000Z","refreshExpiresAt":"2027-09-16T16:03:00.000Z"}"""

private fun keysOf(body: String): Set<String> = wireJson.parseToJsonElement(body).jsonObject.keys

private fun valueOf(
    body: String,
    key: String,
): String? = wireJson.parseToJsonElement(body).jsonObject[key]?.jsonPrimitive?.content

class AuthWireGoldenTest {
    // ----- REQUEST BODIES: exact key set + values (a stray key is a 400) -----

    @Test
    fun goldenMagicLinkBodyCarriesExactlyEmail() =
        runTest {
            val fake = FakeTransport(HttpResponse(202, ""))
            AuthApi(fake, BASE).requestMagicLink("a@b.ch")
            val body = fake.lastRequest?.body ?: error("no body")
            assertEquals(setOf("email"), keysOf(body))
            assertEquals("a@b.ch", valueOf(body, "email"))
            assertEquals(HttpMethod.POST, fake.lastRequest?.method)
            assertEquals("$BASE/api/v1/auth/magic-link", fake.lastRequest?.url)
        }

    @Test
    fun goldenCodeBodyCarriesExactlyEmailAndCode() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, PAIR_BODY))
            AuthApi(fake, BASE).exchangeCode("a@b.ch", "481234")
            val body = fake.lastRequest?.body ?: error("no body")
            assertEquals(setOf("email", "code"), keysOf(body))
            assertEquals("a@b.ch", valueOf(body, "email"))
            assertEquals("481234", valueOf(body, "code"))
            assertEquals("$BASE/api/v1/auth/code", fake.lastRequest?.url)
        }

    @Test
    fun goldenRefreshBodyCarriesExactlyRefreshToken() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, PAIR_BODY))
            AuthApi(fake, BASE).refresh("the-refresh-token")
            val body = fake.lastRequest?.body ?: error("no body")
            assertEquals(setOf("refreshToken"), keysOf(body))
            assertEquals("the-refresh-token", valueOf(body, "refreshToken"))
            assertEquals("$BASE/api/v1/auth/refresh", fake.lastRequest?.url)
        }

    @Test
    fun goldenCallbackIsAGetWithTokenAndEmailUrlEncodedByteForByte() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, PAIR_BODY))
            AuthApi(fake, BASE).exchangeCallback("t o k", "a@b.ch")
            val url = fake.lastRequest?.url ?: error("no url")
            assertEquals(HttpMethod.GET, fake.lastRequest?.method)
            assertTrue(url.startsWith("$BASE/api/v1/auth/callback?"), url)
            // java.net.URLEncoder parity: space -> '+', '@' -> '%40' (uppercase hex).
            assertTrue(url.contains("token=t+o+k"), url)
            assertTrue(url.contains("email=a%40b.ch"), url)
        }

    @Test
    fun goldenAuthenticatedPostSendsBearerAndContentTypeAndTheBodyVerbatim() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, "{}"))
            AuthApi(fake, BASE).authenticatedPost("/api/v1/entries", """{"entries":[]}""", "acc")
            assertEquals(HttpMethod.POST, fake.lastRequest?.method)
            assertEquals("$BASE/api/v1/entries", fake.lastRequest?.url)
            assertEquals(
                mapOf("Authorization" to "Bearer acc", "Content-Type" to "application/json"),
                fake.lastRequest?.headers,
            )
            assertEquals("""{"entries":[]}""", fake.lastRequest?.body)
        }

    @Test
    fun goldenAuthenticatedPatchSendsBearerAndContentTypeAndTheBodyVerbatim() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, "{}"))
            AuthApi(fake, BASE).authenticatedPatch("/api/v1/me", """{"name":"X"}""", "acc")
            assertEquals(HttpMethod.PATCH, fake.lastRequest?.method)
            assertEquals(
                mapOf("Authorization" to "Bearer acc", "Content-Type" to "application/json"),
                fake.lastRequest?.headers,
            )
            assertEquals("""{"name":"X"}""", fake.lastRequest?.body)
        }

    @Test
    fun goldenAuthenticatedGetSendsBearerOnlyAndNoBody() =
        runTest {
            val fake = FakeTransport(HttpResponse(200, "{}"))
            AuthApi(fake, BASE).authenticatedGet("/api/v1/me", "acc")
            assertEquals(HttpMethod.GET, fake.lastRequest?.method)
            assertEquals(mapOf("Authorization" to "Bearer acc"), fake.lastRequest?.headers)
            assertNull(fake.lastRequest?.body)
        }

    // ----- RESPONSE DECISIONS: each success + each documented refusal + the network branch -----

    @Test
    fun goldenCallback200WithPairIsSignedCarryingAllFour() =
        runTest {
            val r = AuthApi(FakeTransport(HttpResponse(200, PAIR_BODY)), BASE).exchangeCallback("t", "e")
            val signed = assertIs<CallbackResult.Signed>(r)
            assertEquals(
                TokenPair("acc", "ref", "2027-06-18T16:18:00.000Z", "2027-09-16T16:03:00.000Z"),
                signed.pair,
            )
        }

    @Test
    fun goldenCallback200WithoutPairIsMalformed() =
        runTest {
            val r = AuthApi(FakeTransport(HttpResponse(200, """{"status":"ok"}""")), BASE).exchangeCallback("t", "e")
            val failed = assertIs<CallbackResult.Failed>(r)
            assertIs<ApiFailure.Malformed>(failed.failure)
        }

    @Test
    fun goldenCallback400IsInvalidLink() =
        runTest {
            assertEquals(
                CallbackResult.InvalidLink,
                AuthApi(FakeTransport(HttpResponse(400, """{"code":"invalid_link"}""")), BASE)
                    .exchangeCallback("t", "e"),
            )
        }

    @Test
    fun goldenRefresh200IsRotatedAndEveryNon200IsTheSingleInvalid() =
        runTest {
            assertIs<RefreshResult.Rotated>(
                AuthApi(FakeTransport(HttpResponse(200, PAIR_BODY)), BASE).refresh("r"),
            )
            assertEquals(
                RefreshResult.Invalid,
                AuthApi(FakeTransport(HttpResponse(401, """{"code":"invalid_refresh_token"}""")), BASE).refresh("r"),
            )
        }

    @Test
    fun goldenMagicLink202SentAnd429RateLimitedAnd500Failed() =
        runTest {
            assertEquals(
                MagicLinkResult.Sent,
                AuthApi(FakeTransport(HttpResponse(202, "")), BASE).requestMagicLink("a@b.ch"),
            )
            assertEquals(
                MagicLinkResult.RateLimited,
                AuthApi(FakeTransport(HttpResponse(429, "")), BASE).requestMagicLink("a@b.ch"),
            )
            assertIs<MagicLinkResult.Failed>(
                AuthApi(FakeTransport(HttpResponse(500, "")), BASE).requestMagicLink("a@b.ch"),
            )
        }

    @Test
    fun goldenEachCodeRefusalMapsToItsResultAndAnUnknownKeepsItsRawCode() =
        runTest {
            suspend fun code(
                c: String,
                status: Int = 400,
            ) = AuthApi(FakeTransport(HttpResponse(status, """{"code":"$c"}""")), BASE).exchangeCode("e", "0")
            assertEquals(CodeExchangeResult.WrongCode, code("invalid_code"))
            assertEquals(CodeExchangeResult.Expired, code("code_expired"))
            assertEquals(CodeExchangeResult.TooManyAttempts, code("too_many_attempts", 429))
            assertEquals(CodeExchangeResult.RateLimited, code("rate_limited", 429))
            val future = assertIs<CodeExchangeResult.Failed>(code("some_future_code"))
            assertEquals("some_future_code", assertIs<ApiFailure.Server>(future.failure).rawCode)
        }

    @Test
    fun goldenANetworkFailureIsFailedNetworkNotARefusal() =
        runTest {
            // KMP-1b (R387): THE FAKE NOW THROWS WHAT A TRANSPORT IS CONTRACTED TO THROW.
            //
            // This asserted that ANY exception from the transport became Failed(Network) -
            // it threw RuntimeException("no route") - which is the broad-catch behaviour
            // R387 removes: a RuntimeException from a transport is a BUG in that transport,
            // and reporting it to the reader as "network unreachable" sends them to check
            // their wifi. CancellationTest asserts it now propagates.
            //
            // THE CLAIM HERE IS UNCHANGED - a network failure is Failed(Network) and never
            // read as a server refusal. Only the way the fake SIGNALS "the network failed"
            // moved, from a stand-in exception to the seam's documented TransportException
            // (R386).
            val r = AuthApi(FakeTransport(error = TransportException("no route")), BASE).requestMagicLink("a@b.ch")
            assertIs<ApiFailure.Network>(assertIs<MagicLinkResult.Failed>(r).failure)
        }

    // ----- parseServerFailure: the tolerant reader -----

    @Test
    fun goldenParseServerFailureReadsCodeAndMessageAndMapsAKnownCode() {
        assertEquals(
            ApiFailure.Server(401, AuthServerCode.REVOKED_SESSION, "revoked_session", "Session terminee"),
            parseServerFailure(401, """{"code":"revoked_session","message":"Session terminee"}"""),
        )
    }

    @Test
    fun goldenParseServerFailureOnNonJsonKeepsStatusAndNullsTheCode() {
        assertEquals(
            ApiFailure.Server(502, null, null, null),
            parseServerFailure(502, "<html>Bad Gateway</html>"),
        )
    }

    @Test
    fun goldenParseServerFailureTreatsExplicitNullCodeAsNull() {
        assertEquals(
            ApiFailure.Server(400, null, null, "x"),
            parseServerFailure(400, """{"code":null,"message":"x"}"""),
        )
    }

    // ----- AuthServerCode.fromWire: the full documented mapping -----

    @Test
    fun goldenEveryDocumentedAuthCodeMapsAndAnUnknownIsNull() {
        assertEquals(AuthServerCode.MISSING_TOKEN, AuthServerCode.fromWire("missing_token"))
        assertEquals(AuthServerCode.MALFORMED_AUTHORIZATION, AuthServerCode.fromWire("malformed_authorization"))
        assertEquals(AuthServerCode.UNKNOWN_TOKEN, AuthServerCode.fromWire("unknown_token"))
        assertEquals(AuthServerCode.EXPIRED_TOKEN, AuthServerCode.fromWire("expired_token"))
        assertEquals(AuthServerCode.ROTATED_TOKEN, AuthServerCode.fromWire("rotated_token"))
        assertEquals(AuthServerCode.REVOKED_SESSION, AuthServerCode.fromWire("revoked_session"))
        assertEquals(AuthServerCode.INVALID_LINK, AuthServerCode.fromWire("invalid_link"))
        assertEquals(AuthServerCode.INVALID_REFRESH_TOKEN, AuthServerCode.fromWire("invalid_refresh_token"))
        assertEquals(AuthServerCode.MALFORMED_BODY, AuthServerCode.fromWire("malformed_body"))
        assertNull(AuthServerCode.fromWire("some_future_code"))
        assertNull(AuthServerCode.fromWire(null))
        assertEquals(ClientAction.REFRESH, AuthServerCode.EXPIRED_TOKEN.action)
        assertEquals(ClientAction.SIGN_IN, AuthServerCode.REVOKED_SESSION.action)
    }
}
