package ch.monreleve.app.ios

import ch.monreleve.app.Destination
import ch.monreleve.app.MainControllers
import ch.monreleve.app.MainGraph
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEndingStore
import ch.monreleve.app.auth.SessionEnds
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.auth.onServerEndedSession
import ch.monreleve.app.auth.processSessionEnds
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.LocalRhythmRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.detection.applyServerLoggingMode
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.CommonParametresWire
import ch.monreleve.app.parametres.ParametresWire
import ch.monreleve.app.reminder.EveningReminderState
import ch.monreleve.app.reminder.eveningReminderPlan
import ch.monreleve.app.reminder.restoredEveningOptIn
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.startDestination
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import platform.Foundation.NSLog
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// IOS-SHELL-1 (R1320-R1325, R1329). THE iOS COMPOSITION ROOT - what MainActivity.onCreate is on Android: the stores,
// the session, the repositories and the seams, built ONCE PER PROCESS (MonReleveViewController.kt holds the one
// instance) by ONE function, startIosShell, in this order:
//   1. THE FIRST-LAUNCH CLEAR (R1321, iOS Ruling 2 C8 Q2): before the session exists or anything reads isSignedIn().
//   2. The session, whose server-ended path (R520/R521) clears through iOS's "session ended" seam (M3's
//      iosSessionEndSeam over THIS shell's notification centre - so every ending path removes the pending reminder
//      requests M4 plans, R1323), exactly as Android's processSession clears through its own.
//   3. The device's LocalStore (iosDeviceLocalStore - the ONE construction, SessionEndSeamFenceTest), the record, the
//      rhythm, the releve and the in-process sync trigger (IosSyncTrigger).
//   4. The start destination - startDestination over the stores, as onCreate computes it.
// The controllers are built by the COMMON graph (MainGraph.build, R291) when MAIN composes - buildControllers below -
// with the common Parametres wire (R1329; the detection-consent member refuses, because iOS v1 is manual-only).
//
// NOTHING HERE TOUCHES A PLATFORM SERVICE WHILE IT IS BUILT: every store, the transport, the database, the marker and
// the notification centre are PARAMETERS with production defaults, so the iosTests (a process with no app bundle,
// AppHostProbeIosTest's header) drive this very function with doubles. Swift passes the API base URL (Info.plist's
// MonReleveApiBaseUrl - ONE build setting, never a literal in code, R206) and the version line (R894).
//
// iOS RULING 3 Q3 - THE UPDATE GATE IS OUT ON iOS: nothing here, and nothing ShellRouter reaches, asks
// /api/v1/android/minimum-version (IosShellStartupIosTest proves it against a recording transport).
//
// NAMED STUBS, IOS-SHELL-2's (R1320's "stub it visibly"): the legal pages and message:// (G7) are logged and not
// opened; the year downloads (Android's processYearDownloads) are not run; the evening opt-in is held in memory
// (InMemoryEveningNotificationStore) until IOS-SHELL-2 gives it a persistent home with the foreground re-plan.

/** Raised if the iOS composition is ever asked for the detection-consent body: detection is not in iOS v1. */
class DetectionNotInIosV1(
    enable: Boolean,
) : IllegalStateException("detection consent ($enable) is not part of iOS v1 (iOS Ruling 2)")

/**
 * iOS's counterpart of Android's detection file (monreleve.detection): the logging mode - always MANUAL on iOS v1 - AND
 * the evening opt-in, cleared TOGETHER, as that one file is (DetectionModeStore's contract: clear and
 * clearForSessionEnd erase "the evening and alert opt-ins" with the mode, R295/R527). So every ending path the device's
 * LocalStore runs - sign-out, deletion, a server-ended session - leaves the opt-in off, and the next account on this
 * phone does not inherit it (R303). The opt-in itself is still held in memory until IOS-SHELL-2 persists it.
 */
