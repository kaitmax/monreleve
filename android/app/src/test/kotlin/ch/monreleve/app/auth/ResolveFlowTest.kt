package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.startup.StartDecision
import ch.monreleve.app.startup.UnresolvedCause
import ch.monreleve.app.startup.decideStartAfterSignIn
import ch.monreleve.app.startup.meFetchOf
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.test.runTest
import java.io.IOException

// AN-SIGNIN-RESOLVE (R1161) - THE RESOLVE, CROSSED WHOLE (R204). StartupDeciderTest proves the decision over a fake
// MeFetch; this drives it the way MainActivity's ResolvingRoute does - decideStartAfterSignIn over
// meFetchOf(session.authenticatedGet(ME_PATH)), through the real SessionManager and AuthApi, against TokenServer - so
// the STATUS is proven to reach the decision from the wire, on the first request AND on the retry after a refresh
// (the two places SessionManager builds an Ok). R1160's measured fault is the first case: the network changed under
// a pending /me (emulator API 36), the transport threw, and the phone showed a returning person the EMPTY onboarding.

private const val EMAIL = "camille@example.invalid"
private val COMPLETE = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille Rey")
private const val HTTP_SERVER_ERROR = 500
private const val HTTP_OK = 200

private class ResolvingPhone {
    val server = TokenServer().apply { holdSettings(EMAIL, meBody(COMPLETE)) }
    val pair = server.openSession(EMAIL)
    val session = SessionManager(AuthApi(server, TOKEN_SERVER_BASE), OneTokenStore(pair), onEnded = {})
    val modes = mutableListOf<LoggingMode>()
    val settings =
        object : SettingsStore {
            private var held: Settings? = null

            override fun load(): Settings? = held

            override fun save(settings: Settings) {
                held = settings
            }

            override fun clear() {
                held = null
            }
        }

    /** RESOLVING, exactly as ResolvingRoute runs it. */
    suspend fun resolve(): StartDecision =
        decideStartAfterSignIn({ meFetchOf(session.authenticatedGet(ME_PATH)) }, settings, modes::add, {})
}

class ResolveFlowTest : FunSpec({
    test("R1160/R1161: /me lost to the network -> Unresolved, nothing written; the retry once it is back -> Main") {
        runTest {
            val phone = ResolvingPhone()
            phone.server.meFault = RefreshFault.Unreachable(IOException("Software caused connection abort"))
            phone.resolve() shouldBe StartDecision.Unresolved(UnresolvedCause.UNREACHABLE)
            phone.settings.load() shouldBe null
            phone.modes shouldBe emptyList()

            phone.server.meFault = null
            phone.resolve() shouldBe StartDecision.Main
            phone.settings.load() shouldBe COMPLETE
            phone.modes shouldBe listOf(LoggingMode.MANUAL)
        }
    }

    test("R1161: /me answered 500 -> Unresolved (the status reaches the decision from the wire)") {
        runTest {
            val phone = ResolvingPhone()
            phone.server.meFault =
                RefreshFault.Answer(HttpResponse(HTTP_SERVER_ERROR, """{"status":"error","code":"internal"}"""))
            phone.resolve() shouldBe StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            phone.settings.load() shouldBe null
        }
    }

    test("R1161: /me answered 200 with something that is not a /me answer -> Unresolved, never the empty form") {
        runTest {
            val phone = ResolvingPhone()
            phone.server.meFault = RefreshFault.Answer(HttpResponse(HTTP_OK, """{"status":"ok"}"""))
            phone.resolve() shouldBe StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
        }
    }

    test("R1161: the 500 met on the RETRY after a refresh is still Unresolved (the second place an Ok is built)") {
        runTest {
            val phone = ResolvingPhone()
            phone.server.expireAccess(phone.pair)
            phone.server.meFault =
                RefreshFault.Answer(HttpResponse(HTTP_SERVER_ERROR, """{"status":"error","code":"internal"}"""))
            phone.resolve() shouldBe StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            phone.server.refreshRequests shouldBe 1
        }
    }

    test("R1161: a brand-new account - the server's positive 'no settings' answer - is onboarded") {
        runTest {
            val server = TokenServer()
            val session =
                SessionManager(AuthApi(server, TOKEN_SERVER_BASE), OneTokenStore(server.openSession(EMAIL)), {})
            val modes = mutableListOf<LoggingMode>()
            val store =
                object : SettingsStore {
                    override fun load(): Settings? = null

                    override fun save(settings: Settings) = error("nothing is saved for a brand-new account")

                    override fun clear() = Unit
                }
            decideStartAfterSignIn({ meFetchOf(session.authenticatedGet(ME_PATH)) }, store, modes::add, {})
                .shouldBeInstanceOf<StartDecision.Onboard>()
            modes shouldBe listOf(LoggingMode.MANUAL)
        }
    }
})
