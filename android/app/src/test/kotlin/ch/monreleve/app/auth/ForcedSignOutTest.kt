package ch.monreleve.app.auth

import ch.monreleve.app.Destination
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.AuthServerCode
import ch.monreleve.app.data.remote.AuthedResult
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.remote.RefreshResult
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.sync.EntriesDownload
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome
import ch.monreleve.app.data.sync.YearDownload
import ch.monreleve.app.destinationAfterSessionEnd
import ch.monreleve.app.detection.SharedPrefsNearBorderNoticeStore
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.AccountEvent
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.SignOutPrompt
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.MemoryPrefsFile
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEmployerFigureStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import ch.monreleve.app.settings.SharedPrefsThresholdAlertStore
import ch.monreleve.app.settings.ThresholdCrossing
import ch.monreleve.app.startDestination
import ch.monreleve.app.startup.StartDecision
import ch.monreleve.app.startup.decideStartAfterSignIn
import ch.monreleve.app.startup.meFetchOf
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import java.net.ConnectException
import java.net.SocketTimeoutException
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

// R521: A's settings are COMPLETE (a name included), as an onboarded account's are - so a launch on them is MAIN.
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille Rey")

/** R521: the six manual settings and the name, as GET /api/v1/me serialises a complete row (lib/me/read.ts). */
private fun meOf(settings: Settings): JSONObject =
    JSONObject()
        .put("name", settings.name)
        .put("canton", settings.canton)
        .put("employmentRate", settings.employmentRate)
        .put("denominatorKind", settings.denominatorKind)
        .put("exactTotalWorkDays", settings.exactTotalWorkDays ?: JSONObject.NULL)
        .put("granularity", settings.granularity)
        .put("activityStartDate", settings.activityStartDate ?: JSONObject.NULL)
        .put("reminderTime", JSONObject.NULL)
        .put("reminderEnabled", false)
        .put("loggingMode", "MANUAL")
        .put("detectionConsentAt", JSONObject.NULL)

/** R521: a dossier body the app parses - DossierApiTest's, with the titulaire and year this test names. */
private fun dossierBody(
    titulaire: String,
    year: Int = TAX_YEAR,
): String =
    """
    {
      "taxYear": $year,
      "period": { "fraction": 1.0, "startDate": null },
      "titulaire": "$titulaire",
      "generatedAt": "2026-10-22T09:00:00.000Z",
      "canton": "GE",
      "employmentRate": 100,
      "denominatorKind": "SIMPLIFIED240",
      "tiles": { "workedDays": 240, "swissDays": 75, "teleworkDays": 43, "missionDays": 1 },
      "zone": {
        "declarableRate": 42.70, "rawRate": 43.60, "ratesDiffer": true,
        "fiscalCeilingDays": 96, "remainingToFiscal": 5.5, "remainingToSocial": 20, "warnings": []
      },
      "months": [],
      "annex": [],
      "absenceDays": 3,
      "recordedEntries": 5,
      "creditedMissionDays": 1,
      "rateWithoutMissions": 42.08
    }
    """.trimIndent()

/** R521: the cached releve - SharedPrefsDossierCache's contract, in memory. */
private class MemoryDossierCache : DossierCache {
    private val years = mutableMapOf<Int, String>()

    override fun load(year: Int): String? = years[year]

    override fun save(
        year: Int,
        body: String,
    ) {
        years[year] = body
    }

