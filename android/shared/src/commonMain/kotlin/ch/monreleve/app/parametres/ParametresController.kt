package ch.monreleve.app.parametres

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.ValidationError
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.onboarding.isIsoDay
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.InMemoryThresholdAlertStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.ThresholdAlertStore
import ch.monreleve.app.settings.toAggregatableUser
import ch.monreleve.app.shared.PlatformSerializable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

// AN12 increment 1 (SPEC 11.5, R290). The settings screen's state holder. Lives OUTSIDE ui/ (fence 5): it
// holds the /api/v1/me PATCH seam (the same SettingsSaver onboarding uses), the local store, and the entry
// repository (for R290's before-and-after). The screen reads a plain ParametresState and calls these
// setters; it never sees a PostOutcome or a Settings.
//
// R290 - A CHANGE THAT MOVES THE YEAR'S RATE SAYS SO BEFORE IT SAVES. save() computes the declarable rate
// as it is (from the STORED settings) and as the edited settings would make it, both over the device's own
// entries (deviceDeclarableRate - the same engine path Aujourd'hui takes, R206). When the two differ it does
// NOT save: it exposes a pendingRateChange the screen shows, and only confirmSave() commits. When they are
// equal - or the year has no entries to move - it saves directly. AC1 exactly: the person sees the most
// consequential single tap's effect before the tap lands. A change the recorded days cannot support (a
// granularity switch against half-day rows) is refused, never read as "nothing moved".
//
// R282 - the six manual fields and nothing else. No mode chooser, no reminder step, no consent toggle: the
// same subset onboarding sets. VALIDATION HAS NO THIRD COPY OF THE RULE (R196): the 1-100 bound and the
// exact-total-iff live in the engine and the database; this runs calculateTelework and accepts iff the
// engine does, exactly as OnboardingController does.
//
// IOS-2e R826: the four org.json sites - the PATCH /me body, the detection-consent body, the delete body and the
// delete receipt's parse - are reached through `wire` (ParametresWire), handed in by :app's factory of this class's
// name (OrgJsonParametres.kt), so this file holds no JSON code. The bodies and the parse are unchanged, pinned
// byte-exact by ParametresWirePinTest before and after.
//
// IOS-2e R829: this file moved to :shared commonMain, package unchanged, with ParametresWire, DeviceRate and LegalPage.
// The one platform type it held - ParametresSnapshot's java.io.Serializable - is PlatformSerializable (Android's actual
// typealias IS java.io.Serializable; serialVersionUID 1L kept, so the same Bundle bytes - measured). Its tests: the
// Kotest specs stay in :app through OrgJsonParametres.kt's factory; ParametresControllerPinTest and
// ParametresStartDatePinTest moved to commonTest unedited.

enum class ParametresPhase { EDITING, SAVING, SAVED, NETWORK_ERROR, SESSION_ENDED }

/**
 * A settings validation or save failure, routed to French copy by the screen. Parametres-owned rather than
 * shared with onboarding: the two screens map to different copy, and CHANGE_CONFLICTS_WITH_RECORD has no
 * onboarding counterpart (onboarding has no recorded days to conflict with). This enum routes presentation;
 * the engine remains the sole judge of the rule (R196).
 */
enum class SettingsError {
    CANTON_MISSING,
    RATE_INVALID,
    EXACT_TOTAL_MISSING,
    EXACT_TOTAL_INVALID,
    START_DATE_INVALID,
    PERIOD_INVALID,
    SAVE_REFUSED,
    CHANGE_CONFLICTS_WITH_RECORD,
}

/** R290: the year's declarable rate as it stands and as a pending consequential change would make it. */
data class RateChange(
    val before: Double,
    val after: Double,
)

/** The two documents « Exporter mes données » offers (AC2): the complete JSON record and the CSV entries. */
enum class AccountExportKind { JSON, CSV }

/**
 * PARKAN-27: the sign-out confirmation. R295 makes sign-out wipe the device's Room record, so a day recorded
 * but not yet synced is lost - it never reached the server and cannot be recovered. The confirmation names how
 * many, in words, before the person confirms (R289's rationale, extended to sign-out).
 */
data class SignOutPrompt(
    /**
     * AN-POLISH (R440): the DISTINCT CALENDAR DAYS still only on this device, ISO, ascending - NAMED, not
     * merely counted, because a count alone leaves the person guessing which days they are about to lose.
     * Empty means the send cleared the queue (or there was nothing in it), and the dialog is the plain
     * confirmation it has always been.
     *
     * DAYS, NOT ROWS. Half-day mode writes TWO pending rows for one date, so counting rows would have said
     * « 3 journées » above a list of two dates - a dialog contradicting itself in one breath, which is
     * precisely what naming the dates makes visible.
     */
    val pendingDates: List<String>,
) {
    /**
     * DERIVED, never stored beside the list. A count and a list kept as two fields can be set to disagree,
     * and this is the dialog where that would matter most (R206).
     */
    val unsyncedDays: Int get() = pendingDates.size
}

/** A completed account action the composition root must act on by leaving the signed-in shell. */
sealed interface AccountEvent {
    /** R295: the local store is cleared and the session revoked; return to sign-in. */
    data object SignedOut : AccountEvent

    /** R289: the account was erased on the server and the device; return to a first-run state. */
    data object Deleted : AccountEvent
}

