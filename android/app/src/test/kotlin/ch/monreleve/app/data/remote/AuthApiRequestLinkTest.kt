package ch.monreleve.app.data.remote

// AN4 increment 3. AuthApi.requestMagicLink against a scripted fake transport
// (the seam from increment 1). The enumeration guarantee (FW22 / docs/api-v1.md
// 1.5) is the client's too: the server answers 202 for registered, unregistered,
// rate-limited-internally and provider-down alike, so the client shows ONE result
// (Sent) for 202 and never branches on the address. A 429 from the edge is the
// one honest "too many" state; a network failure is a distinct type, never read
// as a refusal. RED first: AuthApi and MagicLinkResult did not exist.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.io.IOException

private class FakeTransport(
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

private const val BASE_URL = "http://10.0.2.2:3000"

class AuthApiRequestLinkTest : FunSpec({
    test("a 202 is Sent - the one answer whatever the truth, so the client cannot enumerate") {
        val api = AuthApi(FakeTransport(HttpResponse(202, """{"status":"accepted","message":"x"}""")), BASE_URL)
        api.requestMagicLink("a@b.ch") shouldBe MagicLinkResult.Sent
    }

    test("a 429 renders its own honest rate-limited state") {
        val api = AuthApi(FakeTransport(HttpResponse(429, "")), BASE_URL)
        api.requestMagicLink("a@b.ch") shouldBe MagicLinkResult.RateLimited
    }

    test("a network failure is a distinct Failed(Network), never read as a refusal") {
        val api = AuthApi(FakeTransport(throwable = IOException("no route")), BASE_URL)
        val result = api.requestMagicLink("a@b.ch")
        result.shouldBeInstanceOf<MagicLinkResult.Failed>()
        result.failure.shouldBeInstanceOf<ApiFailure.Network>()
    }

    test("the request POSTs JSON carrying the email to the magic-link route") {
        val fake = FakeTransport(HttpResponse(202, ""))
        AuthApi(fake, BASE_URL).requestMagicLink("a@b.ch")
        fake.lastRequest?.method shouldBe HttpMethod.POST
        fake.lastRequest?.url shouldBe "$BASE_URL/api/v1/auth/magic-link"
        (fake.lastRequest?.body?.contains("a@b.ch") ?: false).shouldBeTrue()
    }
})
