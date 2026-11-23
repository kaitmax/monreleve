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
import ch.monreleve.app.data.sync.EntriesDownload
import ch.monreleve.app.data.sync.YearDownloadStatus
import ch.monreleve.app.data.sync.YearDownloads
import ch.monreleve.app.detection.applyServerLoggingMode
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.handleExportEvent
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.parametres.CommonParametresWire
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.ParametresWire
import ch.monreleve.app.parametres.Site
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.reminder.EveningReminderState
import ch.monreleve.app.reminder.eveningReminderPlan
import ch.monreleve.app.reminder.restoredEveningOptIn
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.startDestination
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import platform.Foundation.NSLock
import platform.Foundation.NSUserDefaults
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
// IOS-SHELL-2 (R1330-R1337) GAVE THE SHELL ITS FACILITIES:
//   - R1337: the evening opt-in and (R1334) the employer figures PERSIST, in iOS's detection file over NSUserDefaults
//     (IosDetectionStores.kt) - a relaunch rebuilds the graph from them and the plan still runs with the opt-in on;
//   - R1330: M4's re-plan runs on EVERY trigger in R1292's list - a foreground (onForeground), a day recorded, changed
//     or removed (the graph's requestSync), an opt-in written (ReplanningEveningStore: Parametres, onboarding,
//     RESOLVING's restore), a sign-in (the main shell opening) and the authorization granted (onAuthorizationAnswer);
//     each plan READS the authorization afresh (never a value cached before the centre answered), runs one at a time,
//     and is not applied if a session ended while it was computed (endings, below);
//   - R1332: a foreground drains the queue (onForeground - called from ONE place, IosShellRoot's lifecycle observer);
//   - R1331, R1333: exports go to the share sheet, the legal pages and the mail app open through UIApplication, and
//     every message Android shows as a Toast goes through the ONE notice seam (notices).
// IOS-SHELL-3 R1371 (iOS Ruling 15 Q2): THE YEAR DOWNLOADS - the common coordinator (YearDownloads, Android's
// processYearDownloads) over the session's GET, the record and iOS's transaction (IosYearDownloads.kt): after a
// sign-in both tax years (RESOLVING's afterSignIn), once per process the empty ones (the main shell opening), the
// person's retry; stopped on every ending through the session-end seam; and every year that lands re-plans the
// evening reminder, because a day it brings may be today, recorded on another phone.
// IOS-SHELL-3 R1372 (iOS Ruling 15 Q1): the employer comparison is the common overlay MainTabs draws, over
// employerStore.

/** Raised if the iOS composition is ever asked for the detection-consent body: detection is not in iOS v1. */
class DetectionNotInIosV1(
    enable: Boolean,
) : IllegalStateException("detection consent ($enable) is not part of iOS v1 (iOS Ruling 2)")

/**
 * iOS's counterpart of Android's detection file (monreleve.detection): the logging mode - always MANUAL on iOS v1 - the
 * evening opt-in with its last-notified day, and the employer figures, swept as that one file is (DetectionModeStore's
 * contract, R295/R527):
 *   - clear (a sign-out, a deletion): the mode, the evening opt-in and day, AND every employer figure;
 *   - clearForSessionEnd (a session the server ended): the mode and the evening opt-in and day, the employer figures
 *     KEPT (R527 - already their account's own, on this phone only, and brought back by nothing if erased).
 * So no ending leaves the opt-in on, and the next account on this phone inherits none of it (R303). The erases go to
 * the RAW stores, never through the re-plan (R1292: an ending needs no plan - the session-end seam removes every
 * pending request, and a plan launched mid-clear would read a half-cleared shell).
 */
internal class IosDetectionFile(
    private val eraseEvening: () -> Unit,
    private val eraseEmployerFigures: () -> Unit,
    private val mode: InMemoryDetectionModeStore = InMemoryDetectionModeStore(),
) : DetectionModeStore {
    override fun load(): LoggingMode = mode.load()

    override fun save(mode: LoggingMode) = this.mode.save(mode)

    override fun clear() {
        clearForSessionEnd()
        eraseEmployerFigures()
    }

    override fun clearForSessionEnd() {
        mode.clear()
        eraseEvening()
    }
}