    override fun clear() = years.clear()
}

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

    // R521: the stores a forced sign-out clears and keeps, and DeviceLocalStore over them - the class the app builds
    // (deviceLocalStore). The Room clear, the sync cancel and the exports delete are spies, as in LocalStoreTest.
    val settings = MemorySettingsStore(SETTINGS)
    val cache = MemoryDossierCache().apply { save(TAX_YEAR, dossierBody("Camille Rey")) }
    val pending = MemoryPendingSignIn(null)

    // R527: monreleve.detection - ONE file, and the app's own five stores over it, so a clear is measured on what it
    // leaves of the file. A's phone has automatic mode on, as it did before every earlier test here.
    val detectionFile = MemoryPrefsFile()
    val detectionMode = SharedPrefsDetectionModeStore(detectionFile).apply { save(LoggingMode.AUTO_DETECT) }
    val evening = SharedPrefsEveningNotificationStore(detectionFile)
    val alert = SharedPrefsThresholdAlertStore(detectionFile)
    val nearBorder = SharedPrefsNearBorderNoticeStore(detectionFile)

    /** The employer figures, read as the account the phone holds NOW - SharedPrefsEmployerFigureStore's own lambda. */
    val employer = SharedPrefsEmployerFigureStore(detectionFile) { accounts.current() }
    var recordCleared = false
    var syncCancelled = false
    var exportsCleared = false
    val deviceStore =
        DeviceLocalStore(
            tokenStore = tokens,
            settingsStore = settings,
            dossierCache = cache,
            pendingSignIn = pending,
            accountStore = accounts,
            detectionModeStore = detectionMode,
            clearRecord = { recordCleared = true },
            cancelSync = { syncCancelled = true },
            clearExports = { exportsCleared = true },
        )

    // R520/R521: the process's session-end record, and the session told of each ending - processSession's wiring,
    // through the same handler the app runs (onServerEndedSession: the clear, then the signal).
    val ends = SessionEnds()
    val session =
        SessionManager(
            AuthApi(server, TOKEN_SERVER_BASE),
            tokens,
            onEnded = { onServerEndedSession(deviceStore, ends) },
        )
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
            settings,
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

/**
 * AN-FORCED-SIGNOUT (R522): R520's path, asserted the same way whichever way the session ended - the person on sign-in,
 * ONE ending recorded, R521's clear done, R295's wipe never reached, the held day still on the phone, PENDING and A's,
 * and the sign-in screen's forced state readable from the stores.
 */
private suspend fun assertTookTheForcedPath(
    device: Device,
    shell: Shell,
) {
    shell.destination shouldBe Destination.SIGN_IN
    device.ends.ends.value shouldBe 1
    device.tokens.load() shouldBe null
    device.settings.load() shouldBe null
    device.cache.load(TAX_YEAR) shouldBe null
    device.recordCleared shouldBe false
    device.wipe.calls.filter { it in R295_WIPES } shouldBe emptyList()
    device.accounts.current() shouldBe TAG_A
    device.dao.all().map { Triple(it.dayDate, it.syncState, it.accountTag) } shouldBe
        listOf(Triple(DAY, SyncState.PENDING, TAG_A))
    sessionClosedByServer(device.session.isSignedIn(), device.accounts.current()) shouldBe true
    heldDays(device.repository.observePending().first()) shouldBe 1
}

/**
 * AN-FORCED-SIGNOUT (R526). EVERY ANSWER TO A REFRESH THAT IS NOT THE SERVER ENDING THE SESSION - "try later". Each is
 * what the phone meets while the server cannot apply its token rules: the page Next serves when Prisma throws (the
 * fifteen-second database restart of 2026-10-24), a proxy's 502/503/504, an edge's 429, a 200 that is not the pair, a
 * 401 that does not say invalid_refresh_token, and no answer at all - a timeout, no network (UrlConnectionTransport
 * wraps both as TransportException).
 */
private val TRY_LATER: List<Pair<String, RefreshFault>> =
    listOf(
        "500, the page Next serves when Prisma throws" to
            RefreshFault.Answer(HttpResponse(500, "<!DOCTYPE html><html><body>Internal Server Error</body></html>")),
        "502 from the proxy, no body" to RefreshFault.Answer(HttpResponse(502, "")),
        "503 from the proxy" to RefreshFault.Answer(HttpResponse(503, "Service Unavailable")),
        "504 from the proxy" to RefreshFault.Answer(HttpResponse(504, "")),
        "429 at the edge" to RefreshFault.Answer(HttpResponse(429, "")),
        "200 whose body is not the pair" to RefreshFault.Answer(HttpResponse(200, "<html>portal</html>")),
        "401 whose body does not parse" to RefreshFault.Answer(HttpResponse(401, "<html>Unauthorized</html>")),
        "a timeout" to RefreshFault.Unreachable(SocketTimeoutException("Read timed out")),
        "no network" to RefreshFault.Unreachable(ConnectException("Failed to connect to /127.0.0.1:3000")),
    )

