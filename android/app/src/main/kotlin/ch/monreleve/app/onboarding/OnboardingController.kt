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

// AN-ONBOARD. The onboarding WIZARD (design/onboarding steps 1-7 + "Tout est prêt"), replacing AN5b's single
// scrolling form. It holds ONE state across the steps and Back preserves everything (R310). Lives OUTSIDE ui/
// (fence 5): it calls the session and the store; the screens read this state and call these setters.
//
// VALIDATION HAS NO THIRD COPY (R196). Per-step checks are structural only (a name present, a canton chosen, a
// rate parseable); the 1-100 bound, the exact-total iff and the period are the engine's, applied at save by
// building the settings' TeleworkInput with no entries and running calculateTelework.
//
// TWO DEVIATIONS FROM THE MOCKUPS, built as designed then noted: there is no granularity step (the mockups
// drop it), so granularity defaults to whole DAYs; and step 4 (Méthode) shows no total field, but the engine
// requires one for the real-days method, so choosing it reveals the total (the alternative is a save the
// server refuses with exact_total_required).

enum class ModeChoice { MANUAL, AUTO_DETECT }

enum class RateChoice { R100, R80, R60, OTHER }

enum class OnboardingPhase { EDITING, SUBMITTING, READY, NETWORK_ERROR, SESSION_ENDED }

/** A field-scoped validation failure. The screen maps each to French copy (fr/OnboardingCopy). */
enum class OnboardingError {
    NAME_MISSING,
    CANTON_MISSING,
    RATE_INVALID,
    EXACT_TOTAL_MISSING,
    EXACT_TOTAL_INVALID,
    START_DATE_INVALID,
    PERIOD_INVALID,
    SAVE_REFUSED,
}

/** The seven wizard steps, in order; a successful save moves on to the "Tout est prêt" summary. */
enum class OnboardingStep { NOM, CANTON, TAUX, METHODE, PERIODE, MODE, RAPPEL }

const val ONBOARDING_STEPS = 7

// DenominatorChoice and GranularityChoice are shared enums - see onboarding/Choices.kt.

data class OnboardingState(
    val step: OnboardingStep = OnboardingStep.NOM,
    val name: String = "",
    val canton: Canton? = null,
    val rateChoice: RateChoice = RateChoice.R100,
    /** The custom rate text, used only when rateChoice is OTHER. */
    val customRate: String = "",
    val denominator: DenominatorChoice = DenominatorChoice.SIMPLIFIED240,
    val exactTotalWorkDays: String = "",
    /** true = whole year (no start date); false = reveals the date picker. */
    val allYear: Boolean = true,
    val activityStartDate: String = "",
    val mode: ModeChoice = ModeChoice.MANUAL,
    val reminder: Boolean = false,
    val phase: OnboardingPhase = OnboardingPhase.EDITING,
    val error: OnboardingError? = null,
) {
    /** The effective rate as a string, for validation and the save. */
    val employmentRate: String
        get() =
            when (rateChoice) {
                RateChoice.R100 -> "100"
                RateChoice.R80 -> "80"
                RateChoice.R60 -> "60"
                RateChoice.OTHER -> customRate
            }
}

/**
 * AN-STATE (R310): everything entered so far, restored across a rebuild. Serializable, kept by the composition
 * root's rememberSaveable. A restore is always EDITING (never an in-flight SUBMITTING, R181).
 */
data class OnboardingSnapshot(
    val step: OnboardingStep = OnboardingStep.NOM,
    val name: String = "",
    val canton: Canton? = null,
    val rateChoice: RateChoice = RateChoice.R100,
    val customRate: String = "",
    val denominator: DenominatorChoice = DenominatorChoice.SIMPLIFIED240,
    val exactTotalWorkDays: String = "",
    val allYear: Boolean = true,
    val activityStartDate: String = "",
    val mode: ModeChoice = ModeChoice.MANUAL,
    val reminder: Boolean = false,
) : java.io.Serializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
}

