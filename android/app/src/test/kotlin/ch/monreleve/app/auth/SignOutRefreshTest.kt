package ch.monreleve.app.auth

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.AccountEvent
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-SIGNOUT-REFRESH (R705-R707). SIGNING OUT ALWAYS CLOSES THE SESSION ON THE SERVER, EVEN AFTER IDLE.
//
// THE DEFECT (AN-TALKBACK, Q4). An access token lives fifteen minutes (web/lib/auth/tokens.ts ACCESS_TTL_MS). Every
// authenticated call meets an expired one through SessionManager's `attempt`: a 401 expired_token/rotated_token, ONE
// refresh, ONE retry. « Se déconnecter » did not: revokeServerSession handed the stored access token straight to
// AuthApi.signOut, whose Boolean answer dropped the 401 and its code - so a phone that sat idle wiped itself and left
// its session alive on the server, revokedAt null.
//
// THE RULE (R706). Sign-out takes the SAME 401 path: on a 401, refresh once and retry once. A refused refresh, or a
// retry that also meets a 401, stops there - never a second refresh, never a third sign-out - and the device is wiped
// in every case, as before. And because this is a sign-out the person ASKED for, none of it is a server-ended session:
// SessionEnds records nothing (R520's signal is the server's alone - ForcedSignOutTest pins that for the happy path,
// this file for the three that refresh).
//
// THE FAKE IS TokenServer, which keeps tokens.ts's rules - so "the server was asked to revoke" is the session row's
// revokedReason, not a counter, and a replayed refresh token revokes the whole session as the real one does (R210).
// Each request is recorded WITH ITS BEARER OR REFRESH TOKEN, so the sequence proves the retry carried the NEW token.

private const val EMAIL = "signout-refresh@monreleve.test"
private const val TAX_YEAR = 2026
private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-10-31T10:00:00Z"), ZoneId.of("Europe/Paris"))
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille Rey")

private const val SIGN_OUT = "POST /api/v1/auth/sign-out"
private const val REFRESH = "POST /api/v1/auth/refresh"

/** Records every request the PHONE sends - "METHOD /path credential" - and hands it to the server unchanged. */
private class PhoneTransport(
    private val server: TokenServer,
) : HttpTransport {
    val sent = mutableListOf<String>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        val path = request.url.removePrefix(TOKEN_SERVER_BASE)
        val credential =
            request.headers["Authorization"]?.removePrefix("Bearer ")
                ?: Regex(""""refreshToken":"([^"]+)"""").find(request.body.orEmpty())?.groupValues?.get(1)
        sent += "${request.method} $path $credential"
        return server.execute(request)
    }
}

private class SignOutSettingsStore(
    private var settings: Settings?,
) : SettingsStore {
    override fun load(): Settings? = settings

    override fun save(settings: Settings) {
        this.settings = settings
    }

    override fun clear() {
        settings = null
    }
}

/** R295's wipe, recorded - LocalStoreTest owns WHAT it clears; this asks WHETHER it ran. */
private class WipeSpy : LocalStore {
    val calls = mutableListOf<String>()

    override suspend fun clearForSignOut() {
        calls += "clearForSignOut"
    }

    override suspend fun clearForDeletion() {
        calls += "clearForDeletion"
    }
}