/** R526: one way the server ends a session, produced by its own rule on TokenServer - never by a scripted status. */
private class Ending(
    val what: String,
    val end: suspend (Device) -> Unit,
)

/**
 * AN-FORCED-SIGNOUT (R526). EVERY ANSWER THAT IS THE SERVER ENDING THE SESSION: refresh/route.ts's ONE refusal, 401
 * invalid_refresh_token, whatever made the refresh token unusable; and bearer.ts's revoked_session and unknown_token at
 * any other door.
 */
private val SESSION_OVER: List<Ending> =
    listOf(
        Ending("refresh 401 invalid_refresh_token - the refresh token expired") { device ->
            device.server.expireAccess(device.firstPair)
            device.server.expireRefresh(device.firstPair)
        },
        Ending("refresh 401 invalid_refresh_token - the refresh token replayed (TOKEN_REPLAYED)") { device ->
            device.anotherHolderRotatesFirst()
        },
        Ending("refresh 401 invalid_refresh_token - a refresh token the server does not hold") { device ->
            device.server.expireAccess(device.firstPair)
            device.tokens.save(device.firstPair.copy(refreshToken = "refresh-the-server-never-issued"))
        },
        Ending("bearer 401 revoked_session - every session revoked from another device") { device ->
            AuthApi(device.server, TOKEN_SERVER_BASE)
                .authenticatedPost("/api/v1/auth/revoke-all", "{}", device.server.openSession(EMAIL_A).accessToken)
        },
        Ending("bearer 401 unknown_token - the account deleted (the cascade destroys the tokens)") { device ->
            device.server.deleteAccount(EMAIL_A)
        },
    )

/** R526: a table row's failure, NAMED - so a RED run lists every row that failed, not only the first. */
private suspend fun failureOf(
    what: String,
    row: suspend () -> Unit,
): String? =
    try {
        row()
        null
    } catch (e: AssertionError) {
        "$what -> ${e.message}"
    }

/**
 * R526: one TRY LATER row, on a fresh device. The worker's drain meets an expired access token, so it refreshes, and
 * the refresh meets [fault]. The person stays signed in with nothing cleared and the drain asks for the existing
 * backoff (Retryable, which SyncWorker maps to retry() - SyncWorkerResultMappingTest); then the server answers again,
 * and the backoff's next run refreshes with the SAME token and sends the day - the positive control that the session
 * the phone kept is one that still works.
 */
private suspend fun TestScope.assertTriesLater(fault: RefreshFault) {
    val device = Device(this)
    val shell = Shell(this, device)
    try {
        device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
        val held = device.heldMutation()
        device.server.expireAccess(device.firstPair)
        device.server.refreshFault = fault
        val before = device.server.requests.size

        device.drain() shouldBe SyncOutcome.Retryable
        advanceUntilIdle()

        // The entries POST, then ONE refresh - which never arrives when nothing answers.
        val refreshArrived = if (fault is RefreshFault.Answer) listOf("POST /api/v1/auth/refresh") else emptyList()
        device.server.requests.drop(before) shouldBe listOf("POST /api/v1/entries") + refreshArrived
        // STILL SIGNED IN - nothing cleared, nothing signalled, nothing revoked, the day held.
        device.tokens.load() shouldBe device.firstPair
        device.ends.ends.value shouldBe 0
        shell.destination shouldBe Destination.MAIN
        sessionClosedByServer(device.session.isSignedIn(), device.accounts.current()) shouldBe false
        device.settings.load() shouldBe SETTINGS
        device.cache.load(TAX_YEAR) shouldNotBe null
        device.exportsCleared shouldBe false
        device.detectionMode.load() shouldBe LoggingMode.AUTO_DETECT
        device.server.revocationOf(device.firstPair) shouldBe null
        device.dao.all().map { Triple(it.dayDate, it.syncState, it.accountTag) } shouldBe
            listOf(Triple(DAY, SyncState.PENDING, TAG_A))

        device.server.refreshFault = null
        device.drain() shouldBe SyncOutcome.Settled(written = 1, defects = 0)
        device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
        device.ends.ends.value shouldBe 0
    } finally {
        shell.close()
    }
}

