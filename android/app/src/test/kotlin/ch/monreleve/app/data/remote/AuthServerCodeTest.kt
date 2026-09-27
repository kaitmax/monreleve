package ch.monreleve.app.data.remote

// AN4 increment 1. R198 - error mapping preserves WHICH rule fired: every server
// code the auth flow can return maps to its own client state, and an unrecognised
// code is preserved rather than collapsed into a generic error (contract 6.5:
// treat an unrecognised code as terminal, never guess). A network failure is a
// distinct type from a server error, so "could not reach the server" is never
// read as "the server refused us".
//
// The wire strings and their client actions are transcribed from docs/api-v1.md
// 1.4 and web/lib/auth/bearer.ts AUTH_CODES - the frozen contract this client
// consumes (R195). RED first: the classes did not exist.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

class AuthServerCodeTest : FunSpec({
    test("every documented auth code round-trips through its wire string") {
        AuthServerCode.fromWire("missing_token") shouldBe AuthServerCode.MISSING_TOKEN
        AuthServerCode.fromWire("malformed_authorization") shouldBe AuthServerCode.MALFORMED_AUTHORIZATION
        AuthServerCode.fromWire("unknown_token") shouldBe AuthServerCode.UNKNOWN_TOKEN
        AuthServerCode.fromWire("expired_token") shouldBe AuthServerCode.EXPIRED_TOKEN
        AuthServerCode.fromWire("rotated_token") shouldBe AuthServerCode.ROTATED_TOKEN
        AuthServerCode.fromWire("revoked_session") shouldBe AuthServerCode.REVOKED_SESSION
        AuthServerCode.fromWire("invalid_link") shouldBe AuthServerCode.INVALID_LINK
        AuthServerCode.fromWire("invalid_refresh_token") shouldBe AuthServerCode.INVALID_REFRESH_TOKEN
        AuthServerCode.fromWire("malformed_body") shouldBe AuthServerCode.MALFORMED_BODY
    }

    test("an unrecognised code resolves to null - terminal, never guessed (contract 6.5)") {
        AuthServerCode.fromWire("some_future_code").shouldBeNull()
        AuthServerCode.fromWire(null).shouldBeNull()
    }

    test("R198: each code carries its own client action, transcribed from the contract's 'what the client does'") {
        AuthServerCode.EXPIRED_TOKEN.action shouldBe ClientAction.REFRESH
        AuthServerCode.ROTATED_TOKEN.action shouldBe ClientAction.REFRESH
        AuthServerCode.REVOKED_SESSION.action shouldBe ClientAction.SIGN_IN
        AuthServerCode.UNKNOWN_TOKEN.action shouldBe ClientAction.SIGN_IN
        AuthServerCode.INVALID_LINK.action shouldBe ClientAction.SIGN_IN
        AuthServerCode.INVALID_REFRESH_TOKEN.action shouldBe ClientAction.SIGN_IN
        AuthServerCode.MISSING_TOKEN.action shouldBe ClientAction.CLIENT_BUG
        AuthServerCode.MALFORMED_AUTHORIZATION.action shouldBe ClientAction.CLIENT_BUG
        AuthServerCode.MALFORMED_BODY.action shouldBe ClientAction.CLIENT_BUG
    }

    test("a server failure preserves the raw code even when unrecognised, and keeps the status") {
        val known = parseServerFailure(401, """{"status":"error","code":"expired_token","message":"x"}""")
        known.code shouldBe AuthServerCode.EXPIRED_TOKEN
        known.rawCode shouldBe "expired_token"
        known.status shouldBe 401

        val future = parseServerFailure(400, """{"status":"error","code":"teapot","message":"y"}""")
        future.code.shouldBeNull()
        future.rawCode shouldBe "teapot"
        future.status shouldBe 400
    }

    test("a non-JSON error body still yields a server failure at its status, not a crash") {
        val garbage = parseServerFailure(500, "<html>502 Bad Gateway</html>")
        garbage.code.shouldBeNull()
        garbage.rawCode.shouldBeNull()
        garbage.status shouldBe 500
    }

    test("a server failure and a network failure are distinct types (R198: never collapsed)") {
        val server: ApiFailure = parseServerFailure(401, """{"code":"revoked_session"}""")
        val network: ApiFailure = ApiFailure.Network("timeout")
        server.shouldBeInstanceOf<ApiFailure.Server>()
        network.shouldBeInstanceOf<ApiFailure.Network>()
    }
})
