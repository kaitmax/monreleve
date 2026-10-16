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
import ch.monreleve.app.settings.detectionConsentBody
import ch.monreleve.app.settings.mePatchBody
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.LocalDate

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
data class SignOutPrompt(val unsyncedDays: Int)

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
) : java.io.Serializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
}

private const val HTTP_OK = 200
private const val HTTP_OK_MAX = 299

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
private object NoOpLocalStore : LocalStore {
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
    // R323 / PARKAN-36 (AN-NEXT): the evening proposal notification's opt-in store (off by default, separate from
    // the detection toggle). Defaulted in-memory so the existing tests build; the app injects the SharedPreferences
    // store (ShellState). Purely local - there is no /api/v1/me consent to reconcile, unlike the detection mode.
    private val eveningNotificationStore: EveningNotificationStore = InMemoryEveningNotificationStore(),
    // AN-ALERT: the threshold-alert opt-in store (off by default, separate from detection and the evening
    // reminder). Purely LOCAL - there is no /api/v1/me consent to reconcile, as it is a device notification.
    // Defaulted in-memory so the existing tests build; the app injects the SharedPreferences store (ShellState).
    private val thresholdAlertStore: ThresholdAlertStore = InMemoryThresholdAlertStore(),
    // AN-STATE (R310): the state to restore after a rebuild (null = a fresh open). Seeds the six edited fields;
    // the open confirmations are reopened once the rows load (resolvePendingReopen), with counts re-derived and
    // R290's before/after recomputed - never persisted (R181).
    restored: ParametresSnapshot? = null,
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
     * PARKAN-27: raise the sign-out confirmation, naming how many recorded days have not yet synced and will
     * be lost when Room is wiped (R295). The count is of PENDING rows across every year - sign-out clears the
     * whole device, not one tax year.
     */
    fun requestSignOut() {
        val unsynced = entries.count { it.syncState == SyncState.PENDING }
        mutableState.update { it.copy(signOutPrompt = SignOutPrompt(unsynced)) }
    }

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
            val outcome = runDelete(authenticatedPost(ACCOUNT_DELETE_PATH, deleteBody()))
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
                    val receipt = parseReceipt(outcome.body)
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

    private fun deleteBody(): String = JSONObject().put("confirm", DELETE_CONFIRMATION).toString()

    // §14.1: `removed` is a map (parse as one, never a fixed record); alertSubscriptionRemains is surfaced
    // (§14.3). The entry count is the figure worth showing a person; the rest of the receipt is not printed.
    private fun parseReceipt(body: String): DeleteOutcome.Done {
        val json = JSONObject(body)
        val removed = json.optJSONObject("removed")
        return DeleteOutcome.Done(
            removedEntries = removed?.optInt("Entry", 0) ?: 0,
            alertSubscriptionRemains = json.optBoolean("alertSubscriptionRemains", false),
        )
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
            when (val outcome = saver.saveSettings(detectionConsentBody(enable))) {
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
     * R323 / PARKAN-36: opt into or out of the evening proposal notification (separate from automatic detection,
     * OFF by default). Purely LOCAL - no /api/v1/me PATCH and no consent, because it is a device notification, not
     * a server feature. The OS POST_NOTIFICATIONS prompt that must precede an ENABLE on Android 13+ is the
     * screen's concern (MainActivity, the same disclosure-first discipline as detection); this persists the
     * choice and reflects it. The decision to actually fire is the worker's (eveningDecision), which also requires
     * automatic detection to be on - so enabling this while manual changes nothing until detection is on too.
     */
    fun setEveningNotification(enable: Boolean) {
        eveningNotificationStore.setEnabled(enable)
        mutableState.update { it.copy(eveningNotificationEnabled = enable) }
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
            when (val outcome = saver.saveSettings(settings.mePatchBody())) {
                is PostOutcome.Ok ->
                    if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                        // Cache only after the server accepted, so Aujourd'hui and the dossier never disagree.
                        store.save(settings)
                        savedSettings = settings
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
        if (startDate != null && runCatching { LocalDate.parse(startDate) }.isFailure) {
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