/**
 * R1330: the evening store the shell's writers see - every opt-in WRITE (Parametres' switch once the server took it,
 * onboarding's answer, RESOLVING's restore at a sign-in) is followed by a re-plan, whatever it wrote, so a sign-in
 * that restores "off" over "off" still re-plans. Reads go straight through. The endings never write through this (see
 * IosDetectionFile).
 */
internal class ReplanningEveningStore(
    private val inner: EveningNotificationStore,
    private val replan: () -> Unit,
) : EveningNotificationStore by inner {
    override fun setEnabled(enabled: Boolean) {
        inner.setEnabled(enabled)
        replan()
    }
}

/** The count of session endings this process has seen - a plan computed across one is not applied (R1323). */
internal class SessionEndings {
    // Written by the session-end seam, read by the plan: on the app's main thread in production (MainScope, the
    // controllers' scope); a test that runs both elsewhere runs them one after the other.
    var count = 0
        private set

    fun ended() {
        count += 1
    }
}

/** The detection-consent member of the iOS Parametres wire: unreachable on iOS v1, and loud if reached. */
fun detectionConsentUnreachableOnIos(enable: Boolean): String = throw DetectionNotInIosV1(enable)

/**
 * The iOS process's shell: what MainActivity.onCreate builds on Android, built once (startIosShell). The two things
 * that read the clock - the graph and the reminder plan - are built inside startIosShell and handed in, so the
 * ExperimentalTime opt-in (R590) stays on that one function. The parameters ARE the device's stores and seams, as
 * DeviceLocalStore's own are; a holder would only move the list (IosLocalStores.kt's reasoning).
 */
