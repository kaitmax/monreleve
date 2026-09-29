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
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.mePatchBody
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
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
)

private const val HTTP_OK = 200
private const val HTTP_OK_MAX = 299

private const val ACCOUNT_EXPORT_JSON = "/api/v1/account/export"
private const val ACCOUNT_EXPORT_CSV = "/api/v1/account/export?format=csv"
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

    private val mutableState = MutableStateFlow(stateOf(savedSettings))
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
            repository.observeAll().collect { entries = it }
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
            revokeServer()
            localStore.clearForSignOut()
            accountChannel.send(AccountEvent.SignedOut)
        }
    }

    /** PARKAN-27: the person kept the session; dismiss the confirmation, nothing is cleared. */
    fun cancelSignOut() {
        mutableState.update { it.copy(signOutPrompt = null) }
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

    /**
     * Validate, then either save directly or, when the change would move the year's declarable rate, expose
     * the before/after for the screen to confirm first (R290). The rate is computed by the device engine over
     * the device's own entries - the same path Aujourd'hui takes (R206) - so "moves the rate here" means
     * exactly "moves the rate the person already sees on Aujourd'hui and, once synced, on the releve".
     */
    @Suppress("ReturnCount")
    fun save() {
        val settings = validate(mutableState.value) ?: return
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        if (yearEntries.isEmpty()) {
            // No recorded year for a change to move: nothing to show before/after, so save directly.
            persist(settings)
            return
        }
        val after = deviceDeclarableRate(settings, entries, taxYear)
        if (after == null) {
            // The edited settings cannot be computed over the recorded days - a granularity switch against
            // half-day rows returns GranularityMismatch. That is not "nothing moved": it is a change that
            // invalidates the recorded year, so it is refused rather than saved (R290, the advisor's trap).
            fail(SettingsError.CHANGE_CONFLICTS_WITH_RECORD)
            return
        }
        val before = deviceDeclarableRate(savedSettings, entries, taxYear)
        if (before == null || before == after) {
            // The rate does not move (or the stored settings cannot be computed to compare against): a change
            // R290 has nothing consequential to announce, so it saves without the dialog.
            persist(settings)
            return
        }
        // R290: the change moves the year's rate. Hold it, and show the before/after; confirmSave() commits.
        pendingSettings = settings
        mutableState.update {
            it.copy(pendingRateChange = RateChange(before, after), error = null, phase = ParametresPhase.EDITING)
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
