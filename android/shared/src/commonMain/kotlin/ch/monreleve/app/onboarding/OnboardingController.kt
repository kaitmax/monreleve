package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.ValidationError
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import ch.monreleve.app.shared.PlatformSerializable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// AN-ONBOARD. The onboarding WIZARD (design/onboarding steps 1-7 + "Tout est prêt"), replacing AN5b's single
// scrolling form. It holds ONE state across the steps and Back preserves everything (R310). Lives OUTSIDE ui/
// (fence 5): it calls the session and the store; the screens read this state and call these setters.
//
// VALIDATION HAS NO THIRD COPY (R196). Per-step checks are structural only (a name present, a canton chosen, a
// rate parseable); the 1-100 bound, the exact-total iff and the period are the engine's, applied at save by
// building the settings' TeleworkInput with no entries and running calculateTelework.
//
// R336 (AN-ONBOARD-2): the mockups dropped the granularity question (whole days vs half-days); it is now its own
// step, after Méthode and before Période, writing the existing granularity setting (no new data). R335: the
// wizard runs an ordered SUBSET of the steps - a complete account goes straight to Aujourd'hui, a partial one is
// asked only the fields it is missing (state.steps), prefilled from /me. Step 4 (Méthode) still reveals a total
// field the static mockup omits, because the engine requires one for the real-days method.
//
// IOS-2b R778: moved to :shared commonMain (package unchanged), pinned first by OnboardingControllerPinTest. What
// needed the platform went behind a seam: the PATCH /me body is made by `patchBody`, handed in - org.json's
// Settings.mePatchBody stays in :app (MeWire.kt, PARK-D3), supplied by :app's factory of the same name
// (OrgJsonOnboarding.kt), so every Android call site is unedited; iOS hands in its own (IOS-1b-B). The restore seed's
// supertype is PlatformSerializable: java.io.Serializable on Android, the same serialVersionUID, the same Bundle bytes.

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

/**
 * The eight wizard steps, in order; a successful save moves on to the "Tout est prêt" summary. GRANULARITY
 * (R336) sits after METHODE and before PERIODE - whole days or half-days, the question the mockups dropped.
 */
enum class OnboardingStep { NOM, CANTON, TAUX, METHODE, GRANULARITY, PERIODE, MODE, RAPPEL }

/** The full flow, in order (R336: eight steps). A partial onboarding (R335) runs an ordered subset of these. */
val DEFAULT_STEPS: List<OnboardingStep> = OnboardingStep.entries.toList()

const val ONBOARDING_STEPS = 8

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
    /** R336: whole days or half-days. Preselected whole days, as the step's default card. */
    val granularity: GranularityChoice = GranularityChoice.DAY,
    /** true = whole year (no start date); false = reveals the date picker. */
    val allYear: Boolean = true,
    val activityStartDate: String = "",
    val mode: ModeChoice = ModeChoice.MANUAL,
    val reminder: Boolean = false,
    /** R335: the ordered steps this run asks - the full flow, or the subset a partial account is missing. */
    val steps: List<OnboardingStep> = DEFAULT_STEPS,
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
    // AN-ONBOARD-2: R336's granularity choice, and R335's step plan - carried so both a rebuild (R310) and the
    // /me prefill (StartupDecider -> OnboardingRoute) restore the same subset flow with the same values.
    val granularity: GranularityChoice = GranularityChoice.DAY,
    val steps: List<OnboardingStep> = DEFAULT_STEPS,
) : PlatformSerializable {
    companion object {
        // Bumped from 1L: the shape gained granularity + steps (AN-ONBOARD-2). rememberSaveable state is
        // process-scoped, so this never deserialises a cross-version bundle; the bump records the change.
        private const val serialVersionUID: Long = 2L
    }
}

/** The one call the wizard needs from the session: PATCH /api/v1/me. A seam, so the controller is JVM-testable. */
interface SettingsSaver {
    suspend fun saveSettings(body: String): PostOutcome
}

private const val ME_PATH = "/api/v1/me"

/** The statuses that mean the server took the PATCH. */
private val HTTP_SUCCESS = 200..299

class SessionSettingsSaver(private val session: SessionManager) : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = session.authenticatedPatch(ME_PATH, body)
}