@Suppress("LongParameterList", "TooManyFunctions")
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
    /** The evening opt-in as the shell's writers see it: each write re-plans (ReplanningEveningStore, R1330). */
    val eveningStore: EveningNotificationStore,
    /** R1334: the employer figures, persistent and account-tagged - read and written by the comparison (R1372). */
    val employerStore: EmployerFigureStore,
    val centre: IosNotificationCentre,
    val parametresWire: ParametresWire,
    val sessionEnds: SessionEnds,
    val appVersion: String,
    /** R28: the tax year is the Paris calendar year, not the device's - read at start, as onCreate reads it. */
    val taxYear: Int,
    /** Whether this app may notify, as last read from the centre (each plan reads it afresh, R1330). */
    val notificationsPermitted: MutableStateFlow<Boolean>,
    /** R1331: the ONE notice seam's iOS side - every message Android shows as a Toast. */
    val notices: IosNotices,
    /** R1330: a reminder tap waiting for the main shell to open Aujourd'hui. */
    val taps: IosNotificationTaps,
    /** R1371: the year downloads - the common coordinator - and the download it runs. */
    private val yearDownloads: YearDownloads,
    private val entriesDownload: EntriesDownload,
    /** R28 / R481: the current Paris tax year and the one before it, read from the shell's clock at each call. */
    private val taxYears: () -> List<Int>,
    private val urlOpener: IosUrlOpener,
    private val exportFiles: IosExportFiles,
    private val presentShare: (path: String) -> Unit,
    private val scope: CoroutineScope,
    private val planNow: suspend () -> Unit,
    private val graph: (CoroutineScope) -> MainControllers,
    /** IOS-AUDIT R1380: the session endings this process has seen - a restore held across one is dropped. */
    private val endingsSeen: () -> Int,
) {
    /** R1162 on iOS: detection is not in v1, so the server's mode always lands as MANUAL, nothing sampled. */
    fun restoreMode(serverMode: LoggingMode) {
        applyServerLoggingMode(serverMode, false, detectionModeStore, startSampling = {}, stopSampling = {})
    }

    /**
     * R1147: the evening opt-in the server holds, applied where this phone may notify (as last read - refreshed at
     * start and after every ask). SYNCHRONOUS on purpose: RESOLVING moves to MAIN at once, and the Parametres
     * controller reads the store ONCE when it is built (ParametresController's initial state) - a write that landed
     * after it would leave the switch showing the old value while the plan used the new one. The write goes through
     * [eveningStore], so it re-plans (R1330: "the opt-in restored at sign-in"); the plan itself reads the authorization
     * afresh.
     */
    fun restoreReminder(serverOn: Boolean) {
        // IOS-AUDIT R1380 (iOS Ruling 16 Q1): A RESTORE WITH NO ANSWER WRITES NOTHING. Before the centre has answered
        // "may this app notify" even once, notificationsPermitted is only its initial false - not an answer - and
        // IosShellRoot starts the router past its bound regardless. Reading that false wrote OFF over the server's ON
        // and, the settings then cached, nothing restored it before the next sign-in. So the restore is HELD - the
        // store left as it was - and applied by the first answer (answered), unless a session ended in between.
        restoreLock.lock()
        val answeredYet =
            try {
                if (!answeredOnce) heldRestore = HeldRestore(serverOn, endingsSeen())
                answeredOnce
            } finally {
                restoreLock.unlock()
            }
        if (answeredYet) eveningStore.setEnabled(restoredEveningOptIn(serverOn, notificationsPermitted.value))
    }

    /** R1380: a restore that came before the centre's first answer, and the endings count when it came. */
    private class HeldRestore(
        val serverOn: Boolean,
        val endingsAtRestore: Int,
    )

    // R1380: the centre answers on its own queue and RESOLVING restores on the main thread - one lock for the two.
    private val restoreLock = NSLock()
    private var answeredOnce = false
    private var heldRestore: HeldRestore? = null
    private val lateRestoreCount = MutableStateFlow(0)

    /**
     * R1380: how many held restores the first answer applied. The Paramètres controller reads the opt-in ONCE when it is
     * built, so a restore applied after it shows the switch nothing; the main shell mirrors the store into it on each.
     */
    val lateRestores: StateFlow<Int> = lateRestoreCount

    private val authorizationAnswered = MutableStateFlow(false)

    /**
     * IOS-SHELL-3 R1374 (iOS Ruling 15 Q6): true once the centre has answered "may this app notify" at least once -
     * the first read startIosShell asks, or any later one. Until then [notificationsPermitted] is only its initial
     * false, not an answer, so IosShellRoot holds the router back until this is true (bounded): RESOLVING's restore
     * then reads an ANSWER, and cannot write OFF over the server's ON because /me came back first.
     */
    val authorizationKnown: StateFlow<Boolean> = authorizationAnswered

    private val foregroundCount = MutableStateFlow(0)

    /** IOS-SHELL-3 R1373 (a): the foregrounds this process has seen - the main shell refreshes Aujourd'hui on each. */
    val foregrounds: StateFlow<Int> = foregroundCount

    /** One answer from the centre, kept: the permission, and that it has been answered (R1374). */
    private fun answered(permitted: Boolean) {
        notificationsPermitted.value = permitted
        restoreLock.lock()
        val held =
            try {
                answeredOnce = true
                heldRestore.also { heldRestore = null }
            } finally {
                restoreLock.unlock()
            }
        // R1380: the held restore lands now, with this ANSWER - unless a session ended since (it was the old one's).
        if (held != null && held.endingsAtRestore == endingsSeen()) {
            eveningStore.setEnabled(restoredEveningOptIn(held.serverOn, permitted))
            lateRestoreCount.update { it + 1 }
        }
        authorizationAnswered.value = true
    }

    /** Re-reads the authorization into [notificationsPermitted]. */
    fun refreshAuthorization() {
        centre.readAuthorization(::answered)
    }

    /** The centre's answer to "may this app notify", awaited - and kept in [notificationsPermitted]. */
    private suspend fun readAuthorization(): Boolean {
        val permitted = suspendCoroutine { done -> centre.readAuthorization { done.resume(it) } }
        answered(permitted)
        return permitted
    }

    /** M4's re-plan over the facts now (R1291), awaited - for a caller that must know it has been applied. */
    suspend fun replanReminders() = planNow()

    /** R1330: a re-plan, launched - every trigger's one call. Plans run one at a time (startIosShell's lock). */
    fun replanSoon() {
        scope.launch { planNow() }
    }

    /**
     * R1330 / R1332: the app came to the foreground. ONE call for what a foreground does on iOS - the queue drained
     * (requestDrain; BGTaskScheduler is device-only, PARK-IF1), the reminders re-planned and (R1373 a) Aujourd'hui told
     * to recompute today. Called from ONE place: IosShellRoot's lifecycle observer (ON_RESUME).
     */
    fun onForeground() {
        syncTrigger.requestDrain()
        replanSoon()
        // R1373 (a), Android's F8: Aujourd'hui recomputes today from the clock - the midnight case (IosMainShell).
        foregroundCount.update { it + 1 }
    }

    /** R1330: the person answered the authorization prompt; a grant re-plans ("authorization granted"). */
    fun onAuthorizationAnswer(granted: Boolean) {
        answered(granted)
        if (granted) replanSoon()
    }

    /** The facts the plan reads now (R1291) - all but the clock, which startIosShell holds. */
    internal suspend fun reminderState(): EveningReminderState {
        val permitted = readAuthorization()
        val delivered = suspendCoroutine { done -> centre.deliveredIdentifiers { done.resume(it) } }
        val recorded =
            repository.observeAll().first().mapNotNull { runCatching { LocalDate.parse(it.dayDate) }.getOrNull() }
        return EveningReminderState(
            signedIn = session.isSignedIn(),
            optedIn = eveningStore.isEnabled(),
            notificationsPermitted = permitted,
            recordedDays = recorded.toSet(),
            notifiedDays = deliveredEveningReminderDays(delivered),
        )
    }

    /** R1333 / R299: a legal page in the browser; no app to open it -> the address, said through the notice seam. */
    fun openLegal(page: LegalPage) {
        val url = Site.url(page)
        urlOpener.open(url) { opened -> if (!opened) notices.show(ParametresCopy.legalNoHandler(url)) }
    }

    /**
     * R1333 (iOS Ruling 3 Q5): « Ouvrir ma messagerie » as message:// - or NULL, so the code screen hides the button,
     * when nothing on this phone can open it. If the open still fails, R299's fallback says so.
     */
    fun mailAction(): (() -> Unit)? =
        if (urlOpener.canOpen(MAIL_APP_URL)) {
            { urlOpener.open(MAIL_APP_URL) { opened -> if (!opened) notices.show(CodeCopy.NO_MAIL_APP) } }
        } else {
            null
        }

    /**
     * R1331 (G5): an export event, through the common hand-off (handleExportEvent): a Ready file written where the
     * erasure deletes (IosExportFiles) and handed to the share sheet; a failure said through the notice seam. A file
     * that cannot be written is never shared empty - it is said as the export failing.
     */
    fun handleExport(event: ExportEvent) {
        handleExportEvent(
            event,
            share = { ready ->
                val path = runCatching { exportFiles.write(ready) }.getOrNull()
                if (path == null) notices.show(ReleveCopy.EXPORT_FAILED) else presentShare(path)
            },
            notices = notices,
        )
    }

    /** R1371 / R484: what the year downloads tell the screen - Aujourd'hui's failure notice and its retry. */
    val yearDownloadStatus: StateFlow<YearDownloadStatus> get() = yearDownloads.status

    /** R1371 / R481: after a sign-in (RESOLVING's afterSignIn), both tax years, whatever the phone holds. */
    fun downloadYearsAfterSignIn() = yearDownloads.afterSignIn(entriesDownload, taxYears())

    /** R1371 / R485: the signed-in shell opened - once per process, the years with no row on this phone. */
    fun downloadYearsAtStart() = yearDownloads.atStart(entriesDownload, taxYears())

    /** R1371 / R484: the person's « Réessayer » - the years that failed, again. */
    fun retryYearDownloads() = yearDownloads.retry(entriesDownload)

    /**
     * THE ONE GRAPH (R291), built through the common MainGraph.build when MAIN composes - the same function Android's
     * rememberMainControllers calls, with iOS's seams. No saved-state snapshots: a ComposeUIViewController is not
     * rebuilt on rotation and iOS has no process-death restore (REPORT-IOS-HOST-CENSUS, "rememberSaveable").
     */
    fun buildControllers(scope: CoroutineScope): MainControllers = graph(scope)
}