/**
 * R289: the account-deletion confirmation. It names what is destroyed - the recorded days and, separately,
 * the unsynced ones that never reached the server and cannot be recovered afterwards (the R289 loss, in
 * words), before the person types the confirmation word.
 */
data class DeletePrompt(
    val recordedDays: Int,
    val unsyncedDays: Int,
)

/**
 * R289 / SPEC 14: the result of a delete, surfaced to the person. Done carries the receipt's entry count and
 * alertSubscriptionRemains (§14.3 makes surfacing that a client obligation). Refused and Unknown BOTH keep the
 * device's data - a partial erasure is worse than a refusal (§14.2) - and differ only in what they can claim:
 * Refused is a server rollback (account intact, safe to retry), Unknown is a call that did not complete (the
 * account MAY be gone, but this app cannot confirm - §14.6, not idempotent).
 */
sealed interface DeleteOutcome {
    data class Done(
        val removedEntries: Int,
        val alertSubscriptionRemains: Boolean,
    ) : DeleteOutcome

    data object Refused : DeleteOutcome

    data object Unknown : DeleteOutcome
}

data class ParametresState(
    val canton: Canton?,
    val employmentRate: String,
    val denominator: DenominatorChoice,
    val exactTotalWorkDays: String,
    val granularity: GranularityChoice,
    val activityStartDate: String,
    val phase: ParametresPhase = ParametresPhase.EDITING,
    val error: SettingsError? = null,
    /** R290: set when saving would move the year's rate; the screen shows before/after and asks first. */
    val pendingRateChange: RateChange? = null,
    /** PARKAN-27: set when sign-out is requested; the screen shows the confirmation naming the unsynced days. */
    val signOutPrompt: SignOutPrompt? = null,
    /** AN-POLISH (R440): a bounded send of the pending days is in flight, before anything is discarded. */
    val signOutSending: Boolean = false,
    /** R289: set when deletion is requested; the screen shows the confirmation naming what will be destroyed. */
    val deletePrompt: DeletePrompt? = null,
    /** R289: set after a delete attempt; the screen shows the receipt, or that the device data is intact. */
    val deleteOutcome: DeleteOutcome? = null,
    /** R315: whether automatic detection (beta) is on. MANUAL by default (D19); reflects the local mode cache. */
    val autoDetectionEnabled: Boolean = false,
    /** R323: whether the evening proposal notification is on. Off by default; separate from auto detection. */
    val eveningNotificationEnabled: Boolean = false,
    /** AN-ALERT: whether the threshold alert is on. Off by default; separate from detection and the reminder. */
    val thresholdAlertEnabled: Boolean = false,
)

/**
 * AN-STATE (R310): the Parametres screen's restorable state across a rebuild - the six edited fields and WHICH
 * confirmation was open, never the computed before/after and never a count (R181: a figure restored verbatim
 * goes stale). Serializable, so the composition root's rememberSaveable stores it in the saved-instance-state
 * Bundle, which survives a background kill. The open confirmations are REOPENED once the rows load, with their
 * counts re-derived from the record and R290's before/after RECOMPUTED by the same engine path - never a
 * persisted pair, never a re-run of save() (which would commit when the rates happen to match). An in-flight
 * phase (SAVING) is not persisted: a restore starts in EDITING, a spinner attached to no request would be a lie.
 */
data class ParametresSnapshot(
    val canton: Canton? = null,
    val employmentRate: String = "",
    val denominator: DenominatorChoice = DenominatorChoice.SIMPLIFIED240,
    val exactTotalWorkDays: String = "",
    val granularity: GranularityChoice = GranularityChoice.DAY,
    val activityStartDate: String = "",
    val saveConfirmOpen: Boolean = false,
    val signOutOpen: Boolean = false,
    val deleteOpen: Boolean = false,
) : PlatformSerializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
}

private const val HTTP_OK = 200
private const val HTTP_OK_MAX = 299

/**
 * AN-POLISH (R440): how long sign-out waits for its one send before it asks the person what to do.
 *
 * EIGHT SECONDS, and the figure is bounded from both sides rather than picked. Below: one batch POST over a
 * slow mobile connection has to be able to finish, or the feature is theatre. Above: UrlConnectionTransport
 * sets connect AND read timeouts of 15 s each, so an unreachable server would otherwise hold a person who
 * has already decided to leave for up to thirty seconds per request - R440 says a few seconds, not a minute,
 * and waiting out the transport's own ceiling is the minute. Nothing is lost by cutting it short: a drain
 * that does not finish leaves its rows PENDING, which is where they already were, and the dialog then names
 * them.
 */
private const val SIGN_OUT_SYNC_TIMEOUT_MS = 8_000L

private const val ACCOUNT_EXPORT_JSON = "/api/v1/account/export"
private const val ACCOUNT_EXPORT_CSV = "/api/v1/account/export?format=csv"
private const val ACCOUNT_DELETE_PATH = "/api/v1/account/delete"

/**
 * R289 / SPEC 14: the word the person types to confirm deletion, and the exact value sent as `confirm`. It is
 * NOT copy in the fr/ sense - the server compares it byte-for-byte against its own DELETE_CONFIRMATION, so it
 * is a protocol constant that happens to be French (§14). One home (R206): the screen's typed-word gate, the
 * copy prompt, and the request body all read THIS.
 */
