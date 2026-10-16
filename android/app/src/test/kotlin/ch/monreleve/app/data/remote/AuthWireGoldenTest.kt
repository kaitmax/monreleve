package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.TokenPair
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.json.JSONObject

// KMP-1 increment 2 (R381). GOLDEN TESTS for the auth wire, captured against TODAY's org.json code BEFORE
// anything moves. After AuthApi/ApiFailure/AuthServerCode move to :shared (increment 4) and org.json becomes
// kotlinx.serialization, THESE SAME EXPECTATIONS must still hold - the server's schemas are .strict(), so a
// single extra key is a 400, which is why requests are compared SEMANTICALLY: parsed JSON equal AND the exact
// key set equal AND absent-vs-null equal (org.json's key order is not a contract). The expected fixture data
// here (EXPECTED_* sets, the OK body, the decisions) is plain Kotlin and moves UNCHANGED to commonTest; only
// the harness around it (Kotest+org.json here; kotlin.test+kotlinx tree in commonTest) is re-homed.
//
// RED PLANT (R180): proven able to fail by adding a stray key to a request body in the source under test and
// seeing the exact-key-set assertion go red - recorded in REPORT-KMP-1.txt - then reverted. A golden that
// cannot fail asserts nothing.

private class RecordingTransport(
    private val response: HttpResponse = HttpResponse(200, ""),
) : HttpTransport {
    var lastRequest: HttpRequest? = null

    override suspend fun execute(request: HttpRequest): HttpResponse {
        lastRequest = request
        return response
    }
}

private const val BASE = "http://10.0.2.2:3000"

// The 200 body the callback/code/refresh routes return (docs/api-v1.md 1.1): the opaque pair plus the two
// server-assigned ISO expiries. One home for the fixture, shared by the three success goldens below.
private const val PAIR_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2027-06-18T16:18:00.000Z","refreshExpiresAt":"2027-09-16T16:03:00.000Z"}"""

private fun keysOf(body: String): Set<String> = JSONObject(body).keys().asSequence().toSet()

private fun queryParams(url: String): Map<String, String> =
    url.substringAfter('?', "")
        .split('&')
        .filter { it.isNotEmpty() }
        .associate { pair ->
            val eq = pair.indexOf('=')
            val rawKey = if (eq >= 0) pair.substring(0, eq) else pair
            val rawVal = if (eq >= 0) pair.substring(eq + 1) else ""
            java.net.URLDecoder.decode(rawKey, "UTF-8") to java.net.URLDecoder.decode(rawVal, "UTF-8")
        }

