package ch.monreleve.app.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

// AN4 increment 4 (AC2 / android-intent-security). The incoming App Link URI is
// UNTRUSTED input. CallbackLink.parse validates scheme, host and path against the
// FROZEN shape (R195: GET https://monreleve.ch/api/v1/auth/callback?token=&email=)
// and extracts token + email, or returns null. A wrong host or scheme, a missing
// parameter, a foreign path - all rejected. Pure java.net.URI so it is testable
// without a device; the Activity applies the same call in onCreate AND onNewIntent.
// RED first: CallbackLink did not exist.

private const val VALID = "https://monreleve.ch/api/v1/auth/callback?token=abc123&email=a%40b.ch"

class CallbackLinkTest : FunSpec({
    test("a well-formed callback URI yields the token and the decoded email") {
        val parsed = CallbackLink.parse(VALID)
        parsed shouldNotBe null
        parsed?.token shouldBe "abc123"
        parsed?.email shouldBe "a@b.ch"
    }

    test("a wrong host is rejected - an attacker's domain cannot drive the exchange") {
        CallbackLink.parse("https://evil.example/api/v1/auth/callback?token=abc&email=a%40b.ch").shouldBeNull()
    }

    test("a non-https scheme is rejected") {
        CallbackLink.parse("http://monreleve.ch/api/v1/auth/callback?token=abc&email=a%40b.ch").shouldBeNull()
        CallbackLink.parse("monreleve://api/v1/auth/callback?token=abc&email=a%40b.ch").shouldBeNull()
    }

    test("a foreign path on the right host is rejected") {
        CallbackLink.parse("https://monreleve.ch/api/v1/entries?token=abc&email=a%40b.ch").shouldBeNull()
    }

    test("a missing token or a missing email is rejected") {
        CallbackLink.parse("https://monreleve.ch/api/v1/auth/callback?email=a%40b.ch").shouldBeNull()
        CallbackLink.parse("https://monreleve.ch/api/v1/auth/callback?token=abc").shouldBeNull()
        CallbackLink.parse("https://monreleve.ch/api/v1/auth/callback?token=&email=").shouldBeNull()
    }

    test("null or garbage is rejected, never a crash") {
        CallbackLink.parse(null).shouldBeNull()
        CallbackLink.parse("not a uri at all").shouldBeNull()
    }
})
