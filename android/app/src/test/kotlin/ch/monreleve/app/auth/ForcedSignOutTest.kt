package ch.monreleve.app.auth

import ch.monreleve.app.Destination
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.sync.EntriesDownload
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome
import ch.monreleve.app.data.sync.YearDownload
import ch.monreleve.app.destinationAfterSessionEnd
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.AccountEvent
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.SignOutPrompt
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
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
private const val EMAIL_B = "b@monreleve.test"
private const val CODE = "123456"
private const val TAX_YEAR = 2026
private const val DAY = "2026-10-21"
private const val OTHER_DAY = "2026-10-20"
private const val THIRD_DAY = "2026-10-19"
private val TAG_A: String = checkNotNull(accountTagOf(EMAIL_A))
private val TAG_B: String = checkNotNull(accountTagOf(EMAIL_B))
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

/** The address a sign-in was asked for - what the link is bound to (login-CSRF) and the code screen exchanges. */
private class MemoryPendingSignIn(
    private var email: String?,
) : PendingSignInStore {
    override fun remember(email: String) {
        this.email = email
    }

    override fun pending(): String? = email

    override fun clear() {
        email = null
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

    // R520: the process's session-end record, and the session told of each ending - processSession's wiring.
    val ends = SessionEnds()
    val session = SessionManager(AuthApi(server, TOKEN_SERVER_BASE), tokens, onEnded = { ends.record() })
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

    /** The one row still waiting to be sent - its mutation id, which is what the server will hold once it is. */
    suspend fun heldMutation(): String = dao.all().single { it.syncState == SyncState.PENDING }.clientMutationId

    /** A day recorded while the phone could still reach the server: written, then drained (now the server's too). */
    suspend fun recordOnline(kind: EntryKind) {
        repository.record(RecordCommand(dayDate = DAY, kind = kind))
        drain()
    }

    /** The account signs in BY CODE on the code screen, exactly as CodeRoute builds it. */
    fun signInByCode(
        email: String,
        scope: CoroutineScope,
    ): CodeController {
        val controller =
            CodeController(
                AuthApi(server, TOKEN_SERVER_BASE),
                tokens,
                MemoryPendingSignIn(email),
                accounts,
                email,
                scope,
                syncNow = { drain() },
            )
        controller.onCodeChange(CODE)
        return controller
    }

    /** The account signs in BY LINK, exactly as CallbackActivity builds it, with the link the email carried. */
    fun signInByLink(
        email: String,
        scope: CoroutineScope,
    ): CallbackController {
        val controller =
            CallbackController(
                AuthApi(server, TOKEN_SERVER_BASE),
                tokens,
                MemoryPendingSignIn(email),
                scope,
                accounts,
                syncNow = { drain() },
            )
        val link = "https://monreleve.ch/api/v1/auth/callback?token=link-token&email=" + email.replace("@", "%40")
        controller.handle(link)
        return controller
    }

    /** RESOLVING's sign-in download (buildEntriesDownload's shape): the account read when it is used. */
    fun yearDownload(): EntriesDownload =
        EntriesDownload(dao, session::authenticatedGet, { accounts.current() }, { block -> block() })

    /** Collects what the shell would be told. Foreground, and cancelled by the test: advanceUntilIdle drives it. */
    fun listen(scope: CoroutineScope): Job = scope.launch { parametres.accountEvents.collect { events += it } }
}

/** R295's two wipes - what PARK-T1's way out reached. Neither may run on a sign-out nobody asked for (R520). */
private val R295_WIPES = setOf("clearForSignOut", "clearForDeletion")

/**
 * AN-FORCED-SIGNOUT (R520). THE DESTINATION MainActivity HOLDS WHILE ITS SHELL IS OPEN, wired the way MainActivity
 * wires it - one job per thing that moves it. It replaces [Device.listen] in the tests that use it: the account
 * events are a Channel, so two collectors would split them.
 */
private class Shell(
    scope: CoroutineScope,
    device: Device,
) {
    var destination: Destination = Destination.MAIN
        private set

    private val jobs =
        listOf(
            // R295: a sign-out or a deletion COMPLETED - MainShell's accountEvents collector (onSignedOut).
            scope.launch { device.parametres.accountEvents.collect { destination = Destination.SIGN_IN } },
            // R520: the server ended the session - MainActivity's processSessionEnds collector.
            scope.launch {
                device.ends.ends.collect {
                    destination = destinationAfterSessionEnd(destination, device.session.isSignedIn())
                }
            },
        )

    fun close() = jobs.forEach { it.cancel() }
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

    test("R508 - the voluntary sign-out's controller, driven after a forced sign-out, still warns and wipes") {
        // The positive control for the absences above (R169's corollary): the SAME device, the SAME forced sign-out,
        // and the voluntary sign-out - unchanged, AN-POLISH's R440 - DOES reach the wipe and DOES tell the shell.
        // Its "send first" has nothing to send with: the session is gone, so the warning names the day.
        //
        // AN-FORCED-SIGNOUT (R520): this WAS "the one path that loses it" - PARK-T1, the dead shell's only exit. The
        // controller is deliberately unchanged (the voluntary sign-out is AN-POLISH's), so driven directly it still
        // does exactly this; what R520 removed is the shell that offered it - a forced sign-out now lands on sign-in
        // (the R520 PARK-T1 test below). This stays as the control: the wipe the PARK-T1 test proves unreached.
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

    test("R520 - PARK-T1: the server ends the session, the person looks for a way out, and the held day survives") {
        // PARK-T1 exactly, on a real forced sign-out (the product's own replay detection, R508): the person is on
        // the screen the app left them on, and takes the way out it offers. On the shell that is Parametres'
        // « Se déconnecter » - AN-POLISH's voluntary sign-out - confirmed if it asks. The sign-in screen offers
        // no sign-out at all.
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain() // the worker meets the replay: the server ends the session
            advanceUntilIdle()

            if (shell.destination == Destination.MAIN) {
                device.parametres.requestSignOut()
                advanceUntilIdle()
                if (device.parametres.state.value.signOutPrompt != null) device.parametres.confirmSignOut()
                advanceUntilIdle()
            }

            // THE HELD DAY SURVIVES: on the phone, PENDING, still A's - R295's wipe never reached ...
            device.wipe.calls.filter { it in R295_WIPES } shouldBe emptyList()
            device.accounts.current() shouldBe TAG_A
            device.dao.all().map { Triple(it.dayDate, it.syncState, it.accountTag) } shouldBe
                listOf(Triple(DAY, SyncState.PENDING, TAG_A))
            // ... because the person was taken to sign-in, where nothing wipes.
            shell.destination shouldBe Destination.SIGN_IN
            shell.close()
        }
    }

    test("R520 / R225 - the sign-in screen it lands on names the days waiting, counted from the record") {
        // R225: the question « where are my days? » is raised by landing on sign-in; the answer is asserted where
        // the screen gets it - the forced state and the count MainActivity's SIGN_IN route hands RequestLinkScreen,
        // read from the same stores it reads, after a real forced sign-out - never as a constant.
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            // Three of A's rows on TWO dates - half-day mode writes two rows for one date - and one of B's.
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.AM))
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.CH, portion = Portion.PM))
            device.repository.record(RecordCommand(dayDate = OTHER_DAY, kind = EntryKind.HOME))
            device.accounts.setCurrent(TAG_B)
            device.repository.record(RecordCommand(dayDate = THIRD_DAY, kind = EntryKind.CH))
            device.accounts.setCurrent(TAG_A)
            // THE CONTROL: while the session lives, nothing is named and the shell stays where it is.
            sessionClosedByServer(device.session.isSignedIn(), device.accounts.current()) shouldBe false
            shell.destination shouldBe Destination.MAIN

            device.anotherHolderRotatesFirst()
            device.drain()
            advanceUntilIdle()

            shell.destination shouldBe Destination.SIGN_IN
            sessionClosedByServer(device.session.isSignedIn(), device.accounts.current()) shouldBe true
            val named = heldDays(device.repository.observePending().first())
            // TWO DAYS: A's two dates, the half-day pair counted once, B's row never (R303).
            named shouldBe 2
            SignInCopy.sessionClosed(named) shouldContain "2 journées"
            shell.close()
        }
    }

    test("R520 - a VOLUNTARY sign-out records no server ending: the signal is the server's alone") {
        // The absence half of R520's signal, with its presence control in the same run: the voluntary sign-out
        // from a live session reaches R295's wipe and leaves - and SessionManager reported nothing; the forced
        // sign-out above reports one. A signal that also fired here would send the voluntary path to a notice
        // about days it has just wiped.
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.recordOnline(EntryKind.HOME)

            device.parametres.requestSignOut()
            advanceUntilIdle()
            device.parametres.confirmSignOut()
            advanceUntilIdle()

            device.wipe.calls shouldBe listOf("clearForSignOut")
            shell.destination shouldBe Destination.SIGN_IN
            device.ends.ends.value shouldBe 0
            device.server.revocationOf(device.firstPair) shouldBe TokenServer.SIGNED_OUT
            // THE PRESENCE CONTROL: another device, a held day, a server ending - counted. (A drain with nothing held
            // makes no request, so it would meet no ending at all: the day is what makes this a control.)
            val other = Device(this)
            other.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            other.anotherHolderRotatesFirst()
            other.drain()
            other.ends.ends.value shouldBe 1
            shell.close()
        }
    }

    test("R509 - the SAME account signs back in by code: its held day is sent BEFORE the year comes down") {
        runTest {
            val device = Device(this)
            // A recorded the day online (HOME, on the server), then corrected it offline (CH, held on the phone).
            device.recordOnline(EntryKind.HOME)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.CH))
            val held = device.heldMutation()
            device.anotherHolderRotatesFirst()
            device.drain() // the forced sign-out (R508)
            val before = device.server.requests.size

            val signIn = device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            val years = device.yearDownload().downloadYears(listOf(TAX_YEAR, TAX_YEAR - 1))

            // The held day went up FIRST, so the year that came down already held it.
            device.server.requests.drop(before) shouldBe
                listOf("POST /api/v1/auth/code", "POST /api/v1/entries", "GET /api/v1/entries", "GET /api/v1/entries")
            signIn.state.value.phase shouldBe CodePhase.SIGNED
            device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
            device.dao.all().map { Triple(it.kind, it.syncState, it.accountTag) } shouldBe
                listOf(Triple(EntryKind.CH, SyncState.SYNCED, TAG_A))
            years.first() shouldBe
                YearDownload.Applied(TAX_YEAR, 0, 0, unchanged = 1, keptUnsynced = 0, absentFromServer = 0)
        }
    }

    test("R509 - the sign-in could not send it: the year download keeps it pending (R483), the next drain sends it") {
        runTest {
            val device = Device(this)
            device.recordOnline(EntryKind.HOME)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.CH))
            val held = device.heldMutation()
            device.anotherHolderRotatesFirst()
            device.drain()
            device.server.refuseNextEntriesPost = true
            val before = device.server.requests.size

            device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            val years = device.yearDownload().downloadYears(listOf(TAX_YEAR, TAX_YEAR - 1))

            // The sign-in TRIED - one POST, refused - and the download, finding the server's older HOME, KEPT the
            // held CH rather than taking HOME back: R483, while the day was still only on the phone.
            device.server.requests.drop(before) shouldBe
                listOf("POST /api/v1/auth/code", "POST /api/v1/entries", "GET /api/v1/entries", "GET /api/v1/entries")
            years.first() shouldBe
                YearDownload.Applied(TAX_YEAR, 0, 0, unchanged = 0, keptUnsynced = 1, absentFromServer = 0)
            device.dao.all().map { Triple(it.kind, it.syncState, it.accountTag) } shouldBe
                listOf(Triple(EntryKind.CH, SyncState.PENDING, TAG_A))
            // The next drain - the next day recorded, or the worker - sends it.
            device.drain() shouldBe SyncOutcome.Settled(written = 1, defects = 0)
            device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
        }
    }

    test("R509 - ANOTHER account signs in: A's held day is never shown nor sent; B's own is (the control)") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            val heldA = device.heldMutation()
            // B's day, held on this phone from an earlier B session - so the drain has something of B's to send,
            // and "nothing of A's was sent" is not satisfied by a drain that never ran (R169's corollary).
            device.accounts.setCurrent(TAG_B)
            device.repository.record(RecordCommand(dayDate = OTHER_DAY, kind = EntryKind.CH))
            val heldB = device.dao.all().single { it.accountTag == TAG_B }.clientMutationId
            device.accounts.setCurrent(TAG_A)
            device.anotherHolderRotatesFirst()
            device.drain() // A's session ends (forced)

            val signIn = device.signInByCode(EMAIL_B, this)
            advanceUntilIdle()

            signIn.state.value.phase shouldBe CodePhase.SIGNED
            device.accounts.current() shouldBe TAG_B
            // THE CONTROL: the sign-in's drain ran, and sent B's held day ...
            device.server.mutationsOf(EMAIL_B) shouldBe listOf(heldB)
            // ... and NEVER A's: not sent under B's token, not shown to B, still held under A (R303).
            device.server.mutationsOf(EMAIL_A) shouldBe emptyList()
            device.repository.observeAll().first().map { it.clientMutationId } shouldBe listOf(heldB)
            device.dao.all().filter { it.accountTag == TAG_A }.map { it.clientMutationId to it.syncState } shouldBe
                listOf(heldA to SyncState.PENDING)
        }
    }

    test("R509 - the SAME account signs back in by LINK: its held day is sent too") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            val held = device.heldMutation()
            device.anotherHolderRotatesFirst()
            device.drain()
            val before = device.server.requests.size

            val signIn = device.signInByLink(EMAIL_A, this)
            advanceUntilIdle()

            device.server.requests.drop(before) shouldBe listOf("GET /api/v1/auth/callback", "POST /api/v1/entries")
            signIn.state.value.phase shouldBe CallbackPhase.SIGNED
            device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
            device.dao.all().map { it.syncState to it.accountTag } shouldBe listOf(SyncState.SYNCED to TAG_A)
        }
    }
})