/** R526: one SESSION OVER row, on a fresh device - the server ends the session [ending]'s way; R520's path follows. */
private suspend fun TestScope.assertSessionOver(ending: Ending) {
    val device = Device(this)
    val shell = Shell(this, device)
    try {
        device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
        ending.end(device)

        device.drain() shouldBe SyncOutcome.Unauthenticated
        advanceUntilIdle()

        assertTookTheForcedPath(device, shell)
    } finally {
        shell.close()
    }
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

    test("R521 - forced: the settings, the cached releve and the exports go; the days, their tag and the rest stay") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.cache.save(TAX_YEAR - 1, dossierBody("Camille Rey", TAX_YEAR - 1))
            device.pending.remember(EMAIL_A)
            // THE CONTROL: every one of them is there before.
            device.settings.load() shouldBe SETTINGS
            device.cache.load(TAX_YEAR) shouldNotBe null
            device.cache.load(TAX_YEAR - 1) shouldNotBe null

            device.anotherHolderRotatesFirst()
            device.drain() // the worker meets the replay: the server ends the session

            // CLEARED: what /me and the dossier GET bring back at the next sign-in, and the exports nothing reads back.
            device.settings.load() shouldBe null
            device.cache.load(TAX_YEAR) shouldBe null
            device.cache.load(TAX_YEAR - 1) shouldBe null
            device.exportsCleared shouldBe true
            device.tokens.load() shouldBe null
            // KEPT: the days and their tag (R509) - R295's record clear and the sync cancel never ran ...
            device.recordCleared shouldBe false
            device.syncCancelled shouldBe false
            device.accounts.current() shouldBe TAG_A
            device.dao.all().map { Triple(it.dayDate, it.syncState, it.accountTag) } shouldBe
                listOf(Triple(DAY, SyncState.PENDING, TAG_A))
            // ... and the pending sign-in, which is not account data. The detection file was a QUESTION here (Q1);
            // R527 answered it - cleared but for the employer figures - and the R527 tests below own that half. Its
            // mode is the one line kept here: this test used to assert the opposite, and it says so.
            device.detectionMode.load() shouldBe LoggingMode.MANUAL
            device.pending.pending() shouldBe EMAIL_A
            device.ends.ends.value shouldBe 1
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // R527 - THE DETECTION FILE, ANSWERED (Q1 -> (b), with one exception). A forced sign-out clears monreleve.detection
    // - the mode, the evening and alert opt-ins, the alert's crossing state, the near-border flag - EXCEPT the
    // employer figures, "employer.<accountTag>.<year>": their account's own, on this phone only, restored by nothing.
    // ---------------------------------------------------------------------------------------------------------

    test("R527 - forced: the mode, both opt-ins, the alert state and the near-border flag go; A's figures stay") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            // A's typed figures, and the keys they wrote read off the file - not typed here (R181).
            val withoutFigures = device.detectionFile.all.keys.toSet()
            device.employer.save(TAX_YEAR - 1, 41.25)
            device.employer.save(TAX_YEAR - 2, 38.0)
            val figureKeys = device.detectionFile.all.keys - withoutFigures
            // Every other flag the file holds, each written by the store that owns it.
            device.evening.setEnabled(true)
            device.evening.markNotified(DAY)
            device.alert.setEnabled(true)
            device.alert.saveCrossing(ThresholdCrossing(fiscal = true))
            device.alert.markAlerted(DAY, AlertThreshold.FISCAL)
            device.nearBorder.markShown()
            // THE CONTROL: all of it is there before - the two figures, and the flags beside them.
            figureKeys.size shouldBe 2
            (device.detectionFile.all.keys - figureKeys).size shouldBe 9
            device.detectionMode.load() shouldBe LoggingMode.AUTO_DETECT

            device.anotherHolderRotatesFirst()
            device.drain() // the worker meets the replay: the server ends the session

            device.ends.ends.value shouldBe 1
            // CLEARED: no detection consent outlives the session. The same person comes back in manual mode with
            // both notifications off.
            device.detectionMode.load() shouldBe LoggingMode.MANUAL
            device.evening.isEnabled() shouldBe false
            device.evening.lastNotifiedDay() shouldBe null
            device.alert.isEnabled() shouldBe false
            device.alert.crossing() shouldBe ThresholdCrossing()
            device.alert.activeThresholdToday(DAY) shouldBe null
            device.nearBorder.hasShown() shouldBe false
            // KEPT: A's figures, and NOTHING ELSE of the file - so a flag added to it later is cleared with the rest.
            device.detectionFile.all.keys shouldBe figureKeys
            device.employer.figureFor(TAX_YEAR - 1) shouldBe 41.25
            device.employer.figureFor(TAX_YEAR - 2) shouldBe 38.0
        }
    }

    test("R527 - ANOTHER account signs in after it: no previous mode, opt-in, crossing or figure; A's stay A's") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.employer.save(TAX_YEAR - 1, 41.25)
            device.evening.setEnabled(true)
            device.alert.setEnabled(true)
            device.alert.saveCrossing(ThresholdCrossing(fiscal = true, social = true))
            device.nearBorder.markShown()
            device.anotherHolderRotatesFirst()
            device.drain()

            val signIn = device.signInByCode(EMAIL_B, this)
            advanceUntilIdle()

            signIn.state.value.phase shouldBe CodePhase.SIGNED
            device.accounts.current() shouldBe TAG_B
            device.detectionMode.load() shouldBe LoggingMode.MANUAL
            device.evening.isEnabled() shouldBe false
            device.alert.isEnabled() shouldBe false
            device.alert.crossing() shouldBe ThresholdCrossing()
            device.nearBorder.hasShown() shouldBe false
            device.employer.figureFor(TAX_YEAR - 1) shouldBe null
            // THE CONTROL that B's null is the account scope and not an empty file: A's figure is on the phone still,
            // and reads back under A's tag.
            device.accounts.setCurrent(TAG_A)
            device.employer.figureFor(TAX_YEAR - 1) shouldBe 41.25
        }
    }

    test("R527 - the voluntary sign-out and the deletion still sweep the whole file, the figures included") {
        // R527 changes the forced scope only. The other direction (R196): both of R295/R289's wipes, over the same file
        // and the same stores, still leave nothing of it - the employer figures included.
        runTest {
            val signOut = Device(this)
            signOut.employer.save(TAX_YEAR - 1, 41.25)
            signOut.evening.setEnabled(true)
            signOut.detectionFile.all.size shouldBe 3
            signOut.deviceStore.clearForSignOut()
            signOut.detectionFile.all shouldBe emptyMap()

            val deletion = Device(this)
            deletion.employer.save(TAX_YEAR - 1, 41.25)
            deletion.evening.setEnabled(true)
            deletion.detectionFile.all.size shouldBe 3
            deletion.deviceStore.clearForDeletion()
            deletion.detectionFile.all shouldBe emptyMap()
        }
    }

    test("R521 - the SAME account signs back in: its settings come back from /me, its releve from the server") {
        runTest {
            val device = Device(this)
            device.server.holdSettings(EMAIL_A, meOf(SETTINGS))
            device.server.holdDossier(EMAIL_A, TAX_YEAR, dossierBody("Camille Rey"))
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            val held = device.heldMutation()
            device.anotherHolderRotatesFirst()
            device.drain()
            device.settings.load() shouldBe null

            val signIn = device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            // RESOLVING, as MainActivity runs it after a code sign-in, then the Releve's first load.
            val decision =
                decideStartAfterSignIn({ meFetchOf(device.session.authenticatedGet(ME_PATH)) }, device.settings)
            val releve = DossierApi(device.session::authenticatedGet, device.cache).fetch(TAX_YEAR)

            signIn.state.value.phase shouldBe CodePhase.SIGNED
            decision shouldBe StartDecision.Main
            device.settings.load() shouldBe SETTINGS
            releve.shouldBeInstanceOf<DossierResult.Loaded>().document.titulaire shouldBe "Camille Rey"
            device.cache.load(TAX_YEAR) shouldBe dossierBody("Camille Rey")
            // R509, unchanged: the held day went up with the sign-in.
            device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
        }
    }

    test("R521 - ANOTHER account signs in: none of the previous one's settings, and none of its releve") {
        runTest {
            val device = Device(this)
            val settingsB = Settings("VD", 80, "SIMPLIFIED240", null, "HALF_DAY", null, name = "Dominique Bovet")
            device.server.holdSettings(EMAIL_B, meOf(settingsB))
            device.server.holdDossier(EMAIL_B, TAX_YEAR, dossierBody("Dominique Bovet"))
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain()

            device.signInByCode(EMAIL_B, this)
            advanceUntilIdle()
            // OFFLINE before B's releve arrives: no copy at all - A's was cleared, so none is offered as B's (R288).
            DossierApi({ AuthedOutcome.NetworkError }, device.cache).fetch(TAX_YEAR) shouldBe DossierResult.NetworkError
            val decision =
                decideStartAfterSignIn({ meFetchOf(device.session.authenticatedGet(ME_PATH)) }, device.settings)
            val releve = DossierApi(device.session::authenticatedGet, device.cache).fetch(TAX_YEAR)

            decision shouldBe StartDecision.Main
            device.settings.load() shouldBe settingsB
            releve.shouldBeInstanceOf<DossierResult.Loaded>().document.titulaire shouldBe "Dominique Bovet"
            device.cache.load(TAX_YEAR) shouldBe dossierBody("Dominique Bovet")
        }
    }

    test("R521 - another account with NO settings on the server is onboarded - it never runs on the previous one's") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain()

            device.signInByCode(EMAIL_B, this)
            advanceUntilIdle()
            val decision =
                decideStartAfterSignIn({ meFetchOf(device.session.authenticatedGet(ME_PATH)) }, device.settings)

            decision.shouldBeInstanceOf<StartDecision.Onboard>()
            device.settings.load() shouldBe null
        }
    }

    test(
        "R521 - PARK-T2's link half: a sign-in BY LINK after a forced sign-out asks /me, never opens on old settings",
    ) {
        runTest {
            val device = Device(this)
            // THE CONTROL: on these settings a launch is MAIN - which is what the link's relaunch did with them.
            startDestination(device.session.isSignedIn(), device.settings.isOnboarded()) shouldBe Destination.MAIN
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain()
            startDestination(device.session.isSignedIn(), device.settings.isOnboarded()) shouldBe Destination.SIGN_IN

            device.signInByLink(EMAIL_B, this)
            advanceUntilIdle()

            // The link's relaunch: signed in, no settings on the phone - RESOLVING asks /me for B's own.
            startDestination(device.session.isSignedIn(), device.settings.isOnboarded()) shouldBe Destination.RESOLVING
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // R522 - THE OTHER ENDINGS. Each produced by the product's own rule on TokenServer, never by setting a field the
    // app reads; each reaches the phone through the call the worker makes; each takes R520's path.
    // ---------------------------------------------------------------------------------------------------------

    test("R522 - REVOKE-ALL from another device: the next call meets revoked_session, and R520's path follows") {
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            // Another device of the same account signs in and ends every session, through revoke-all/route.ts.
            val other = device.server.openSession(EMAIL_A)
            AuthApi(device.server, TOKEN_SERVER_BASE)
                .authenticatedPost("/api/v1/auth/revoke-all", "{}", other.accessToken)
                .shouldBeInstanceOf<AuthedResult.Ok<String>>()
            val before = device.server.requests.size

            device.drain()
            advanceUntilIdle()

            // One request, no refresh: revoked_session says the refresh token is dead too (bearer.ts).
            device.server.requests.drop(before) shouldBe listOf("POST /api/v1/entries")
            device.server.revocationOf(device.firstPair) shouldBe TokenServer.REVOKED_ALL
            device.server.revocationOf(other) shouldBe TokenServer.REVOKED_ALL
            assertTookTheForcedPath(device, shell)
            shell.close()
        }
    }

    test("R522 - a REFRESH THE SERVER REFUSES (the refresh token expired): R520's path, nothing revoked") {
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.server.expireAccess(device.firstPair)
            device.server.expireRefresh(device.firstPair)
            val before = device.server.requests.size

            device.drain()
            advanceUntilIdle()

            // expired_token -> one refresh -> the route's one refusal. The session was never revoked: it lapsed.
            device.server.requests.drop(before) shouldBe listOf("POST /api/v1/entries", "POST /api/v1/auth/refresh")
            device.server.revocationOf(device.firstPair) shouldBe null
            assertTookTheForcedPath(device, shell)
            shell.close()
        }
    }

    test("R522 - a 401 THE REFRESH CANNOT RECOVER (revoked between the rotation and the retry): R520's path") {
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.server.expireAccess(device.firstPair)
            device.server.revokeAfterNextRotation = TokenServer.REVOKED_ALL
            val before = device.server.requests.size

            device.drain()
            advanceUntilIdle()

            // The refresh SUCCEEDED and the retry was still refused - SessionManager.retryWith's 401.
            device.server.requests.drop(before) shouldBe
                listOf("POST /api/v1/entries", "POST /api/v1/auth/refresh", "POST /api/v1/entries")
            device.server.revocationOf(device.firstPair) shouldBe TokenServer.REVOKED_ALL
            assertTookTheForcedPath(device, shell)
            shell.close()
        }
    }

    test(
        "R522 - ACCOUNT DELETED elsewhere: today it takes R520's path too, because the phone cannot tell (a QUESTION)",
    ) {
        // PINNED AS FOUND, NOT AS DECIDED. Deletion requires the account's local data to be erased; this phone keeps
        // the deleted account's held day, because nothing it receives says "deleted" - and R210 forbids the server
        // telling an unauthenticated caller which case fired. REPORT-AN-FORCED-SIGNOUT.txt carries the options.
        runTest {
            val device = Device(this)
            val shell = Shell(this, device)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            val held = device.heldMutation()
            device.server.deleteAccount(EMAIL_A) // lib/account/delete.ts: the cascade destroys every token
            val before = device.server.requests.size

            device.drain()
            advanceUntilIdle()

            device.server.requests.drop(before) shouldBe listOf("POST /api/v1/entries")
            assertTookTheForcedPath(device, shell)

            // WHY THE PHONE CANNOT TELL. A deleted account's access token meets unknown_token ...
            val api = AuthApi(device.server, TOKEN_SERVER_BASE)
            api.authenticatedGet(ME_PATH, device.firstPair.accessToken) shouldBe
                AuthedResult.Unauthorized(AuthServerCode.UNKNOWN_TOKEN)
            // ... and so does a CORRUPTED stored token on an account that still exists (bearer.ts: unknown_token "also
            // fires for a corrupted stored token") - while the refresh route refuses both with its one answer.
            val live = device.server.openSession(EMAIL_B)
            api.authenticatedGet(ME_PATH, live.accessToken + "-corrupted") shouldBe
                AuthedResult.Unauthorized(AuthServerCode.UNKNOWN_TOKEN)
            api.refresh(device.firstPair.refreshToken) shouldBe RefreshResult.Invalid
            api.refresh(live.refreshToken + "-corrupted") shouldBe RefreshResult.Invalid

            // WHAT IT COSTS, as the code stands: the same address signing in again is a NEW account (code/route.ts
            // upserts the user), and the deleted account's held day goes up into it.
            device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            device.server.mutationsOf(EMAIL_A) shouldBe listOf(held)
            shell.close()
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // R523 - THE WORKER STOPS CLEANLY.
    // ---------------------------------------------------------------------------------------------------------

    test("R523 - the worker settles without retrying, asks the server nothing more, wipes nothing; the sign-in sends") {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.repository.record(RecordCommand(dayDate = OTHER_DAY, kind = EntryKind.CH))
            val held = device.dao.all().map { it.clientMutationId }.sorted()
            device.anotherHolderRotatesFirst()

            // The run that meets the ending: Unauthenticated - which SyncWorker maps to success(), never retry()
            // (SyncWorkerResultMappingTest pins that mapping; this pins the outcome it is given).
            device.drain() shouldBe SyncOutcome.Unauthenticated
            val afterTheEnding = device.server.requests.size
            // Every later run - WorkManager re-running the unique work, a new trigger - settles at once: no session, so
            // no request, no second ending, nothing cleared again.
            repeat(3) { device.drain() shouldBe SyncOutcome.Unauthenticated }
            device.server.requests.size shouldBe afterTheEnding
            device.ends.ends.value shouldBe 1
            // NOTHING WIPED: both days on the phone, PENDING, A's.
            device.recordCleared shouldBe false
            device.syncCancelled shouldBe false
            device.wipe.calls.filter { it in R295_WIPES } shouldBe emptyList()
            device.dao.all().map { it.syncState to it.accountTag } shouldBe
                listOf(SyncState.PENDING to TAG_A, SyncState.PENDING to TAG_A)

            // The same account signs in: both go up with the sign-in (R509).
            device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            device.server.mutationsOf(EMAIL_A).sorted() shouldBe held
            device.dao.all().map { it.syncState } shouldBe listOf(SyncState.SYNCED, SyncState.SYNCED)
        }
    }

    test(
        "R523 - the sign-in's send refused: the days wait, and the existing trigger - a day recorded - sends them all",
    ) {
        runTest {
            val device = Device(this)
            device.repository.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
            device.anotherHolderRotatesFirst()
            device.drain() shouldBe SyncOutcome.Unauthenticated
            device.server.refuseNextEntriesPost = true

            device.signInByCode(EMAIL_A, this)
            advanceUntilIdle()
            // The sign-in TRIED and was refused (PARK-T4): the day is still only on the phone.
            device.server.mutationsOf(EMAIL_A) shouldBe emptyList()
            device.dao.all().map { it.syncState } shouldBe listOf(SyncState.PENDING)

            // The existing trigger: recording a day enqueues the drain (SPEC 13.2), and the drain takes the account's
            // whole queue - the held day with the new one.
            device.repository.record(RecordCommand(dayDate = OTHER_DAY, kind = EntryKind.CH))
            device.drain() shouldBe SyncOutcome.Settled(written = 2, defects = 0)
            device.server.mutationsOf(EMAIL_A).size shouldBe 2
            device.dao.all().map { it.syncState } shouldBe listOf(SyncState.SYNCED, SyncState.SYNCED)
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

    // ---------------------------------------------------------------------------------------------------------
    // R526 - A FAILED REFRESH IS "TRY LATER" UNLESS THE SERVER SAID THE SESSION IS OVER. The server says it in ONE
    // answer on the refresh route (refresh/route.ts: 401 invalid_refresh_token) and in two codes at every other door
    // (bearer.ts: revoked_session, unknown_token). Anything else is the server unable to answer, not the server ending
    // the session - and the fifteen-second database restart of 2026-10-24 would otherwise have sent every phone
    // renewing its token in that window back to sign-in.
    // ---------------------------------------------------------------------------------------------------------

    test("R526 - TRY LATER: a refresh the server could not answer keeps the person signed in, and clears nothing") {
        runTest {
            TRY_LATER.mapNotNull { (what, fault) -> failureOf(what) { assertTriesLater(fault) } } shouldBe emptyList()
        }
    }

    test("R526 - SESSION OVER: the server's explicit refusals, and only those, still end it - R520's path") {
        runTest {
            SESSION_OVER.mapNotNull { ending -> failureOf(ending.what) { assertSessionOver(ending) } } shouldBe
                emptyList()
        }
    }

    test("R526 - FITS NEITHER LIST, a QUESTION: the refresh route's 400 malformed_body is kept, conservatively") {
        // PINNED AS DECIDED FOR NOW, NOT AS RULED. 400 malformed_body is the refresh route's only other refusal: the
        // body it was sent is not JSON - a defect in this client (docs/api-v1.md 1.4), not a statement about the
        // session, and not one of R526's try-later answers either. Ending the session on it would end it on a guess
        // (R529), so it is kept like a try-later answer until the operator rules. REPORT-AN-FORCED-SIGNOUT.txt asks.
        runTest {
            assertTriesLater(
                RefreshFault.Answer(
                    HttpResponse(400, """{"status":"error","code":"malformed_body","message":"Requete illisible"}"""),
                ),
            )
        }
    }
})