// One setter per field plus the wizard navigation and the save - a cohesive state holder for one flow.
// LongParameterList: AN-SIGNIN-RESOLVE (R1162) added onModeSaved, the eighth. Each is a seam the host fills (the
// saver, the store, the codec, the mode hand-off); bundling them into a holder would only rename the list.
@Suppress("TooManyFunctions", "LongParameterList")
class OnboardingController(
    private val saver: SettingsSaver,
    private val store: SettingsStore,
    private val taxYear: Int,
    private val scope: CoroutineScope,
    restored: OnboardingSnapshot? = null,
    // IOS-2b R778: the PATCH /me body is made by a function handed in, so the controller holds no codec. No default:
    // a call that does not name one is :app's factory, which hands in org.json's mePatchBody.
    private val patchBody: (Settings) -> String,
    // AN-SIGNIN-RESOLVE (R1162): told the mode the server now holds after it ACCEPTED an automatic choice. No default,
    // for patchBody's reason: a construction that forgets it is a phone that never learns its own mode (PARK-E3).
    private val onModeSaved: (LoggingMode) -> Unit,
) {
    private val mutableState =
        MutableStateFlow(
            restored?.let {
                val steps = it.steps.ifEmpty { DEFAULT_STEPS }
                OnboardingState(
                    step = if (it.step in steps) it.step else steps.first(),
                    name = it.name,
                    canton = it.canton,
                    rateChoice = it.rateChoice,
                    customRate = it.customRate,
                    denominator = it.denominator,
                    exactTotalWorkDays = it.exactTotalWorkDays,
                    granularity = it.granularity,
                    allYear = it.allYear,
                    activityStartDate = it.activityStartDate,
                    mode = it.mode,
                    reminder = it.reminder,
                    steps = steps,
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

    fun onGranularityChange(choice: GranularityChoice) = edit { copy(granularity = choice) }

    fun onAllYearChange(allYear: Boolean) = edit { copy(allYear = allYear) }

    fun onActivityStartDateChange(value: String) = edit { copy(allYear = false, activityStartDate = value) }

    /** Set by the route AFTER the disclosure and the OS permission (R315/R316); a deny leaves MANUAL. */
    fun onModeChange(mode: ModeChoice) = edit { copy(mode = mode) }

    fun onReminderChange(reminder: Boolean) = edit { copy(reminder = reminder) }

    fun back() {
        val current = mutableState.value
        val index = current.steps.indexOf(current.step)
        if (index > 0) mutableState.update { it.copy(step = current.steps[index - 1], error = null) }
    }

    /** Validate the current step; if it holds, advance through state.steps - or, from the last step, save. */
    fun next() {
        val current = mutableState.value
        val error = validateStep(current)
        if (error != null) {
            mutableState.update { it.copy(error = error) }
            return
        }
        val index = current.steps.indexOf(current.step)
        if (index < current.steps.lastIndex) {
            mutableState.update { it.copy(step = current.steps[index + 1], error = null) }
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
            !isIsoDay(s.activityStartDate.trim()) -> OnboardingError.START_DATE_INVALID
            else -> null
        }

    private fun save(current: OnboardingState) {
        val settings = buildSettings(current) ?: return
        mutableState.update { it.copy(phase = OnboardingPhase.SUBMITTING, error = null) }
        scope.launch {
            when (val outcome = saver.saveSettings(patchBody(settings))) {
                is PostOutcome.Ok ->
                    if (outcome.status in HTTP_SUCCESS) {
                        // AN-SIGNIN-RESOLVE (R1162, PARK-E3): the automatic choice the server has just ACCEPTED reaches
                        // the phone - the host saves the mode and starts the sampler where the permission is held.
                        // Before the settings are cached: cached settings send the next launch past RESOLVING, which
                        // would otherwise be the only other place the mode is restored. A manual choice sends no mode,
                        // so the server's value - restored at RESOLVING - stands and nothing is handed on.
                        if (settings.loggingMode == LoggingMode.AUTO_DETECT.name) onModeSaved(LoggingMode.AUTO_DETECT)
                        store.save(settings)
                        mutableState.update { it.copy(phase = OnboardingPhase.READY) }
                    } else {
                        // AN-STATUS-HONESTY (R1191): the server refused or failed the PATCH - nothing is cached and
                        // nothing handed on, so no "Tout est prêt" for settings the server does not hold (the Relevé is
                        // built from the SERVER's). The person stays on the step with SAVE_REFUSED and the same button
                        // retries - ParametresController.persist's treatment of the same PATCH, the same copy.
                        mutableState.update {
                            it.copy(phase = OnboardingPhase.EDITING, error = OnboardingError.SAVE_REFUSED)
                        }
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
                // R336: the granularity chosen at its step (whole days by default).
                granularity = if (current.granularity == GranularityChoice.HALF_DAY) "HALF_DAY" else "DAY",
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
