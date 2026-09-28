package ch.monreleve.app.debug

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

// GUARD (c) of R284. The injection accepts ONLY a well-formed session and refuses anything else BY
// NAME (R198). Lives in src/testDebug so it compiles against the debug variant, which is the only one
// carrying SessionInjection - testReleaseUnitTest never sees this class and must never try to.
//
// The refusals name the FIELD, never the value: a refusal echoing a token would be the leak the log
// fence exists to stop, so every assertion checks the field name and the suite carries no token value
// it could accidentally surface.

private val VALID_TOKENS =
    mapOf(
        SessionInjectionExtras.ACCESS_TOKEN to "header.payload.signature",
        SessionInjectionExtras.REFRESH_TOKEN to "an-opaque-refresh-token",
        SessionInjectionExtras.ACCESS_EXPIRES_AT to "2026-09-28T12:00:00.000Z",
        SessionInjectionExtras.REFRESH_EXPIRES_AT to "2026-12-27T12:00:00.000Z",
    )

private val VALID_SETTINGS =
    mapOf(
        SessionInjectionExtras.CANTON to "GE",
        SessionInjectionExtras.EMPLOYMENT_RATE to "100",
        SessionInjectionExtras.DENOMINATOR_KIND to "SIMPLIFIED240",
        SessionInjectionExtras.GRANULARITY to "DAY",
    )

private fun parse(extras: Map<String, String>): InjectionResult = SessionInjection.parse { key -> extras[key] }

class SessionInjectionTest : FunSpec({
    test("a well-formed session with no settings is accepted, and drives onboarding on the device") {
        val result = parse(VALID_TOKENS)
        result.shouldBeInstanceOf<InjectionResult.Valid>()
        result.session.accessToken shouldBe "header.payload.signature"
        result.settings shouldBe null
    }

    test("a well-formed session with settings seeds onboarding for the deterministic AC1 path") {
        val result = parse(VALID_TOKENS + VALID_SETTINGS)
        result.shouldBeInstanceOf<InjectionResult.Valid>()
        result.settings?.canton shouldBe "GE"
        result.settings?.employmentRate shouldBe 100
    }

    test("a missing access token is refused by name (R198), never accepted") {
        val result = parse(VALID_TOKENS - SessionInjectionExtras.ACCESS_TOKEN)
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.ACCESS_TOKEN)
    }

    test("a blank refresh token is refused by name") {
        val result = parse(VALID_TOKENS + (SessionInjectionExtras.REFRESH_TOKEN to "   "))
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.REFRESH_TOKEN)
    }

    test("an expiry that is not an ISO instant is refused by name") {
        val result = parse(VALID_TOKENS + (SessionInjectionExtras.ACCESS_EXPIRES_AT to "not-a-date"))
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.ACCESS_EXPIRES_AT)
    }

    test("settings with a non-integer employment rate are refused by name") {
        val result = parse(VALID_TOKENS + VALID_SETTINGS + (SessionInjectionExtras.EMPLOYMENT_RATE to "full"))
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.EMPLOYMENT_RATE)
    }

    test("an unknown denominator kind is refused by name") {
        val result = parse(VALID_TOKENS + VALID_SETTINGS + (SessionInjectionExtras.DENOMINATOR_KIND to "GUESS"))
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.DENOMINATOR_KIND)
    }

    test("the exact method without a total is refused by name") {
        val exact =
            VALID_TOKENS + VALID_SETTINGS + (SessionInjectionExtras.DENOMINATOR_KIND to "EXACT")
        val result = parse(exact)
        result shouldBe InjectionResult.Refused(SessionInjectionExtras.EXACT_TOTAL_WORK_DAYS)
    }

    test("a refusal carries a field NAME, never a token value") {
        val result = parse(VALID_TOKENS - SessionInjectionExtras.REFRESH_TOKEN)
        result.shouldBeInstanceOf<InjectionResult.Refused>()
        // The field is one of the declared extra keys - not the access token that WAS supplied.
        result.field shouldBe SessionInjectionExtras.REFRESH_TOKEN
        (result.field == VALID_TOKENS.getValue(SessionInjectionExtras.ACCESS_TOKEN)) shouldBe false
    }
})
