package ch.monreleve.app.data.remote

// AN4 increment 4. AuthApi.exchangeCallback against a scripted transport. A 200
// with a pair is Signed; a 400 is InvalidLink (the server's ONE answer for every
// callback failure - the client renders one "ask for a new link" state); a 200
// without a pair is Failed(Malformed), never a half-signed session; a network
// failure is Failed(Network). RED first: exchangeCallback and CallbackResult did
// not exist.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

private class CallbackFakeTransport(
    private val response: HttpResponse = HttpResponse(200, ""),
    private val throwable: Throwable? = null,
) : HttpTransport {
    var lastRequest: HttpRequest? = null

    override suspend fun execute(request: HttpRequest): HttpResponse {
        lastRequest = request
        throwable?.let { throw it }
        return response
    }
}

private const val CB_BASE = "http://10.0.2.2:3000"
private const val OK_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2027-06-18T16:18:00.000Z","refreshExpiresAt":"2027-09-16T16:03:00.000Z"}"""

class AuthApiCallbackTest : FunSpec({
    test("a 200 with a token pair is Signed, carrying the pair") {
        val result =
            AuthApi(CallbackFakeTransport(HttpResponse(200, OK_BODY)), CB_BASE).exchangeCallback("tok", "a@b.ch")
        result.shouldBeInstanceOf<CallbackResult.Signed>()
        result.pair.accessToken shouldBe "acc"
        result.pair.refreshToken shouldBe "ref"
    }

    test("a 400 is InvalidLink - the one answer for every callback failure") {
        val body = """{"status":"error","code":"invalid_link"}"""
        AuthApi(CallbackFakeTransport(HttpResponse(400, body)), CB_BASE).exchangeCallback("tok", "a@b.ch") shouldBe
            CallbackResult.InvalidLink
    }

    test("a 200 without a pair is Failed(Malformed), never a half-signed state") {
        val result =
            AuthApi(CallbackFakeTransport(HttpResponse(200, """{"status":"ok"}""")), CB_BASE)
                .exchangeCallback("tok", "a@b.ch")
        result.shouldBeInstanceOf<CallbackResult.Failed>()
        result.failure.shouldBeInstanceOf<ApiFailure.Malformed>()
    }

    test("a network failure is Failed(Network)") {
        val result =
            AuthApi(CallbackFakeTransport(throwable = TransportException("x")), CB_BASE)
                .exchangeCallback("tok", "a@b.ch")
        result.shouldBeInstanceOf<CallbackResult.Failed>()
        result.failure.shouldBeInstanceOf<ApiFailure.Network>()
    }

    test("the exchange GETs the callback route with token and email encoded onto the OWN base url") {
        val fake = CallbackFakeTransport(HttpResponse(200, OK_BODY))
        AuthApi(fake, CB_BASE).exchangeCallback("t o k", "a@b.ch")
        fake.lastRequest?.method shouldBe HttpMethod.GET
        (fake.lastRequest?.url?.startsWith("$CB_BASE/api/v1/auth/callback?") ?: false).shouldBeTrue()
        (fake.lastRequest?.url?.contains("t+o+k") ?: false).shouldBeTrue()
        (fake.lastRequest?.url?.contains("a%40b.ch") ?: false).shouldBeTrue()
    }
})