/** One phone signed in, built as MainActivity builds it: the session, its onEnded, and Paramètres over them. */
@OptIn(ExperimentalCoroutinesApi::class)
private class Phone(
    scope: TestScope,
) {
    val server = TokenServer()
    val pair = server.openSession(EMAIL)
    val tokens = OneTokenStore(pair)
    val transport = PhoneTransport(server)
    val ends = SessionEnds()
    val session =
        SessionManager(
            AuthApi(transport, TOKEN_SERVER_BASE),
            tokens,
            // What a server-ended session does in the app, minus the device clear (its own tests own that): recorded.
            onEnded = { ends.record() },
        )
    val wipe = WipeSpy()
    val parametres =
        ParametresController(
            SessionSettingsSaver(session),
            SignOutSettingsStore(SETTINGS),
            LocalEntryRepository(FakeEntryDao(), CLOCK),
            TAX_YEAR,
            scope,
            revokeServer = session::revokeServerSession,
            localStore = wipe,
            authenticatedPost = session::authenticatedPost,
        )

    /** Another holder of the same refresh token rotates it first - the phone's own refresh is then the replay. */
    suspend fun anotherHolderRotates() {
        AuthApi(server, TOKEN_SERVER_BASE).refresh(pair.refreshToken)
    }

    /** « Se déconnecter », confirmed, with nothing waiting to be sent - the AN-TALKBACK case exactly. */
    suspend fun signOut(scope: TestScope) {
        parametres.requestSignOut()
        scope.advanceUntilIdle()
        parametres.confirmSignOut()
        scope.advanceUntilIdle()
    }

    /** The device half, the same in every case: the wipe ran once and the shell was told SignedOut. */
    suspend fun shouldBeWiped() {
        wipe.calls shouldBe listOf("clearForSignOut")
        parametres.accountEvents.first() shouldBe AccountEvent.SignedOut
        // A sign-out the person asked for is never a session the SERVER ended (R520, SessionEnds.kt).
        ends.ends.value shouldBe 0
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignOutRefreshTest : FunSpec({
    test("R707 (a) - an EXPIRED access token: 401, ONE refresh, ONE retry with the new token -> the server revokes") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()
            phone.server.expireAccess(phone.pair)

            phone.signOut(this)

            phone.transport.sent shouldBe
                listOf(
                    "$SIGN_OUT ${phone.pair.accessToken}",
                    "$REFRESH ${phone.pair.refreshToken}",
                    "$SIGN_OUT access-2",
                )
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.SIGNED_OUT
            phone.shouldBeWiped()
        }
    }

    test("R707 (b) - the refresh is REFUSED (refresh token expired): no retry, nothing revoked, the device wiped") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()
            phone.server.expireAccess(phone.pair)
            phone.server.expireRefresh(phone.pair)

            phone.signOut(this)

            phone.transport.sent shouldBe
                listOf(
                    "$SIGN_OUT ${phone.pair.accessToken}",
                    "$REFRESH ${phone.pair.refreshToken}",
                )
            phone.server.revocationOf(phone.pair) shouldBe null
            phone.shouldBeWiped()
        }
    }

    test("R707 (b) - the refresh is a REPLAY: R210 still ends the session on the server, no retry, the device wiped") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()
            phone.anotherHolderRotates()

            phone.signOut(this)

            // The phone's access token died with the rotation (rotated_token), so it refreshes - with a consumed token.
            phone.transport.sent shouldBe
                listOf(
                    "$SIGN_OUT ${phone.pair.accessToken}",
                    "$REFRESH ${phone.pair.refreshToken}",
                )
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.TOKEN_REPLAYED
            phone.shouldBeWiped()
        }
    }

    test("R707 (c) - the RETRY also meets a 401: no third attempt, no second refresh, the device wiped") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()
            phone.server.expireAccess(phone.pair)
            // A revoke-all landing between the rotation and the retry: the retry's fresh token meets revoked_session.
            phone.server.revokeAfterNextRotation = TokenServer.REVOKED_ALL

            phone.signOut(this)

            phone.transport.sent shouldBe
                listOf(
                    "$SIGN_OUT ${phone.pair.accessToken}",
                    "$REFRESH ${phone.pair.refreshToken}",
                    "$SIGN_OUT access-2",
                )
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.REVOKED_ALL
            phone.shouldBeWiped()
        }
    }

    test("R707 (d) - the HAPPY PATH is unchanged: one sign-out, answered 200, the server revokes, the device wiped") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()

            phone.signOut(this)

            phone.transport.sent shouldBe listOf("$SIGN_OUT ${phone.pair.accessToken}")
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.SIGNED_OUT
            phone.shouldBeWiped()
        }
    }

    test("R706 - a DEAD session (revoked_session) is not refreshed, as on every other call: one request, wiped") {
        runTest {
            val phone = Phone(this)
            advanceUntilIdle()
            // Revoke-all from another device, under the same access token: the session is over on the server.
            AuthApi(phone.server, TOKEN_SERVER_BASE)
                .authenticatedPost("/api/v1/auth/revoke-all", "{}", phone.pair.accessToken)

            phone.signOut(this)

            phone.transport.sent shouldBe listOf("$SIGN_OUT ${phone.pair.accessToken}")
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.REVOKED_ALL
            phone.shouldBeWiped()
        }
    }

    test("R706 - SessionManager.signOut (the debug probe's) takes the same path, and clears the tokens after it") {
        runTest {
            val phone = Phone(this)
            phone.server.expireAccess(phone.pair)

            phone.session.signOut()

            phone.transport.sent shouldBe
                listOf(
                    "$SIGN_OUT ${phone.pair.accessToken}",
                    "$REFRESH ${phone.pair.refreshToken}",
                    "$SIGN_OUT access-2",
                )
            phone.server.revocationOf(phone.pair) shouldBe TokenServer.SIGNED_OUT
            phone.tokens.load() shouldBe null
            phone.ends.ends.value shouldBe 0
        }
    }
})
