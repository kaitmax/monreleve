package ch.monreleve.app.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

// AN4 increment 2. The class-level half of the log fence (AC3): a data class's
// generated toString() prints every field, so this asserts the override actually
// redacts both tokens - the leak a generic serialiser (a crash reporter, a
// Log.d("$pair")) would produce, which the source scanner alone cannot see.
class TokenPairTest : FunSpec({
    test("toString redacts both tokens, keeps the non-secret expiries") {
        val pair =
            TokenPair(
                accessToken = "acc-SECRET-0123456789",
                refreshToken = "ref-SECRET-abcdefghij",
                accessExpiresAt = "2027-06-18T16:18:00.000Z",
                refreshExpiresAt = "2027-09-16T16:03:00.000Z",
            )

        val rendered = pair.toString()

        rendered shouldNotContain "acc-SECRET-0123456789"
        rendered shouldNotContain "ref-SECRET-abcdefghij"
        rendered shouldContain "<redacted>"
        rendered shouldContain "2027-06-18T16:18:00.000Z"
    }
})
