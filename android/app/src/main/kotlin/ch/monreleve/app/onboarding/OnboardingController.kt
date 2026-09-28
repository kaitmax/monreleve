package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.ValidationError
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.mePatchBody
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

// AN5b increment 1. The manual-onboarding state holder (SPEC 11.1 manual path). Lives OUTSIDE ui/
// (fence 5) because it calls the session (data/remote via SessionManager) and the local store. The
// screen reads this state and calls these setters; it never sees a PostOutcome.
//
// VALIDATION HAS NO THIRD COPY (R196). The 1-100 rule and the exact-total iff live in the engine and
// the database; this controller does not restate either. It builds the settings' TeleworkInput
// through the increment-2 aggregation with NO entries and runs calculateTelework: the settings are
// valid iff the engine accepts what they produce. The two structural pre-checks it does make -
// canton chosen, an EXACT method's total present - are the ones the aggregation would otherwise
// throw on, turned into a named field error instead of a crash.
//
// R282: no mode chooser, no reminder step. This screen sets the six calculation fields and nothing
// that hints at a mode the manual product does not have.

enum class DenominatorChoice { SIMPLIFIED240, EXACT }

enum class GranularityChoice { DAY, HALF_DAY }

enum class OnboardingPhase { EDITING, SUBMITTING, SAVED, NETWORK_ERROR, SESSION_ENDED }

/** A field-scoped validation failure. The screen maps each to French copy (fr/OnboardingCopy). */
enum class OnboardingError {
    CANTON_MISSING,
    RATE_INVALID,
    EXACT_TOTAL_MISSING,
    EXACT_TOTAL_INVALID,
    START_DATE_INVALID,
    PERIOD_INVALID,
    SAVE_REFUSED,
}

data class OnboardingState(
    val canton: Canton? = null,
    val employmentRate: String = "",
    val denominator: DenominatorChoice = DenominatorChoice.SIMPLIFIED240,
    val exactTotalWorkDays: String = "",
    val granularity: GranularityChoice = GranularityChoice.DAY,
    /** Empty means the whole year (no start date recorded). */
    val activityStartDate: String = "",
    val phase: OnboardingPhase = OnboardingPhase.EDITING,
    val error: OnboardingError? = null,
)

/** The one call onboarding needs from the session: PATCH /api/v1/me. A seam, so the controller is JVM-testable. */
interface SettingsSaver {
    suspend fun saveSettings(body: String): PostOutcome
}

private const val ME_PATH = "/api/v1/me"

class SessionSettingsSaver(private val session: SessionManager) : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = session.authenticatedPatch(ME_PATH, body)
}

// One setter per form field (six), plus submit and its private validation helpers - a cohesive state
// holder for one screen. Fewer, wider setters would push the field-to-error mapping into the screen.
@Suppress("TooManyFunctions")
class OnboardingController(
    private val saver: SettingsSaver,
    private val store: SettingsStore,
    private val taxYear: Int,
    private val scope: CoroutineScope,
) {
    private val mutableState = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = mutableState.asStateFlow()

    // Every field change also clears the last error, so a corrected field stops showing its message.
    private fun edit(change: OnboardingState.() -> OnboardingState) {
        mutableState.update { it.change().copy(error = null) }
    }

    fun onCantonChange(canton: Canton) = edit { copy(canton = canton) }

    fun onEmploymentRateChange(value: String) = edit { copy(employmentRate = value) }

    fun onDenominatorChange(choice: DenominatorChoice) = edit { copy(denominator = choice) }

    fun onExactTotalChange(value: String) = edit { copy(exactTotalWorkDays = value) }

    fun onGranularityChange(choice: GranularityChoice) = edit { copy(granularity = choice) }

    fun onActivityStartDateChange(value: String) = edit { copy(activityStartDate = value) }

    /** Validate, then PATCH /api/v1/me and cache locally. On success the phase becomes SAVED. */
    fun submit() {
        val current = mutableState.value
        val settings = validate(current) ?: return
        mutableState.update { it.copy(phase = OnboardingPhase.SUBMITTING, error = null) }
        scope.launch {
            when (saver.saveSettings(settings.mePatchBody())) {
                is PostOutcome.Ok -> {
                    // Cache only after the server accepted: the device never holds settings the
                    // server refused (which would make Aujourd'hui and the dossier disagree).
                    store.save(settings)
                    mutableState.update { it.copy(phase = OnboardingPhase.SAVED) }
                }
                PostOutcome.SessionEnded, PostOutcome.NoSession ->
                    mutableState.update { it.copy(phase = OnboardingPhase.SESSION_ENDED) }
                PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                    mutableState.update { it.copy(phase = OnboardingPhase.NETWORK_ERROR) }
            }
        }
    }

    /**
     * The validated Settings, or null with the state's error field set to the first failure. Guard
     * clauses, one per field, each returning that field's own named error - clearer here than
     * accumulating, and the reason for the ReturnCount suppression.
     */
    @Suppress("ReturnCount")
    private fun validate(current: OnboardingState): Settings? {
        val canton = current.canton ?: return fail(OnboardingError.CANTON_MISSING)
        val rate = current.employmentRate.trim().toIntOrNull() ?: return fail(OnboardingError.RATE_INVALID)

        val exactTotal: Int?
        if (current.denominator == DenominatorChoice.EXACT) {
            if (current.exactTotalWorkDays.isBlank()) return fail(OnboardingError.EXACT_TOTAL_MISSING)
            exactTotal =
                current.exactTotalWorkDays.trim().toIntOrNull() ?: return fail(OnboardingError.EXACT_TOTAL_INVALID)
        } else {
            exactTotal = null
        }

        val startDate = current.activityStartDate.trim().ifBlank { null }
        if (startDate != null && runCatching { LocalDate.parse(startDate) }.isFailure) {
            return fail(OnboardingError.START_DATE_INVALID)
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

        // The engine is the judge of the range and the period (R196: no third copy). Empty entries -
        // onboarding validates the settings, not a year's work.
        val input = toTeleworkInput(settings.toAggregatableUser(), emptyList(), taxYear)
        return when (val result = calculateTelework(input)) {
            is CalcResult.Ok -> settings
            // calculateTelework's Err carries every validation failure; onboarding shows the first,
            // since the fields are filled top to bottom and the first failure is the one to fix.
            is CalcResult.Err -> fail(result.error.firstOrNull()?.let(::errorFor) ?: OnboardingError.SAVE_REFUSED)
        }
    }

    private fun errorFor(error: ValidationError): OnboardingError =
        when (error) {
            ValidationError.RateOutOfRange -> OnboardingError.RATE_INVALID
            ValidationError.PeriodOutOfRange -> OnboardingError.PERIOD_INVALID
            ValidationError.TotalWorkDaysNotPositive -> OnboardingError.EXACT_TOTAL_INVALID
            ValidationError.DaysExceedTotal -> OnboardingError.EXACT_TOTAL_INVALID
            is ValidationError.NegativeDays -> OnboardingError.SAVE_REFUSED
            is ValidationError.GranularityMismatch -> OnboardingError.SAVE_REFUSED
        }

    private fun fail(error: OnboardingError): Settings? {
        mutableState.update { it.copy(error = error, phase = OnboardingPhase.EDITING) }
        return null
    }
}