internal class IosDetectionFile(
    private val evening: EveningNotificationStore,
    private val mode: InMemoryDetectionModeStore = InMemoryDetectionModeStore(),
) : DetectionModeStore {
    override fun load(): LoggingMode = mode.load()

    override fun save(mode: LoggingMode) = this.mode.save(mode)

    override fun clear() {
        mode.clear()
        evening.setEnabled(false)
    }

    override fun clearForSessionEnd() = clear()
}

/** The detection-consent member of the iOS Parametres wire: unreachable on iOS v1, and loud if reached. */
fun detectionConsentUnreachableOnIos(enable: Boolean): String = throw DetectionNotInIosV1(enable)

/**
 * The iOS process's shell: what MainActivity.onCreate builds on Android, built once (startIosShell). The two things
 * that read the clock - the graph and the reminder plan - are built inside startIosShell and handed in, so the
 * ExperimentalTime opt-in (R590) stays on that one function. The parameters ARE the device's stores and seams, as
 * DeviceLocalStore's own are; a holder would only move the list (IosLocalStores.kt's reasoning).
 */
@Suppress("LongParameterList")
class IosShell internal constructor(
    val start: Destination,
    val api: AuthApi,
    val session: SessionManager,
    val tokenStore: TokenStore,
    val pending: PendingSignInStore,
    val accountStore: AccountStore,
    val settingsStore: SettingsStore,
    val repository: EntryRepository,
    val rhythmRepository: RhythmRepository,
    val localStore: SessionEndingStore,
    val dossierApi: DossierApi,
    val syncTrigger: IosSyncTrigger,
    val syncNow: suspend () -> Unit,
    val detectionModeStore: DetectionModeStore,
    val eveningStore: EveningNotificationStore,
    val centre: IosNotificationCentre,
    val parametresWire: ParametresWire,
    val sessionEnds: SessionEnds,
    val appVersion: String,
    /** R28: the tax year is the Paris calendar year, not the device's - read at start, as onCreate reads it. */
    val taxYear: Int,
    /** Whether this app may notify, as last read from the centre (refreshed at start and after each ask). */
    val notificationsPermitted: MutableStateFlow<Boolean>,
    private val planNow: suspend () -> Unit,
    private val graph: (CoroutineScope) -> MainControllers,
    private val log: (String) -> Unit,
) {
    /** R1162 on iOS: detection is not in v1, so the server's mode always lands as MANUAL, nothing sampled. */
    fun restoreMode(serverMode: LoggingMode) {
        applyServerLoggingMode(serverMode, false, detectionModeStore, startSampling = {}, stopSampling = {})
    }

    /** R1147: the evening opt-in the server holds, applied where this phone may notify. */
    fun restoreReminder(serverOn: Boolean) {
        eveningStore.setEnabled(restoredEveningOptIn(serverOn, notificationsPermitted.value))
    }

    /** Re-reads the authorization into [notificationsPermitted]. */
    fun refreshAuthorization() {
        centre.readAuthorization { notificationsPermitted.value = it }
    }

    /**
     * M4's re-plan over the facts now (R1291): signed in, opted in, permitted, the days recorded on this phone and the
     * days already reminded (the delivered list, iOS Ruling 2). IOS-SHELL-1 calls it from onboarding's reminder answer
     * (R1325); the other triggers - every foreground, every day recorded - are IOS-SHELL-2's.
     */
    suspend fun replanReminders() = planNow()

    /** The facts the plan reads now (R1291) - all but the clock, which startIosShell holds. */
    internal suspend fun reminderState(): EveningReminderState {
        val delivered = suspendCoroutine { done -> centre.deliveredIdentifiers { done.resume(it) } }
        val recorded =
            repository.observeAll().first().mapNotNull { runCatching { LocalDate.parse(it.dayDate) }.getOrNull() }
        return EveningReminderState(
            signedIn = session.isSignedIn(),
            optedIn = eveningStore.isEnabled(),
            notificationsPermitted = notificationsPermitted.value,
            recordedDays = recorded.toSet(),
            notifiedDays = deliveredEveningReminderDays(delivered),
        )
    }

    /** NAMED STUB (IOS-SHELL-2, G7): a legal page or the mail app, logged and not opened. */
    fun notYetOnIos(what: String) {
        log("I/$TAG: IOS-SHELL-2 owes: $what")
    }

    /**
     * THE ONE GRAPH (R291), built through the common MainGraph.build when MAIN composes - the same function Android's
     * rememberMainControllers calls, with iOS's seams. No saved-state snapshots: a ComposeUIViewController is not
     * rebuilt on rotation and iOS has no process-death restore (REPORT-IOS-HOST-CENSUS, "rememberSaveable").
     */
    fun buildControllers(scope: CoroutineScope): MainControllers = graph(scope)

    private companion object {
        const val TAG = "IosShell"
    }
}