class AuthWireGoldenTest : FunSpec({
    // ----- REQUEST BODIES: exact key set + values (a stray key is a 400) -----

    test("GOLDEN magic-link request body carries EXACTLY {email}") {
        val fake = RecordingTransport(HttpResponse(202, ""))
        AuthApi(fake, BASE).requestMagicLink("a@b.ch")
        val body = fake.lastRequest?.body ?: error("no body sent")
        keysOf(body) shouldBe setOf("email")
        JSONObject(body).getString("email") shouldBe "a@b.ch"
        fake.lastRequest?.method shouldBe HttpMethod.POST
        fake.lastRequest?.url shouldBe "$BASE/api/v1/auth/magic-link"
    }

    test("GOLDEN code request body carries EXACTLY {email, code}") {
        val fake = RecordingTransport(HttpResponse(200, PAIR_BODY))
        AuthApi(fake, BASE).exchangeCode("a@b.ch", "481234")
        val body = fake.lastRequest?.body ?: error("no body sent")
        keysOf(body) shouldBe setOf("email", "code")
        val json = JSONObject(body)
        json.getString("email") shouldBe "a@b.ch"
        json.getString("code") shouldBe "481234"
        fake.lastRequest?.url shouldBe "$BASE/api/v1/auth/code"
    }

    test("GOLDEN refresh request body carries EXACTLY {refreshToken} (refresh travels in the body, 1.3)") {
        val fake = RecordingTransport(HttpResponse(200, PAIR_BODY))
        AuthApi(fake, BASE).refresh("the-refresh-token")
        val body = fake.lastRequest?.body ?: error("no body sent")
        keysOf(body) shouldBe setOf("refreshToken")
        JSONObject(body).getString("refreshToken") shouldBe "the-refresh-token"
        fake.lastRequest?.url shouldBe "$BASE/api/v1/auth/refresh"
    }

    test("GOLDEN callback is a GET whose query carries EXACTLY token+email, URL-encoded onto the OWN base") {
        val fake = RecordingTransport(HttpResponse(200, PAIR_BODY))
        AuthApi(fake, BASE).exchangeCallback("t o k", "a@b.ch")
        val url = fake.lastRequest?.url ?: error("no url")
        fake.lastRequest?.method shouldBe HttpMethod.GET
        (url.startsWith("$BASE/api/v1/auth/callback?")) shouldBe true
        queryParams(url) shouldBe mapOf("token" to "t o k", "email" to "a@b.ch")
    }

    test("GOLDEN an authenticated POST sends Bearer + Content-Type and passes the body through verbatim") {
        val fake = RecordingTransport(HttpResponse(200, "{}"))
        AuthApi(fake, BASE).authenticatedPost("/api/v1/entries", """{"entries":[]}""", "acc")
        fake.lastRequest?.method shouldBe HttpMethod.POST
        fake.lastRequest?.url shouldBe "$BASE/api/v1/entries"
        fake.lastRequest?.headers shouldBe mapOf("Authorization" to "Bearer acc", "Content-Type" to "application/json")
        fake.lastRequest?.body shouldBe """{"entries":[]}"""
    }

    test("GOLDEN an authenticated PATCH sends Bearer + Content-Type and the body verbatim (/me, 9)") {
        val fake = RecordingTransport(HttpResponse(200, "{}"))
        AuthApi(fake, BASE).authenticatedPatch("/api/v1/me", """{"name":"X"}""", "acc")
        fake.lastRequest?.method shouldBe HttpMethod.PATCH
        fake.lastRequest?.headers shouldBe mapOf("Authorization" to "Bearer acc", "Content-Type" to "application/json")
        fake.lastRequest?.body shouldBe """{"name":"X"}"""
    }

    test("GOLDEN an authenticated GET sends Bearer only, no body, no Content-Type") {
        val fake = RecordingTransport(HttpResponse(200, "{}"))
        AuthApi(fake, BASE).authenticatedGet("/api/v1/me", "acc")
        fake.lastRequest?.method shouldBe HttpMethod.GET
        fake.lastRequest?.headers shouldBe mapOf("Authorization" to "Bearer acc")
        fake.lastRequest?.body shouldBe null
    }

    // ----- RESPONSE DECISIONS: accept/refuse (each success shape + each documented refusal) -----

    test("GOLDEN callback 200 with a pair is Signed, carrying all four fields verbatim") {
        val r = AuthApi(RecordingTransport(HttpResponse(200, PAIR_BODY)), BASE).exchangeCallback("t", "a@b.ch")
        r.shouldBeInstanceOf<CallbackResult.Signed>()
        r.pair shouldBe TokenPair("acc", "ref", "2027-06-18T16:18:00.000Z", "2027-09-16T16:03:00.000Z")
    }

    test("GOLDEN callback 200 WITHOUT a pair is Failed(Malformed), never half-signed") {
        val r = AuthApi(RecordingTransport(HttpResponse(200, """{"status":"ok"}""")), BASE).exchangeCallback("t", "e")
        r.shouldBeInstanceOf<CallbackResult.Failed>()
        r.failure.shouldBeInstanceOf<ApiFailure.Malformed>()
    }

    test("GOLDEN callback 400 is InvalidLink (the server's one answer for every callback failure, 1.5)") {
        AuthApi(RecordingTransport(HttpResponse(400, """{"code":"invalid_link"}""")), BASE)
            .exchangeCallback("t", "e") shouldBe CallbackResult.InvalidLink
    }

    test("GOLDEN refresh 200 is Rotated; every non-200 is the single Invalid (1.5)") {
        AuthApi(RecordingTransport(HttpResponse(200, PAIR_BODY)), BASE).refresh("r")
            .shouldBeInstanceOf<RefreshResult.Rotated>()
        AuthApi(RecordingTransport(HttpResponse(401, """{"code":"invalid_refresh_token"}""")), BASE)
            .refresh("r") shouldBe RefreshResult.Invalid
    }

    test("GOLDEN magic-link 202 is Sent, 429 is RateLimited, 500 is Failed(Server)") {
        AuthApi(RecordingTransport(HttpResponse(202, "")), BASE).requestMagicLink("a@b.ch") shouldBe
            MagicLinkResult.Sent
        AuthApi(RecordingTransport(HttpResponse(429, "")), BASE).requestMagicLink("a@b.ch") shouldBe
            MagicLinkResult.RateLimited
        val failed = AuthApi(RecordingTransport(HttpResponse(500, "")), BASE).requestMagicLink("a@b.ch")
        failed.shouldBeInstanceOf<MagicLinkResult.Failed>()
    }

    test("GOLDEN each documented code refusal maps to its own result; an unknown one keeps its raw code (6.5)") {
        suspend fun code(c: String, status: Int = 400) =
            AuthApi(RecordingTransport(HttpResponse(status, """{"code":"$c"}""")), BASE).exchangeCode("e", "0")
        code("invalid_code") shouldBe CodeExchangeResult.WrongCode
        code("code_expired") shouldBe CodeExchangeResult.Expired
        code("too_many_attempts", 429) shouldBe CodeExchangeResult.TooManyAttempts
        code("rate_limited", 429) shouldBe CodeExchangeResult.RateLimited
        val future = code("some_future_code")
        future.shouldBeInstanceOf<CodeExchangeResult.Failed>()
        (future.failure as ApiFailure.Server).rawCode shouldBe "some_future_code"
    }

    // ----- parseServerFailure: the tolerant reader (status always preserved; a non-JSON body is not a crash) -----

    test("GOLDEN parseServerFailure reads code+message and maps a known code") {
        val f = parseServerFailure(401, """{"code":"revoked_session","message":"Session terminee"}""")
        f shouldBe ApiFailure.Server(401, AuthServerCode.REVOKED_SESSION, "revoked_session", "Session terminee")
    }

    test("GOLDEN parseServerFailure on a non-JSON body keeps the status and yields null code (a proxy 502)") {
        parseServerFailure(502, "<html>Bad Gateway</html>") shouldBe
            ApiFailure.Server(502, null, null, null)
    }

    test("GOLDEN parseServerFailure treats an explicit null code as null, not the string \"null\"") {
        parseServerFailure(400, """{"code":null,"message":"x"}""") shouldBe
            ApiFailure.Server(400, null, null, "x")
    }

    // ----- AuthServerCode.fromWire: the full documented mapping; an unknown code stays null (terminal, 6.5) -----

    test("GOLDEN every documented auth code maps to its enum + action; an unknown one is null") {
        AuthServerCode.fromWire("missing_token") shouldBe AuthServerCode.MISSING_TOKEN
        AuthServerCode.fromWire("malformed_authorization") shouldBe AuthServerCode.MALFORMED_AUTHORIZATION
        AuthServerCode.fromWire("unknown_token") shouldBe AuthServerCode.UNKNOWN_TOKEN
        AuthServerCode.fromWire("expired_token") shouldBe AuthServerCode.EXPIRED_TOKEN
        AuthServerCode.fromWire("rotated_token") shouldBe AuthServerCode.ROTATED_TOKEN
        AuthServerCode.fromWire("revoked_session") shouldBe AuthServerCode.REVOKED_SESSION
        AuthServerCode.fromWire("invalid_link") shouldBe AuthServerCode.INVALID_LINK
        AuthServerCode.fromWire("invalid_refresh_token") shouldBe AuthServerCode.INVALID_REFRESH_TOKEN
        AuthServerCode.fromWire("malformed_body") shouldBe AuthServerCode.MALFORMED_BODY
        AuthServerCode.fromWire("some_future_code") shouldBe null
        AuthServerCode.fromWire(null) shouldBe null
        AuthServerCode.EXPIRED_TOKEN.action shouldBe ClientAction.REFRESH
        AuthServerCode.REVOKED_SESSION.action shouldBe ClientAction.SIGN_IN
    }
})