const val DELETE_CONFIRMATION = "SUPPRIMER"
private const val JSON_MIME = "application/json"
private const val CSV_MIME = "text/csv"
private const val JSON_FALLBACK = "mes-donnees.json"
private const val CSV_FALLBACK = "mes-donnees.csv"

// The default LocalStore for the increment-1 settings tests, which never sign out or delete. The app and the
// account tests inject a real one; this exists only so those settings tests need not name a seam they do not use.
// IOS-2e R826/R829: public, not private - :app's factory (OrgJsonParametres.kt) defaults to it as this class does,
// across the module boundary now.
object NoOpLocalStore : LocalStore {
    override suspend fun clearForSignOut() = Unit

    override suspend fun clearForDeletion() = Unit
}

// One setter per field (five), plus save/confirm/cancel/export/sign-out and their private helpers - a cohesive
// state holder for one screen. The parameters are the screen's dependencies (the write, export, revoke and
// erasure seams), listed rather than bundled; a holder would only move the list (the MainShell suppression's
// reasoning).
@Suppress("TooManyFunctions", "LongParameterList")
class ParametresController(
    private val saver: SettingsSaver,
    private val store: SettingsStore,
    private val repository: EntryRepository,
    private val taxYear: Int,
    private val scope: CoroutineScope,
    // AN12 increment 2. The account seams: the authenticated binary GET for « Exporter mes données », the
    // server-side session revoke, and the device-wide erasure (LocalStore, R295). Defaulted to no-ops so the
    // increment-1 SETTINGS tests that build the controller without them still compile; the app (through
    // MainGraph.build) and the account tests always supply the real ones.
    private val exportBytes: suspend (String) -> BytesOutcome = { BytesOutcome.NoSession },
    private val revokeServer: suspend () -> Unit = {},
    // AN-POLISH (R440): ONE bounded drain of this account's pending days, attempted BEFORE sign-out
    // discards anything. A seam rather than a SyncEngine, for the reason every other dependency here is
    // one: the controller has no Context and WorkManager is not a JVM-testable thing. The app injects
    // SyncWorker's own buildSyncEngine (R206 - one construction site for the drain); the tests inject a
    // fake that either settles the queue or refuses, which is what offline looks like from here.
    private val syncNow: suspend () -> Unit = {},
    private val localStore: LocalStore = NoOpLocalStore,
    // AN12 increment 3 (R289): the authenticated POST (SessionManager::authenticatedPost) the delete uses. It
    // takes (path, body) so the delete PATH stays in this file (R206) rather than leaking to the composition
    // root. Defaulted for the settings tests; the account tests supply a fake.
    private val authenticatedPost: suspend (String, String) -> PostOutcome = { _, _ -> PostOutcome.NoSession },
    // AN-AUTO increment 2 (R315): the device's logging-mode cache, so the auto-detection toggle reflects and
    // persists the mode (MANUAL by default), and the seam that stops sampling the instant auto mode is turned
    // off (SPEC 13). Both defaulted so the increment-1 settings tests need not name them; the app injects the
    // SharedPreferences store and the real sampler-stop (the sampler arrives in increment 4).
    private val modeStore: DetectionModeStore = InMemoryDetectionModeStore(),
    private val startSampling: () -> Unit = {},
    private val stopSampling: () -> Unit = {},
    // R323 / PARKAN-36 (AN-NEXT): the evening reminder's opt-in store (off by default, separate from the detection
    // toggle). Defaulted in-memory so the existing tests build; the app injects the SharedPreferences store
    // (ShellState). AN-MANUAL-REMINDER (R1146): written only after the server took reminderEnabled.
    private val eveningNotificationStore: EveningNotificationStore = InMemoryEveningNotificationStore(),
    // AN-ALERT: the threshold-alert opt-in store (off by default, separate from detection and the evening
    // reminder). Purely LOCAL - there is no /api/v1/me consent to reconcile, as it is a device notification.
    // Defaulted in-memory so the existing tests build; the app injects the SharedPreferences store (ShellState).
    private val thresholdAlertStore: ThresholdAlertStore = InMemoryThresholdAlertStore(),
    // AN-STATE (R310): the state to restore after a rebuild (null = a fresh open). Seeds the six edited fields;
    // the open confirmations are reopened once the rows load (resolvePendingReopen), with counts re-derived and
    // R290's before/after recomputed - never persisted (R181).
    restored: ParametresSnapshot? = null,
    // IOS-2e R826: the four wire sites (ParametresWire). REQUIRED and last, so every call that does not name it - the
    // app's and the tests' - resolves to :app's factory of this name, which hands in the org.json implementation.
    private val wire: ParametresWire,
) {
    // The settings the server currently holds, so R290's "before" is the SAVED rate, not the edited one.
    // Post-onboarding this is always present (the settings screen is unreachable before onboarding saves).
    private var savedSettings: Settings =
        checkNotNull(store.load()) { "the settings screen is reached only after onboarding has saved settings" }

    // The device's entries, observed live, so save() computes before/after against the current record without
    // a second read. Same idiom as AujourdhuiController and ReleveController.
    private var entries: List<EntryEntity> = emptyList()

    // The validated settings awaiting a confirmed consequential save (R290). Held here, not in the state, so
    // the screen never carries a Settings.
    private var pendingSettings: Settings? = null

    // AN-STATE: which confirmation to reopen once the rows have loaded (so its count/rate is derived from the
    // record, R181). Each fires once, then clears.
    private var reopenSaveConfirm = restored?.saveConfirmOpen == true
    private var reopenSignOut = restored?.signOutOpen == true
    private var reopenDelete = restored?.deleteOpen == true

    private val mutableState =
        MutableStateFlow(
            (restored?.let(::stateOfSnapshot) ?: stateOf(savedSettings))
                // R315: the toggle opens reflecting the stored mode (MANUAL by default). Persistent, so a
                // rebuild re-reads it; nothing to snapshot (R310). R323: the evening-notification toggle likewise
                // reflects its stored opt-in (off by default), persistent and re-read on rebuild.
                .copy(
                    autoDetectionEnabled = modeStore.load() == LoggingMode.AUTO_DETECT,
                    eveningNotificationEnabled = eveningNotificationStore.isEnabled(),
                    // AN-ALERT: the alert toggle reflects its stored opt-in (off by default), persistent and
                    // re-read on rebuild, the same shape as the evening one.
                    thresholdAlertEnabled = thresholdAlertStore.isEnabled(),
                ),
        )
    val state: StateFlow<ParametresState> = mutableState.asStateFlow()

    // One-shot events (Channels, not StateFlows): handing a file to the share sheet, and leaving the shell on
    // sign-out, each happen once per action and must not re-fire on recomposition. The ExportEvent type is the
    // Releve's (R206): one export contract, one platform hand-off (MainActivity.handleExport).
    private val exportChannel = Channel<ExportEvent>(Channel.BUFFERED)
    val exportEvents: Flow<ExportEvent> = exportChannel.receiveAsFlow()
    private val accountChannel = Channel<AccountEvent>(Channel.BUFFERED)
    val accountEvents: Flow<AccountEvent> = accountChannel.receiveAsFlow()

    init {
        scope.launch {
            repository.observeAll().collect {
                entries = it
                // AN-STATE (R310): reopen a confirmation that was open before a rebuild, now that the rows are
                // loaded - so the sign-out/delete counts and R290's before/after are derived from the record,
                // not transcribed (R181). Each reopen fires once.
                resolvePendingReopen()
            }
        }
    }

    private fun resolvePendingReopen() {
        if (reopenSignOut) {
            reopenSignOut = false
            requestSignOut()
        }
        if (reopenDelete) {
            reopenDelete = false
            requestDelete()
        }
        if (reopenSaveConfirm) {
            reopenSaveConfirm = false
            reopenSaveConfirmation()
        }
    }

    // AN-STATE: re-raise R290's before/after after a rebuild by RECOMPUTING it from the restored edited fields
    // and the current record (decideSave, the compute half) - never by re-running save() (the commit half),
    // which would persist when the rates happen to match. If the change no longer moves the rate, the dialog
    // simply does not reopen; the edited fields remain.
    private fun reopenSaveConfirmation() {
        val settings = validate(mutableState.value) ?: return
        val decision = decideSave(settings)
        if (decision is SaveDecision.Confirm) {
            pendingSettings = settings
            mutableState.update { it.copy(pendingRateChange = decision.change) }
        }
    }

    /**
     * AC2: « Exporter mes données » fetches the FW26 account export (the complete JSON record, or the CSV
     * entries) through the session and hands it to the platform share sheet - the same one-shot ExportEvent
     * path the Releve export uses. The file is the server's render; the device never assembles it.
     */
    fun exportData(kind: AccountExportKind) {
        scope.launch {
            exportChannel.send(toExportEvent(kind, exportBytes(pathFor(kind))))
        }
    }

    private fun pathFor(kind: AccountExportKind): String =
        when (kind) {
            AccountExportKind.JSON -> ACCOUNT_EXPORT_JSON
            AccountExportKind.CSV -> ACCOUNT_EXPORT_CSV
        }

    private fun toExportEvent(
        kind: AccountExportKind,
        outcome: BytesOutcome,
    ): ExportEvent =
        when (outcome) {
            is BytesOutcome.Ok ->
                if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                    ExportEvent.Ready(
                        bytes = outcome.export.bytes,
                        filename = outcome.export.filename ?: fallbackFilename(kind),
                        mimeType = mimeFor(kind),
                    )
                } else {
                    ExportEvent.Failed
                }
            BytesOutcome.NetworkError -> ExportEvent.RequiresConnectivity
            BytesOutcome.SessionExpired, BytesOutcome.SessionEnded, BytesOutcome.NoSession -> ExportEvent.Failed
        }

    private fun mimeFor(kind: AccountExportKind): String =
        when (kind) {
            AccountExportKind.JSON -> JSON_MIME
            AccountExportKind.CSV -> CSV_MIME
        }

    private fun fallbackFilename(kind: AccountExportKind): String =
        when (kind) {
            AccountExportKind.JSON -> JSON_FALLBACK
            AccountExportKind.CSV -> CSV_FALLBACK
        }

    /**
     * PARKAN-27 + AN-POLISH (R440): raise the sign-out confirmation - but TRY TO SEND FIRST.
     *
     * Sign-out wipes this device (R295), so a day the server has not got is lost with it. KMP-2b found that
     * and the only answer in place was a warning. A person on a bad connection could lose a week of
     * declarations with one tap, having been told so and having had nothing offered but the loss. So this
     * now attempts ONE bounded drain of the pending days before the dialog is even shown; what the dialog
     * then says is what is LEFT.
     *
     * NOTHING IS DISCARDED HERE. The send runs in this coroutine, before the prompt exists and long before
     * confirmSignOut touches the session or the store - so a cancellation during it cancels a coroutine
     * that has revoked nothing and cleared nothing. There is no partial sign-out to leave behind.
     *
     * THE SESSION IS THE CURRENT ONE, deliberately: the drain runs BEFORE any revoke, so it posts under a
     * token the server still honours.
     */
    fun requestSignOut() {
        scope.launch {
            if (pendingDatesNow().isEmpty()) {
                showSignOutPrompt(emptyList())
                return@launch
            }
            sendPendingThenPrompt()
        }
    }

    /** R440: the person chose « Réessayer » - one more bounded send, then the dialog says what is left. */
    fun retrySignOutSync() {
        scope.launch { sendPendingThenPrompt() }
    }

    /**
     * R440: one bounded attempt, then the truth re-read FROM THE RECORD rather than inferred from what the
     * drain returned (R181). The timeout is a ceiling on a person who has already decided to leave, not a
     * network budget; a drain that fails inside it simply leaves its rows PENDING, which is where they were.
     *
     * runCatching, because an offline drain THROWS (UnknownHostException and its relatives) rather than
     * returning - and a thrown send must still produce a dialog, not an unhandled failure on the way out of
     * the app. CancellationException is re-thrown: a cancelled coroutine must stay cancelled.
     */
    private suspend fun sendPendingThenPrompt() {
        mutableState.update { it.copy(signOutPrompt = null, signOutSending = true) }
        try {
            withTimeoutOrNull(SIGN_OUT_SYNC_TIMEOUT_MS) {
                runCatching { syncNow() }.onFailure { if (it is CancellationException) throw it }
            }
        } finally {
            mutableState.update { it.copy(signOutSending = false) }
        }
        showSignOutPrompt(pendingDatesNow())
    }

    private fun showSignOutPrompt(dates: List<String>) {
        mutableState.update { it.copy(signOutSending = false, signOutPrompt = SignOutPrompt(dates)) }
    }

    /**
     * The DISTINCT days still only on this device, read FRESH from the record - the observed entry list may
     * not have re-emitted yet after a drain has just written to Room, and the whole point of this dialog is
     * to be right about what is left. DISTINCT, because half-day mode writes two rows for one date.
     */
    private suspend fun pendingDatesNow(): List<String> =
        repository
            .observeAll()
            .first()
            .filter { it.syncState == SyncState.PENDING }
            .map { it.dayDate }
            .distinct()
            .sorted()

    /** PARKAN-27: the person read the count and confirmed. Revoke the session, wipe the local store (R295). */
    fun confirmSignOut() {
        mutableState.update { it.copy(signOutPrompt = null) }
        scope.launch {
            // KMP-1b: THE LOCAL WIPE CANNOT BE CANCELLED, and before KMP-1b it could have been.
            //
            // This read revokeServer(); clearForSignOut(); send(SignedOut) - three cancellable
            // steps in that order. It was safe only by accident: AuthApi.signOut wrapped its
            // call in runCatching, which swallowed CancellationException, so the two steps after
            // it still ran. R387 made cancellation propagate, which is correct and which turned
            // the accident into a security regression on THIS button: tap Se deconnecter, leave
            // the screen, the scope is cancelled mid-request - and the record, the cache, the
            // tokens and the queued sync all stay on the device.
            //
            // The revoke stays first because it needs the token the wipe destroys. The wipe and
            // the event move into a finally inside NonCancellable, so they run whether the
            // revoke returned, threw, or was cancelled. Signing out is a promise about the
            // DEVICE; the server half is best-effort and always was.
            try {
                revokeServer()
            } finally {
                withContext(NonCancellable) {
                    localStore.clearForSignOut()
                    accountChannel.send(AccountEvent.SignedOut)
                }
            }
        }
    }

    /** PARKAN-27: the person kept the session; dismiss the confirmation, nothing is cleared. */
    fun cancelSignOut() {
        mutableState.update { it.copy(signOutPrompt = null) }
    }

    /**
     * R289: raise the deletion confirmation, naming the recorded days and, separately, the unsynced ones that
     * cannot be recovered. Both counts are of the device's rows - the confirmation is shown before the call.
     */
    fun requestDelete() {
        val recorded = entries.size
        val unsynced = entries.count { it.syncState == SyncState.PENDING }
        mutableState.update { it.copy(deletePrompt = DeletePrompt(recorded, unsynced)) }
    }

    /** R289: the person typed the word and confirmed. Delete on the server, then - only on success - the device. */
    fun confirmDelete() {
        mutableState.update { it.copy(deletePrompt = null) }
        scope.launch {
            val outcome = runDelete(authenticatedPost(ACCOUNT_DELETE_PATH, wire.deleteBody()))
            mutableState.update { it.copy(deleteOutcome = outcome) }
        }
    }

    /**
     * The server delete's result, mapped to a DeleteOutcome. ON SUCCESS ONLY does the device erase - a partial
     * erasure where the device is wiped but the server rolled back is exactly what §14.2 forbids. A refusal
     * (4xx/5xx) leaves both intact; a call that did not complete (network / dead session) leaves the device
     * intact and cannot claim the server's state (§14.6).
     */
    private suspend fun runDelete(outcome: PostOutcome): DeleteOutcome =
        when (outcome) {
            is PostOutcome.Ok ->
                if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                    val receipt = wire.parseReceipt(outcome.body)
                    localStore.clearForDeletion()
                    receipt
                } else {
                    DeleteOutcome.Refused
                }
            PostOutcome.SessionEnded, PostOutcome.NoSession, PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                DeleteOutcome.Unknown
        }

    /** R289: the person read the outcome. On a completed deletion, leave for a first-run state; otherwise dismiss. */
    fun acknowledgeDelete() {
        val outcome = mutableState.value.deleteOutcome
        mutableState.update { it.copy(deleteOutcome = null) }
        if (outcome is DeleteOutcome.Done) scope.launch { accountChannel.send(AccountEvent.Deleted) }
    }

    /** R289: the person backed out of the deletion. Nothing is destroyed. */
    fun cancelDelete() {
        mutableState.update { it.copy(deletePrompt = null) }
    }

    // Every field change clears the last error and any pending confirmation: an edit after a before/after
    // dialog was raised invalidates that computed pair, so it must be recomputed on the next save.
    private fun edit(change: ParametresState.() -> ParametresState) {
        pendingSettings = null
        mutableState.update { it.change().copy(error = null, pendingRateChange = null) }
    }

    fun onCantonChange(canton: Canton) = edit { copy(canton = canton) }

    fun onEmploymentRateChange(value: String) = edit { copy(employmentRate = value) }

    fun onDenominatorChange(choice: DenominatorChoice) = edit { copy(denominator = choice) }

    fun onExactTotalChange(value: String) = edit { copy(exactTotalWorkDays = value) }

    fun onGranularityChange(choice: GranularityChoice) = edit { copy(granularity = choice) }

    fun onActivityStartDateChange(value: String) = edit { copy(activityStartDate = value) }

    // AN-STATE (R310): save() is split into a COMPUTE half (decideSave) and a COMMIT half (persist), so a
    // restore can recompute R290's before/after without committing. decideSave is pure over (settings, entries,
    // savedSettings); it never touches the state.
    private sealed interface SaveDecision {
        data object SaveDirectly : SaveDecision

        data object Conflicts : SaveDecision

        data class Confirm(val change: RateChange) : SaveDecision
    }

    @Suppress("ReturnCount")
    private fun decideSave(settings: Settings): SaveDecision {
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        // No recorded year for a change to move: nothing to show before/after, so save directly.
        if (yearEntries.isEmpty()) return SaveDecision.SaveDirectly
        // The edited settings cannot be computed over the recorded days - a granularity switch against half-day
        // rows returns GranularityMismatch. That is not "nothing moved": it invalidates the recorded year, so it
        // is refused rather than saved (R290, the advisor's trap).
        val after = deviceDeclarableRate(settings, entries, taxYear) ?: return SaveDecision.Conflicts
        val before = deviceDeclarableRate(savedSettings, entries, taxYear)
        // The rate does not move (or the stored settings cannot be computed to compare against): a change R290
        // has nothing consequential to announce, so it saves without the dialog.
        if (before == null || before == after) return SaveDecision.SaveDirectly
        return SaveDecision.Confirm(RateChange(before, after))
    }

    /**
     * Validate, then either save directly or, when the change would move the year's declarable rate, expose
     * the before/after for the screen to confirm first (R290). The rate is computed by the device engine over
     * the device's own entries - the same path Aujourd'hui takes (R206) - so "moves the rate here" means
     * exactly "moves the rate the person already sees on Aujourd'hui and, once synced, on the releve".
     */
    fun save() {
        val settings = validate(mutableState.value) ?: return
        when (val decision = decideSave(settings)) {
            SaveDecision.SaveDirectly -> persist(settings)
            SaveDecision.Conflicts -> fail(SettingsError.CHANGE_CONFLICTS_WITH_RECORD)
            is SaveDecision.Confirm -> {
                // R290: the change moves the year's rate. Hold it, and show the before/after; confirmSave() commits.
                pendingSettings = settings
                mutableState.update {
                    it.copy(pendingRateChange = decision.change, error = null, phase = ParametresPhase.EDITING)
                }
            }
        }
    }

    /** R290: the person saw the before/after and confirmed; commit the pending change. */
    fun confirmSave() {
        val settings = pendingSettings ?: return
        mutableState.update { it.copy(pendingRateChange = null) }
        persist(settings)
    }

    /** R290: the person saw the before/after and declined; discard the pending change, keep editing. */
    fun cancelSave() {
        pendingSettings = null
        mutableState.update { it.copy(pendingRateChange = null) }
    }

    /**
     * R315: opt into or out of automatic detection (beta). Consent is timestamped BOTH WAYS through
     * /api/v1/me (detectionConsentBody / FW26). On success the local mode cache follows; turning OFF also
     * STOPS SAMPLING AT ONCE (SPEC 13 - never a window later, never a confirmation dialog away). The
     * disclosure and OS permission that must precede an ENABLE are the screen's concern (R316, increment 3);
     * this records the consent the person has given and reflects the mode.
     */
    fun setAutoDetection(enable: Boolean) {
        scope.launch {
            when (val outcome = saver.saveSettings(wire.consentBody(enable))) {
                is PostOutcome.Ok ->
                    if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                        modeStore.save(if (enable) LoggingMode.AUTO_DETECT else LoggingMode.MANUAL)
                        // SPEC 13: revoking stops sampling immediately; enabling starts it (the permission that
                        // lets a wake get a fix is granted by R316's flow before this call).
                        if (enable) startSampling() else stopSampling()
                        mutableState.update { it.copy(autoDetectionEnabled = enable, error = null) }
                    } else {
                        // The server refused (e.g. consent_required): the toggle does not move, and says so.
                        mutableState.update { it.copy(error = SettingsError.SAVE_REFUSED) }
                    }
                PostOutcome.SessionEnded, PostOutcome.NoSession ->
                    mutableState.update { it.copy(phase = ParametresPhase.SESSION_ENDED) }
                PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                    mutableState.update { it.copy(phase = ParametresPhase.NETWORK_ERROR) }
            }
        }
    }

    /**
     * IOS-AUDIT R1380: the opt-in changed on THIS phone without the person's tap, after this controller was built -
     * iOS's sign-in restore, applied when the notification centre first answered - so the switch shows what the phone
     * now holds. NOTHING IS SENT: the person did not choose it, and a restored value never goes back to the server
     * (R1374 (2)). Android never calls it (its restore is synchronous, before the controller exists).
     */
    fun reflectEveningOptIn(enabled: Boolean) {
        mutableState.update { it.copy(eveningNotificationEnabled = enabled) }
    }

    /**
     * R323 / PARKAN-36: opt into or out of the evening reminder (separate from automatic detection, OFF by default).
     * The OS POST_NOTIFICATIONS prompt that must precede an ENABLE on Android 13+ is the screen's concern
     * (MainActivity, the same disclosure-first discipline as detection).
     *
     * AN-MANUAL-REMINDER (R1146, Android Ruling 14): ONE SWITCH, BOTH MODES, AND THE SERVER FIRST. It used to be
     * purely local; since A8 the server's reminderEnabled decides whether a push is sent (SPEC 13.3), and R1147 reads
     * it back at the next sign-in - so the switch PATCHes it, and the phone's opt-in and the switch move only once the
     * server TOOK it (R1145's rule, setAutoDetection's shape): a refusal leaves both where they were and says so.
     * What fires then is mode-dependent - SamplingWorker's evening notice in automatic mode, the push or the 19:00
     * fallback in manual mode - and every one of them reads this opt-in.
     */
    fun setEveningNotification(enable: Boolean) {
        scope.launch {
            when (val outcome = saver.saveSettings(wire.reminderBody(enable))) {
                is PostOutcome.Ok ->
                    if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                        eveningNotificationStore.setEnabled(enable)
                        mutableState.update { it.copy(eveningNotificationEnabled = enable, error = null) }
                    } else {
                        mutableState.update { it.copy(error = SettingsError.SAVE_REFUSED) }
                    }
                PostOutcome.SessionEnded, PostOutcome.NoSession ->
                    mutableState.update { it.copy(phase = ParametresPhase.SESSION_ENDED) }
                PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                    mutableState.update { it.copy(phase = ParametresPhase.NETWORK_ERROR) }
            }
        }
    }

    /**
     * AN-ALERT: opt into or out of the threshold alert (separate from detection and the evening reminder, OFF
     * by default). Purely LOCAL - no /api/v1/me PATCH and no consent, because it is a device notification, not
     * a server feature. The OS POST_NOTIFICATIONS prompt that must precede an ENABLE on Android 13+ is the
     * screen's concern (MainActivity, the same disclosure-first discipline as the evening reminder); this
     * persists the choice and reflects it. The alert needs no detection (it reads the forecast, not the
     * position), so enabling it works whatever the detection mode.
     */
    fun setThresholdAlert(enable: Boolean) {
        thresholdAlertStore.setEnabled(enable)
        mutableState.update { it.copy(thresholdAlertEnabled = enable) }
    }

    /**
     * R316: the person revoked the location permission in system settings. Fall back to manual LOCALLY and stop
     * sampling at once - NO /api/v1/me PATCH (consent is NOT withdrawn: they may re-grant, and auto-clearing the
     * server stamp would turn an OS revocation into a consent decision it is not). The toggle reflects MANUAL;
     * the composition root (MainActivity ON_RESUME) is the one caller, after locationFullyGranted returns false.
     */
    fun onLocationPermissionRevoked() {
        modeStore.save(LoggingMode.MANUAL)
        stopSampling()
        mutableState.update { it.copy(autoDetectionEnabled = false) }
    }

    private fun persist(settings: Settings) {
        mutableState.update { it.copy(phase = ParametresPhase.SAVING, error = null) }
        scope.launch {
            when (val outcome = saver.saveSettings(wire.patchBody(settings))) {
                is PostOutcome.Ok ->
                    if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                        // Cache only after the server accepted, so Aujourd'hui and the dossier never disagree.
                        // AN-CALENDAR (R475): the store REPLACES the whole set (R447: load, copy, save), and this
                        // screen edits six of its fields - so the one stored field it does not edit, the holder's
                        // name, is carried over from what is stored now. Building the set from the six alone erased
                        // the name on every save; it showed the moment Aujourd'hui read the settings at use (the
                        // greeting lost the first name). The PATCH above is unchanged: it never sends the name.
                        val whole = settings.copy(name = store.load()?.name)
                        store.save(whole)
                        savedSettings = whole
                        pendingSettings = null
                        mutableState.update { it.copy(phase = ParametresPhase.SAVED) }
                    } else {
                        // The database's named refusal (R198). The engine pre-validated, so this is defensive.
                        mutableState.update {
                            it.copy(phase = ParametresPhase.EDITING, error = SettingsError.SAVE_REFUSED)
                        }
                    }
                PostOutcome.SessionEnded, PostOutcome.NoSession ->
                    mutableState.update { it.copy(phase = ParametresPhase.SESSION_ENDED) }
                PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                    mutableState.update { it.copy(phase = ParametresPhase.NETWORK_ERROR) }
            }
        }
    }

    // AN-STATE: the restored edited fields become the EDITING state; the open confirmations are added later by
    // resolvePendingReopen (they need the rows). An in-flight phase is never restored - a restore is EDITING.
    private fun stateOfSnapshot(s: ParametresSnapshot): ParametresState =
        ParametresState(
            canton = s.canton,
            employmentRate = s.employmentRate,
            denominator = s.denominator,
            exactTotalWorkDays = s.exactTotalWorkDays,
            granularity = s.granularity,
            activityStartDate = s.activityStartDate,
        )

    private fun stateOf(settings: Settings): ParametresState =
        ParametresState(
            canton = runCatching { Canton.valueOf(settings.canton) }.getOrNull(),
            employmentRate = settings.employmentRate.toString(),
            denominator =
                if (settings.denominatorKind == "EXACT") DenominatorChoice.EXACT else DenominatorChoice.SIMPLIFIED240,
            exactTotalWorkDays = settings.exactTotalWorkDays?.toString() ?: "",
            granularity =
                if (settings.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY,
            activityStartDate = settings.activityStartDate ?: "",
        )

    /**
     * The validated Settings, or null with the state's error set to the first failure. The engine is the
     * judge of the range and the period (R196: no third copy); the two structural pre-checks - canton
     * chosen, an EXACT method's total present - are the ones the aggregation would otherwise throw on.
     */
    @Suppress("ReturnCount")
    private fun validate(current: ParametresState): Settings? {
        val canton = current.canton ?: return fail(SettingsError.CANTON_MISSING)
        val rate = current.employmentRate.trim().toIntOrNull() ?: return fail(SettingsError.RATE_INVALID)

        val exactTotal: Int?
        if (current.denominator == DenominatorChoice.EXACT) {
            if (current.exactTotalWorkDays.isBlank()) return fail(SettingsError.EXACT_TOTAL_MISSING)
            exactTotal =
                current.exactTotalWorkDays.trim().toIntOrNull() ?: return fail(SettingsError.EXACT_TOTAL_INVALID)
        } else {
            exactTotal = null
        }

        val startDate = current.activityStartDate.trim().ifBlank { null }
        // IOS-2e R827: the shared isIsoDay (OnboardingDates, kotlinx LocalDate.parse - the one home of this check,
        // R206) in place of java.time.LocalDate.parse; ParametresStartDatePinTest proved they accept and refuse the
        // same strings, through this method, before and after.
        if (startDate != null && !isIsoDay(startDate)) {
            return fail(SettingsError.START_DATE_INVALID)
        }

        val settings =
            Settings(
                canton = canton.name,
                employmentRate = rate,
                denominatorKind = if (current.denominator == DenominatorChoice.EXACT) "EXACT" else "SIMPLIFIED240",
                exactTotalWorkDays = exactTotal,
                granularity = if (current.granularity == GranularityChoice.HALF_DAY) "HALF_DAY" else "DAY",
                activityStartDate = startDate,
            )

        val input = toTeleworkInput(settings.toAggregatableUser(), emptyList(), taxYear)
        return when (val result = calculateTelework(input)) {
            is CalcResult.Ok -> settings
            is CalcResult.Err -> fail(result.error.firstOrNull()?.let(::errorFor) ?: SettingsError.SAVE_REFUSED)
        }
    }

    private fun errorFor(error: ValidationError): SettingsError =
        when (error) {
            ValidationError.RateOutOfRange -> SettingsError.RATE_INVALID
            ValidationError.PeriodOutOfRange -> SettingsError.PERIOD_INVALID
            ValidationError.TotalWorkDaysNotPositive -> SettingsError.EXACT_TOTAL_INVALID
            ValidationError.DaysExceedTotal -> SettingsError.EXACT_TOTAL_INVALID
            is ValidationError.NegativeDays -> SettingsError.SAVE_REFUSED
            is ValidationError.GranularityMismatch -> SettingsError.SAVE_REFUSED
        }

    private fun fail(error: SettingsError): Settings? {
        mutableState.update { it.copy(error = error, phase = ParametresPhase.EDITING) }
        return null
    }
}