private const val PARIS = "Europe/Paris"

/**
 * One line to the console, scrubbed as IosLogger scrubs (R574), and passed to NSLog as its FORMAT with every % doubled
 * -
 * never as a C vararg. IOS-SHELL-1's run B (ios-shared 45019964025) ended in SIGSEGV in the first test that reached a
 * shell log line, which went through IosLogger's default sink, NSLog("%@", line): a Kotlin String handed to a C
 * variadic function as an Objective-C object. That sink is not this task's to change (NOTICED in the report); this
 * line avoids the vararg altogether.
 */
private fun consoleLine(line: String) {
    NSLog(scrub(line).replace("%", "%%"))
}

/**
 * THE iOS COMPOSITION FUNCTION (R1323): builds the process's shell in the header's order. Every parameter after the two
 * Swift passes is a production default a test replaces.
 */
@Suppress("LongParameterList", "LongMethod")
@OptIn(ExperimentalTime::class) // KMP-DT R590: the kotlin.time.Clock seam - on the allowlist.
fun startIosShell(
    apiBaseUrl: String,
    appVersion: String,
    transport: HttpTransport = NsUrlSessionTransport(),
    tokenStore: TokenStore = KeychainTokenStore(),
    pending: PendingSignInStore = KeychainPendingSignInStore(),
    accountStore: AccountStore = KeychainAccountStore(),
    settingsStore: SettingsStore = UserDefaultsSettingsStore(),
    dossierCache: DossierCache = FileDossierCache(),
    marker: FirstLaunchMarker = UserDefaultsFirstLaunchMarker(),
    database: () -> MonReleveDatabase = { buildIosDatabase() },
    exportFiles: () -> IosExportFiles = { IosExportFiles() },
    centre: IosNotificationCentre = SystemNotificationCentre(),
    eveningStore: EveningNotificationStore = InMemoryEveningNotificationStore(),
    consentBody: (Boolean) -> String = ::detectionConsentUnreachableOnIos,
    reportUnowned: (String) -> Unit = { IosUnownedReporter().report(it) },
    log: (String) -> Unit = ::consoleLine,
    sessionEnds: SessionEnds = processSessionEnds,
    scope: CoroutineScope = MainScope(),
    clock: Clock = Clock.System,
    zone: TimeZone = TimeZone.currentSystemDefault(),
): IosShell {
    // 1. R1321: the first-launch clear, BEFORE the session exists or anything reads isSignedIn().
    clearKeychainOnFirstLaunch(marker, tokenStore, pending, accountStore)

    // 2. The session. Its server-ended path clears through the store built in 3 (late-bound: each needs the other).
    val api = AuthApi(transport, apiBaseUrl)
    var endingStore: SessionEndingStore? = null
    val session =
        SessionManager(api, tokenStore, onEnded = { onServerEndedSession(checkNotNull(endingStore), sessionEnds) })

    // 3. The record, the device's LocalStore through iOS's seam, the drain and its trigger.
    val db = database()
    val detectionModeStore = IosDetectionFile(eveningStore)
    val drain = iosSyncDrain(db.entryDao(), session, accountStore, dossierCache)
    val syncTrigger = IosSyncTrigger(scope, drain)
    val localStore =
        iosDeviceLocalStore(
            database = db,
            syncTrigger = syncTrigger,
            exportFiles = exportFiles(),
            detectionModeStore = detectionModeStore,
            tokenStore = tokenStore,
            settingsStore = settingsStore,
            dossierCache = dossierCache,
            pendingSignIn = pending,
            accountStore = accountStore,
            sessionEndSeam = iosSessionEndSeam(removePendingRequests = { centre.removeAllPending() }),
        )
    endingStore = localStore
    val repository =
        LocalEntryRepository(
            dao = db.entryDao(),
            clock = clock,
            deviceZone = zone,
            // AN-ACCOUNT-TAG (R423): read live, never captured - signing in by code sets it without a restart.
            currentAccount = { accountStore.current() },
            isSignedIn = { accountStore.current() != null },
            reportUnownedWhileSignedIn = reportUnowned,
            newMutationId = ::newIosMutationId,
        )

    // 4. Where the person starts - read only now, after the clear (R1321).
    val start = startDestination(signedIn = session.isSignedIn(), onboarded = settingsStore.isOnboarded())
    val rhythmRepository = LocalRhythmRepository(db.rhythmDao()) { accountStore.current() }
    val dossierApi = DossierApi(session::authenticatedGet, dossierCache)
    val syncNow: suspend () -> Unit = { drain() }
    val parametresWire = CommonParametresWire(consentBody = consentBody)
    var shell: IosShell? = null
    // THE ONE GRAPH (R291): MainGraph.build - the function Android's rememberMainControllers calls - with iOS's seams.
    val graph: (CoroutineScope) -> MainControllers = { controllersScope ->
        MainGraph.build(
            repository = repository,
            rhythmRepository = rhythmRepository,
            settingsStore = settingsStore,
            taxYear = clock.now().toLocalDateTime(TimeZone.of(PARIS)).year,
            clock = clock,
            deviceZone = zone,
            scope = controllersScope,
            requestSync = { syncTrigger.afterWrite() },
            dossierFetch = dossierApi::fetch,
            dossierStaleCopy = dossierApi::staleCopy,
            exportBytes = session::authenticatedGetBytes,
            settingsSaver = SessionSettingsSaver(session),
            revokeServer = session::revokeServerSession,
            localStore = localStore,
            authenticatedPost = session::authenticatedPost,
            syncNow = syncNow,
            parametresWire = parametresWire,
            detectionModeStore = detectionModeStore,
            eveningNotificationStore = eveningStore,
        )
    }
    // M4's re-plan (R1291) over the facts now, at this clock's instant in the device's zone.
    val planNow: suspend () -> Unit = {
        val state = checkNotNull(shell).reminderState()
        replanEveningReminders(eveningReminderPlan(clock.now(), zone, state), centre)
    }
    return IosShell(
        start = start,
        api = api,
        session = session,
        tokenStore = tokenStore,
        pending = pending,
        accountStore = accountStore,
        settingsStore = settingsStore,
        repository = repository,
        rhythmRepository = rhythmRepository,
        localStore = localStore,
        dossierApi = dossierApi,
        syncTrigger = syncTrigger,
        syncNow = syncNow,
        detectionModeStore = detectionModeStore,
        eveningStore = eveningStore,
        centre = centre,
        parametresWire = parametresWire,
        sessionEnds = sessionEnds,
        appVersion = appVersion,
        taxYear = clock.now().toLocalDateTime(TimeZone.of(PARIS)).year,
        notificationsPermitted = MutableStateFlow(false),
        planNow = planNow,
        graph = graph,
        log = log,
    ).also {
        shell = it
        it.refreshAuthorization()
    }
}
