package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.AuthServerCode
import ch.monreleve.app.data.remote.AuthedResult
import ch.monreleve.app.data.remote.RefreshResult
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest

// AN-TOKEN-RACE (R506). TWO SESSIONS IN ONE PROCESS SIGN THE PERSON OUT AT RANDOM.
//
// MainActivity and SyncWorker each built their own SessionManager (MainActivity.kt:189, SyncWorker.kt:41), and the
// single-flight refresh guard is a Mutex PER INSTANCE. KMP-3's "two concurrent requests refresh ONCE" (R451) holds
// inside one instance and never across two. Both read the same Keystore prefs file, so when the screen and the worker
// meet an expired access token at the same moment, each sends the SAME refresh token: the first is a rotation, the
// second a replay - and the server, which cannot tell a race from a theft, ends the whole session (R210).
//
// THE TWO SITES ARE KEPT AS TWO CALLS on purpose: what a site RECEIVES is the thing under test, so the race is run
// from two places exactly as the app runs it. The server is TokenServer - the rules of tokens.ts, deciding at arrival
// and answering after a latency - and its own fidelity is the last test here, the JVM mirror of the server half this
// task also proved against the local stack (REPORT-AN-TOKEN-RACE, R506).

private const val ACCOUNT = "an-token-race@monreleve.test"
private const val ME = "/api/v1/me"
private const val ENTRIES = "/api/v1/entries"
private const val EMPTY_BATCH = """{"entries":[]}"""

/** What one race left behind - ONE value, so a failure prints every fact at once rather than the first to differ. */
private data class RaceOutcome(
    val refreshesReachingTheServer: Int,
    val sessionRevokedBecause: String?,
    val screen: String?,
    val worker: String?,
    val deviceHoldsTheLivePair: Boolean,
)

/** The screen reads /me while the worker posts a batch, both holding the same expired access token. */
private suspend fun CoroutineScope.raceAtExpiry(
    screenSession: SessionManager,
    workerSession: SessionManager,
    server: TokenServer,
    store: TokenStore,
    first: TokenPair,
): RaceOutcome {
    val screen = async { screenSession.authenticatedGet(ME) }
    val worker = async { workerSession.authenticatedPost(ENTRIES, EMPTY_BATCH) }
    val screenOutcome = screen.await()
    val workerOutcome = worker.await()
    val live = server.liveRefreshOf(first)
    return RaceOutcome(
        refreshesReachingTheServer = server.refreshRequests,
        sessionRevokedBecause = server.revocationOf(first),
        screen = screenOutcome::class.simpleName,
        worker = workerOutcome::class.simpleName,
        deviceHoldsTheLivePair = live != null && store.load()?.refreshToken == live,
    )
}

class TokenRaceTest : FunSpec({
    test("R506 - the screen and the worker meet an expired access token at once: ONE rotation, the session lives") {
        runTest {
            val server = TokenServer()
            val first = server.openSession(ACCOUNT)
            server.expireAccess(first)
            val store = OneTokenStore(first)
            val build = { SessionManager(AuthApi(server, TOKEN_SERVER_BASE), store) }
            val process = SessionHolder()

            // THE TWO SITES, receiving what the app gives them since R507: the process's ONE SessionManager. At 935c1ac
            // each received its own - build() - and this test was RED: two refreshes, TOKEN_REPLAYED, both calls lost.
            val screenSession = process.get(build) // MainActivity: processSession(context)
            val workerSession = process.get(build) // buildSyncEngine: processSession(context)

            raceAtExpiry(screenSession, workerSession, server, store, first) shouldBe
                RaceOutcome(
                    refreshesReachingTheServer = 1,
                    sessionRevokedBecause = null,
                    screen = "Ok",
                    worker = "Ok",
                    deviceHoldsTheLivePair = true,
                )
        }
    }

    test("hazard control - TWO SessionManagers over one store, raced the same way, DO end the session") {
        // Why the fence exists, and the presence half of R506's absence: with a second instance the same race MUST
        // reach the server twice and end the session. If it ever stops doing so, TokenServer has stopped modelling
        // the replay - and the R506 race test would then pass whatever the app constructs (R169's corollary).
        runTest {
            val server = TokenServer()
            val first = server.openSession(ACCOUNT)
            server.expireAccess(first)
            val store = OneTokenStore(first)

            val outcome =
                raceAtExpiry(
                    SessionManager(AuthApi(server, TOKEN_SERVER_BASE), store),
                    SessionManager(AuthApi(server, TOKEN_SERVER_BASE), store),
                    server,
                    store,
                    first,
                )

            outcome.refreshesReachingTheServer shouldBe 2
            outcome.sessionRevokedBecause shouldBe TokenServer.TOKEN_REPLAYED
            outcome.deviceHoldsTheLivePair shouldBe false
        }
    }

    test("the fake answers a replay as tokens.ts does - a second refresh of one token ends the WHOLE session") {
        runTest {
            val server = TokenServer()
            val api = AuthApi(server, TOKEN_SERVER_BASE)
            val first = server.openSession(ACCOUNT)

            val rotation = api.refresh(first.refreshToken)
            val successor = rotation.shouldBeInstanceOf<RefreshResult.Rotated>().pair
            // The first presentation rotated it; the second is the replay, refused with the route's one 401.
            api.refresh(first.refreshToken) shouldBe RefreshResult.Invalid
            server.revocationOf(first) shouldBe TokenServer.TOKEN_REPLAYED
            // THE WHOLE SESSION: the successor the rotation handed out is dead too, both halves of it.
            api.refresh(successor.refreshToken) shouldBe RefreshResult.Invalid
            api.authenticatedGet(ME, successor.accessToken) shouldBe
                AuthedResult.Unauthorized(AuthServerCode.REVOKED_SESSION)
            server.refreshRequests shouldBe 3
        }
    }
})
