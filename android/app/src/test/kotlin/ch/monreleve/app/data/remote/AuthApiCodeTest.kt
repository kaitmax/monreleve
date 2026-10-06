package ch.monreleve.app.data.remote

// AN-ONBOARD. AuthApi.exchangeCode against a scripted transport. A 200 with a pair is Signed; each named
// refusal maps to its own result (so the Code screen can say how to recover, never just "erreur"); a 200
// without a pair is Failed(Malformed), never a half-signed session; a network failure is Failed(Network).
// It POSTs { email, code } to the OWN base url. RED first: exchangeCode and CodeExchangeResult did not exist.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.io.IOException

private class CodeFakeTransport(
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

private const val CODE_BASE = "http://10.0.2.2:3000"
private const val CODE_OK_BODY =
    """{"status":"ok","accessToken":"acc","refreshToken":"ref",""" +
        """"accessExpiresAt":"2027-06-18T16:18:00.000Z","refreshExpiresAt":"2027-09-16T16:03:00.000Z"}"""

private fun error(code: String): String = """{"status":"error","code":"$code"}"""

class AuthApiCodeTest : FunSpec({
    test("a 200 with a token pair is Signed, carrying the pair") {
        val result =
            AuthApi(CodeFakeTransport(HttpResponse(200, CODE_OK_BODY)), CODE_BASE).exchangeCode("a@b.ch", "481234")
        result.shouldBeInstanceOf<CodeExchangeResult.Signed>()
        result.pair.accessToken shouldBe "acc"
    }

    test("a 400 invalid_code is WrongCode") {
        AuthApi(CodeFakeTransport(HttpResponse(400, error("invalid_code"))), CODE_BASE)
            .exchangeCode("a@b.ch", "000000") shouldBe CodeExchangeResult.WrongCode
    }

    test("a 400 code_expired is Expired") {
        AuthApi(CodeFakeTransport(HttpResponse(400, error("code_expired"))), CODE_BASE)
            .exchangeCode("a@b.ch", "000000") shouldBe CodeExchangeResult.Expired
    }

    test("a 429 too_many_attempts is TooManyAttempts") {
        AuthApi(CodeFakeTransport(HttpResponse(429, error("too_many_attempts"))), CODE_BASE)
            .exchangeCode("a@b.ch", "000000") shouldBe CodeExchangeResult.TooManyAttempts
    }

    test("a 429 rate_limited is RateLimited") {
        AuthApi(CodeFakeTransport(HttpResponse(429, error("rate_limited"))), CODE_BASE)
            .exchangeCode("a@b.ch", "000000") shouldBe CodeExchangeResult.RateLimited
    }

    test("a 200 without a pair is Failed(Malformed), never a half-signed state") {
        val result =
            AuthApi(CodeFakeTransport(HttpResponse(200, """{"status":"ok"}""")), CODE_BASE)
                .exchangeCode("a@b.ch", "481234")
        result.shouldBeInstanceOf<CodeExchangeResult.Failed>()
        result.failure.shouldBeInstanceOf<ApiFailure.Malformed>()
    }

    test("a network failure is Failed(Network)") {
        val result =
            AuthApi(CodeFakeTransport(throwable = IOException("x")), CODE_BASE).exchangeCode("a@b.ch", "481234")
        result.shouldBeInstanceOf<CodeExchangeResult.Failed>()
        result.failure.shouldBeInstanceOf<ApiFailure.Network>()
    }

    test("an unrecognised refusal code is Failed, preserving the raw code (contract 6.5)") {
        val result =
            AuthApi(CodeFakeTransport(HttpResponse(400, error("some_future_code"))), CODE_BASE)
                .exchangeCode("a@b.ch", "000000")
        result.shouldBeInstanceOf<CodeExchangeResult.Failed>()
        val failure = result.failure
        failure.shouldBeInstanceOf<ApiFailure.Server>()
        failure.rawCode shouldBe "some_future_code"
    }

    test("it POSTs { email, code } to the code route on the OWN base url") {
        val fake = CodeFakeTransport(HttpResponse(200, CODE_OK_BODY))
        AuthApi(fake, CODE_BASE).exchangeCode("a@b.ch", "481234")
        fake.lastRequest?.method shouldBe HttpMethod.POST
        fake.lastRequest?.url shouldBe "$CODE_BASE/api/v1/auth/code"
        val body = org.json.JSONObject(fake.lastRequest?.body ?: "{}")
        body.getString("email") shouldBe "a@b.ch"
        body.getString("code") shouldBe "481234"
        (fake.lastRequest?.headers?.get("Content-Type") == "application/json").shouldBeTrue()
    }
})