/** The one call the wizard needs from the session: PATCH /api/v1/me. A seam, so the controller is JVM-testable. */
interface SettingsSaver {
    suspend fun saveSettings(body: String): PostOutcome
}

private const val ME_PATH = "/api/v1/me"

class SessionSettingsSaver(private val session: SessionManager) : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = session.authenticatedPatch(ME_PATH, body)
}

// One setter per field plus the wizard navigation and the save - a cohesive state holder for one flow.
@Suppress("TooManyFunctions")
class OnboardingController(
    private val saver: SettingsSaver,
    private val store: SettingsStore,
    private val taxYear: Int,
    private val scope: CoroutineScope,
    restored: OnboardingSnapshot? = null,
) {
    private val mutableState =
        MutableStateFlow(
            restored?.let {
                OnboardingState(
                    step = it.step,
                    name = it.name,
                    canton = it.canton,
                    rateChoice = it.rateChoice,
                    customRate = it.customRate,
                    denominator = it.denominator,
                    exactTotalWorkDays = it.exactTotalWorkDays,
                    allYear = it.allYear,
                    activityStartDate = it.activityStartDate,
                    mode = it.mode,
                    reminder = it.reminder,
                )
            } ?: OnboardingState(),
        )
    val state: StateFlow<OnboardingState> = mutableState.asStateFlow()

    private fun edit(change: OnboardingState.() -> OnboardingState) {
        mutableState.update { it.change().copy(error = null) }
    }

    fun onNameChange(value: String) = edit { copy(name = value) }

    fun onCantonChange(canton: Canton) = edit { copy(canton = canton) }

    fun onRateChoiceChange(choice: RateChoice) = edit { copy(rateChoice = choice) }

    fun onCustomRateChange(value: String) = edit { copy(rateChoice = RateChoice.OTHER, customRate = value) }

    fun onDenominatorChange(choice: DenominatorChoice) = edit { copy(denominator = choice) }

    fun onExactTotalChange(value: String) = edit { copy(exactTotalWorkDays = value) }

    fun onAllYearChange(allYear: Boolean) = edit { copy(allYear = allYear) }

    fun onActivityStartDateChange(value: String) = edit { copy(allYear = false, activityStartDate = value) }

    /** Set by the route AFTER the disclosure and the OS permission (R315/R316); a deny leaves MANUAL. */
    fun onModeChange(mode: ModeChoice) = edit { copy(mode = mode) }

    fun onReminderChange(reminder: Boolean) = edit { copy(reminder = reminder) }

    fun back() {
        val index = mutableState.value.step.ordinal
        if (index > 0) mutableState.update { it.copy(step = OnboardingStep.entries[index - 1], error = null) }
    }

    /** Validate the current step; if it holds, advance - or, from the last step, save. */
    fun next() {
        val current = mutableState.value
        val error = validateStep(current)
        if (error != null) {
            mutableState.update { it.copy(error = error) }
            return
        }
        val index = current.step.ordinal
        if (index < OnboardingStep.entries.lastIndex) {
            mutableState.update { it.copy(step = OnboardingStep.entries[index + 1], error = null) }
        } else {
            save(current)
        }
    }

    private fun validateStep(s: OnboardingState): OnboardingError? =
        when (s.step) {
            OnboardingStep.NOM -> if (s.name.isBlank()) OnboardingError.NAME_MISSING else null
            OnboardingStep.CANTON -> if (s.canton == null) OnboardingError.CANTON_MISSING else null
            OnboardingStep.TAUX ->
                if (s.employmentRate.trim().toIntOrNull() == null) OnboardingError.RATE_INVALID else null
            OnboardingStep.METHODE -> methodError(s)
            OnboardingStep.PERIODE -> periodError(s)
            else -> null
        }

    private fun methodError(s: OnboardingState): OnboardingError? =
        when {
            s.denominator != DenominatorChoice.EXACT -> null
            s.exactTotalWorkDays.isBlank() -> OnboardingError.EXACT_TOTAL_MISSING
            s.exactTotalWorkDays.trim().toIntOrNull() == null -> OnboardingError.EXACT_TOTAL_INVALID
            else -> null
        }

    private fun periodError(s: OnboardingState): OnboardingError? =
        when {
            s.allYear -> null
            s.activityStartDate.isBlank() -> OnboardingError.START_DATE_INVALID
            runCatching { LocalDate.parse(s.activityStartDate.trim()) }.isFailure -> OnboardingError.START_DATE_INVALID
            else -> null
        }

    private fun save(current: OnboardingState) {
        val settings = buildSettings(current) ?: return
        mutableState.update { it.copy(phase = OnboardingPhase.SUBMITTING, error = null) }
        scope.launch {
            when (saver.saveSettings(settings.mePatchBody())) {
                is PostOutcome.Ok -> {
                    store.save(settings)
                    mutableState.update { it.copy(phase = OnboardingPhase.READY) }
                }
                PostOutcome.SessionEnded, PostOutcome.NoSession ->
                    mutableState.update { it.copy(phase = OnboardingPhase.SESSION_ENDED) }
                PostOutcome.SessionExpired, PostOutcome.NetworkError ->
                    mutableState.update { it.copy(phase = OnboardingPhase.NETWORK_ERROR) }
            }
        }
    }

    /** The validated Settings, or null with the first engine failure set as the step error. Guard clauses,
     *  one per field (R196 defers the range/period to the engine), hence the ReturnCount suppression. */
    @Suppress("ReturnCount")
    private fun buildSettings(current: OnboardingState): Settings? {
        val canton = current.canton ?: return fail(OnboardingError.CANTON_MISSING)
        val rate = current.employmentRate.trim().toIntOrNull() ?: return fail(OnboardingError.RATE_INVALID)
        val exactTotal =
            if (current.denominator == DenominatorChoice.EXACT) {
                current.exactTotalWorkDays.trim().toIntOrNull()
            } else {
                null
            }
        val startDate = if (current.allYear) null else current.activityStartDate.trim().ifBlank { null }
        val auto = current.mode == ModeChoice.AUTO_DETECT
        val settings =
            Settings(
                canton = canton.name,
                employmentRate = rate,
                denominatorKind = if (current.denominator == DenominatorChoice.EXACT) "EXACT" else "SIMPLIFIED240",
                exactTotalWorkDays = exactTotal,
                // No granularity step in the mockups: whole days by default (deviation, noted).
                granularity = "DAY",
                activityStartDate = startDate,
                name = current.name.trim(),
                loggingMode = if (auto) "AUTO_DETECT" else null,
                detectionConsent = if (auto) true else null,
            )
        // The engine is the judge of the range, the exact-total and the period (R196: no third copy).
        val input = toTeleworkInput(settings.toAggregatableUser(), emptyList(), taxYear)
        return when (val result = calculateTelework(input)) {
            is CalcResult.Ok -> settings
            is CalcResult.Err -> fail(errorFor(result.error.firstOrNull()))
        }
    }

    private fun errorFor(error: ValidationError?): OnboardingError =
        when (error) {
            ValidationError.RateOutOfRange -> OnboardingError.RATE_INVALID
            ValidationError.PeriodOutOfRange -> OnboardingError.PERIOD_INVALID
            ValidationError.TotalWorkDaysNotPositive -> OnboardingError.EXACT_TOTAL_INVALID
            ValidationError.DaysExceedTotal -> OnboardingError.EXACT_TOTAL_INVALID
            else -> OnboardingError.SAVE_REFUSED
        }

    private fun fail(error: OnboardingError): Settings? {
        mutableState.update { it.copy(error = error, phase = OnboardingPhase.EDITING) }
        return null
    }
}
