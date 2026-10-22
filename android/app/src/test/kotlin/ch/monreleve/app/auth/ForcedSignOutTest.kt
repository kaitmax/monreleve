package ch.monreleve.app.auth

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.AccountEvent
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.SignOutPrompt
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-TOKEN-RACE (R508, then R509). A SIGN-OUT NOBODY ASKED FOR.
//
// R508 asks what the app does TODAY when the server has ended the session - a refresh refused, or TOKEN_REPLAYED -
// before anything is changed: does it reach R295's wipe, and do unsent days survive? The answer is established here
// by running the app's own pieces against TokenServer, not by reading them: the worker's drain, the session, the
// Parametres screen with its LocalStore (the ONE place R295's wipe lives) and the record repository, all over one
// account whose session is ended through the product's own replay detection - another holder rotates the refresh
// token first, so the phone's own refresh is the replay (tokens.ts, TOKEN_REPLAYED).

private const val EMAIL_A = "a@monreleve.test"
private const val TAX_YEAR = 2026
private const val DAY = "2026-10-21"
private val TAG_A: String = checkNotNull(accountTagOf(EMAIL_A))
private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneId.of("Europe/Paris"))
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

internal class MemoryAccountStore(
    private var tag: String?,
) : AccountStore {
    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
    }

    override fun clear() {
        tag = null
    }
}

private class MemorySettingsStore(
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

/** R295's wipe, recorded rather than performed - LocalStoreTest owns what the wipe clears; this asks WHETHER. */
private class RecordingLocalStore : LocalStore {
    val calls = mutableListOf<String>()

    override suspend fun clearForSignOut() {
        calls += "clearForSignOut"
    }

    override suspend fun clearForDeletion() {
        calls += "clearForDeletion"
    }
}

/** One device, signed in as A, built the way the app builds it - over TokenServer instead of the network. */
private class Device(
    scope: TestScope,
) {
    val server = TokenServer()
    val firstPair = server.openSession(EMAIL_A)
    val tokens = OneTokenStore(firstPair)
    val accounts = MemoryAccountStore(TAG_A)
    val dao = FakeEntryDao()
    val session = SessionManager(AuthApi(server, TOKEN_SERVER_BASE), tokens)
    val repository =
        LocalEntryRepository(
            dao,
            CLOCK,
            currentAccount = { accounts.current() },
            isSignedIn = { accounts.current() != null },
        )
    val wipe = RecordingLocalStore()
    val parametres =
        ParametresController(
            SessionSettingsSaver(session),
            MemorySettingsStore(SETTINGS),
            repository,
            TAX_YEAR,
            scope,
            revokeServer = session::revokeServerSession,
            // buildSyncEngine's shape exactly: the session, and the account read when the drain runs.
            syncNow = { drain() },
            localStore = wipe,
            authenticatedPost = session::authenticatedPost,
        )
    val events = mutableListOf<AccountEvent>()

    /** What SyncWorker does on each run (buildSyncEngine): one drain of the current account's queue. */
    suspend fun drain(): SyncOutcome = SyncEngine(dao, session, accounts.current()).sync()

    /** The session ended server-side: another holder of the refresh token rotated it first (the race's winner). */
    suspend fun anotherHolderRotatesFirst() {
        AuthApi(server, TOKEN_SERVER_BASE).refresh(firstPair.refreshToken)
    }

    /** Collects what the shell would be told. Foreground, and cancelled by the test: advanceUntilIdle drives it. */
    fun listen(scope: CoroutineScope): Job = scope.launch { parametres.accountEvents.collect { events += it } }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ForcedSignOutTest : FunSpec({
    test("R508 - a session the server ENDED does not reach R295's wipe: the unsent day survives, still tagged") {
        runTest {
            val device = Device(this)
            val listener = device.listen(this)
            // A day recorded while the phone could not reach the server: PENDING, tagged A.
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))

            device.anotherHolderRotatesFirst()
            // The worker's next run meets it: 401 rotated_token, its refresh is the replay, the session is revoked.
            val drained = device.drain()
            // And a screen's next call meets a device with no session left.
            device.parametres.setAutoDetection(false)
            advanceUntilIdle()

            drained shouldBe SyncOutcome.Unauthenticated
            device.server.revocationOf(device.firstPair) shouldBe TokenServer.TOKEN_REPLAYED
            // THE FORCED SIGN-OUT: the tokens go (SessionManager clears them, and nothing else) ...
            device.tokens.load() shouldBe null
            // ... and R295's wipe is NOT reached, nor is the shell told to leave.
            device.wipe.calls shouldBe emptyList()
            device.events shouldBe emptyList()
            // The screen says the session ended - the only thing the person is shown.
            device.parametres.state.value.phase shouldBe ParametresPhase.SESSION_ENDED
            // THE DAY SURVIVES: still on the phone, still PENDING, still A's.
            device.accounts.current() shouldBe TAG_A
            device.dao.all().map { Triple(it.dayDate, it.syncState, it.accountTag) } shouldBe
                listOf(Triple(DAY, SyncState.PENDING, TAG_A))
            listener.cancel()
        }
    }

    test("R508 - the one path that loses it: « Se déconnecter » in the dead shell cannot send, warns, then wipes") {
        // The positive control for the absences above (R169's corollary): the SAME device, the SAME forced sign-out,
        // and the voluntary sign-out - unchanged, AN-POLISH's R440 - DOES reach the wipe and DOES tell the shell.
        // Its "send first" has nothing to send with: the session is gone, so the warning names the day.
        runTest {
            val device = Device(this)
            val listener = device.listen(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain()
            val requestsWhenTheSessionEnded = device.server.requests.size

            device.parametres.requestSignOut()
            advanceUntilIdle()

            // The bounded send ran and could post nothing - no request reached the server at all.
            device.server.requests.size shouldBe requestsWhenTheSessionEnded
            device.parametres.state.value.signOutPrompt shouldBe SignOutPrompt(pendingDates = listOf(DAY))

            device.parametres.confirmSignOut()
            advanceUntilIdle()

            device.wipe.calls shouldBe listOf("clearForSignOut")
            device.events shouldBe listOf(AccountEvent.SignedOut)
            listener.cancel()
        }
    }
})