private const val PARIS = "Europe/Paris"

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
    // IOS-SHELL-2 R1337/R1334: the detection file's home - the evening opt-in and the employer figures persist here.
    detectionDefaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
    urlOpener: IosUrlOpener = SystemUrlOpener(),
    presentShare: (path: String) -> Unit = ::presentShareSheet,
    taps: IosNotificationTaps = processNotificationTaps,
    consentBody: (Boolean) -> String = ::detectionConsentUnreachableOnIos,
    reportUnowned: (String) -> Unit = { IosUnownedReporter().report(it) },
    log: (String) -> Unit = ::consoleLine,
    sessionEnds: SessionEnds = processSessionEnds,
    // IOS-AUDIT R1381: the session-end seam stops the year downloads THROUGH this - production runs the stop as is; a
    // test passes a recorder that runs it too, so the wire from the seam to the coordinator is observable.
    yearDownloadStop: (stop: () -> Unit) -> Unit = { it() },
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

    // 3. The record, the device's LocalStore through iOS's seam, the drain and its trigger. The detection file's two
    //    persistent stores are erased RAW on the endings (IosDetectionFile); the writers get the re-planning view.
    var shell: IosShell? = null
    val db = database()
    val eveningFile = UserDefaultsEveningNotificationStore(detectionDefaults)
    val employerStore = UserDefaultsEmployerFigureStore(detectionDefaults) { accountStore.current() }
    val detectionModeStore =
        IosDetectionFile(eraseEvening = eveningFile::erase, eraseEmployerFigures = employerStore::erase)
    val eveningStore = ReplanningEveningStore(eveningFile) { shell?.replanSoon() }
    val endings = SessionEndings()
    // R1371: the year downloads - the common coordinator (counts and years only in its log, never a day), over the
    // session's GET, the record and iOS's transaction. Each year that lands re-plans: it may hold today, recorded on
    // another phone, and the evening reminder must not ask about a day already in the record.
    val yearDownloads = YearDownloads(scope) { line -> log("I/YearDownload: $line") }
    val yearTransaction = iosEntriesTransaction(db)
    val entriesDownload =
        EntriesDownload(
            dao = db.entryDao(),
            get = session::authenticatedGet,
            currentAccount = { accountStore.current() },
            inTransaction = { write ->
                yearTransaction(write)
                checkNotNull(shell).replanSoon()
            },
        )
    val drain = iosSyncDrain(db.entryDao(), session, accountStore, dossierCache)
    val syncTrigger = IosSyncTrigger(scope, drain)
    val files = exportFiles()
    val localStore =
        iosDeviceLocalStore(
            database = db,
            syncTrigger = syncTrigger,
            exportFiles = files,
            detectionModeStore = detectionModeStore,
            tokenStore = tokenStore,
            settingsStore = settingsStore,
            dossierCache = dossierCache,
            pendingSignIn = pending,
            accountStore = accountStore,
            sessionEndSeam =
                iosSessionEndSeam(
                    removePendingRequests = {
                        endings.ended()
                        centre.removeAllPending()
                    },
                    // R1371: a year still arriving is stopped BEFORE the record is cleared, on every ending.
                    // IOS-AUDIT R1381: through yearDownloadStop, which production runs as is and a test records.
                    stopYearDownloads = { yearDownloadStop(yearDownloads::stop) },
                ),
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
            // R1330: every day-writer calls this after a write that recorded, changed or removed a day (SPEC 13.2,
            // MainGraphDayWriterCensusTest) - so it is where "every entry recorded, changed or removed on the phone"
            // re-plans, beside the drain it always asked for.
            requestSync = {
                syncTrigger.afterWrite()
                checkNotNull(shell).replanSoon()
            },
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
    // M4's re-plan (R1291) over the facts now, at this clock's instant in the device's zone. One at a time (the lock),
    // and NOT APPLIED if a session ended while it was computed: the seam has already removed every request, and a plan
    // read from the signed-in state must not put them back (R1323's zero after a sign-out).
    val planLock = Mutex()
    val planNow: suspend () -> Unit = {
        planLock.withLock {
            val before = endings.count
            val state = checkNotNull(shell).reminderState()
            if (endings.count == before) replanEveningReminders(eveningReminderPlan(clock.now(), zone, state), centre)
        }
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
        employerStore = employerStore,
        centre = centre,
        parametresWire = parametresWire,
        sessionEnds = sessionEnds,
        appVersion = appVersion,
        taxYear = clock.now().toLocalDateTime(TimeZone.of(PARIS)).year,
        notificationsPermitted = MutableStateFlow(false),
        notices = IosNotices(scope),
        taps = taps,
        yearDownloads = yearDownloads,
        entriesDownload = entriesDownload,
        taxYears = {
            val year = clock.now().toLocalDateTime(TimeZone.of(PARIS)).year
            listOf(year, year - 1)
        },
        urlOpener = urlOpener,
        exportFiles = files,
        presentShare = presentShare,
        scope = scope,
        planNow = planNow,
        graph = graph,
        endingsSeen = { endings.count },
    ).also {
        shell = it
        it.refreshAuthorization()
    }
}
