package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.SimChange
import ch.monreleve.app.dossier.simulationResults
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import java.time.Clock
import java.time.DayOfWeek

// AN-SIM (R340, R281, R28, R310). The one place a simulation is RUN - it drives the pure engine path
// (dossier.simulationResults) and holds no UI. R340 - A PROJECTION IS NEVER A RECORD: computing a simulation
// writes NOTHING (this controller has no save/record seam at all; the R340 "nothing written" test proves the
// stores are untouched). ADOPTING an extra weekday is NOT done here - it is the ForecastController's setDay
// (wired at the shell), which persists the local rhythm (R341) and leaves the rhythm's ONE in-memory home the
// ForecastController; routing adopt there is why a adopted weekday changes the forecast too.
//
// THE RHYTHM HAS ONE HOME (R206). This controller READS it from the rhythm repository's flow (never a second
// in-memory copy it could edit), so when adopt persists through the ForecastController the repository re-emits
// and the simulator's baseline follows. It never edits the rhythm, so collecting the flow cannot race an
// in-flight edit (the reason the ForecastController seeds once does not apply here).
//
// R28: the clock is the one seam for "today"; the dossier layer stays clock-free (today is a parameter).

// IOS-2d R813: the weekday list, availableWeekdays and the extra-weekday change moved unchanged to ForecastDays.kt.
private const val MIN_RATE = 1
private const val MAX_RATE = 100

// LongParameterList suppressed as CalendarController's is: the restorable `restored` seed is the 7th
// constructor dependency (R310), the same shape the calendar/parametres controllers already carry.
@Suppress("LongParameterList")
class SimulationController(
    rhythmRepo: RhythmRepository,
    entryRepo: EntryRepository,
    // AN-CALENDAR (R475): the store is held and read at every emission - never a value read once here and kept.
    private val settingsStore: SettingsStore,
    taxYear: Int,
    private val clock: Clock,
    scope: CoroutineScope,
    // AN-SIM (R310): the restorable selection, seeded on a rebuild (rotation / text-size / dark mode / kill) so the
    // scenario and its inputs survive; the view is recomputed, never stored (R181). Null on a fresh build.
    restored: SimulationSnapshot? = null,
) {
    private var today: LocalDate = LocalDate.parse(todayInParis(clock))
    private var currentTaxYear: Int = taxYear
    private var rhythm: WeeklyRhythm = WeeklyRhythm()
    private var entries: List<EntryEntity> = emptyList()
    private var scenario: SimScenario = restored?.scenario ?: SimScenario.EXTRA_WEEKDAY
    private var inputs: SimInputs = restored?.inputs ?: SimInputs()

    private val mutableState = MutableStateFlow(SimulationState())
    val state: StateFlow<SimulationState> = mutableState.asStateFlow()

    init {
        scope.launch {
            rhythmRepo.observe().collect { value ->
                rhythm = value
                emitState()
            }
        }
        scope.launch {
            entryRepo.observeAll().collect { list ->
                entries = list
                emitState()
            }
        }
    }

    /** Choose which scenario to test. */
    fun selectScenario(choice: SimScenario) {
        scenario = choice
        emitState()
    }

    /** Update the raw inputs (the screen passes the whole set; the controller parses). */
    fun updateInputs(next: SimInputs) {
        inputs = next
        emitState()
    }

    /** F8 (as Aujourd'hui / the forecast do): recompute today and the tax year from the clock on resume. */
    fun refresh() {
        today = LocalDate.parse(todayInParis(clock))
        currentTaxYear = today.year
        emitState()
    }

    private fun emitState() {
        val settings = settingsStore.load()
        val available = availableWeekdays(rhythm)
        inputs = seeded(inputs, available, settings)
        val view = settings?.let { viewOf(it, available) }
        mutableState.value =
            SimulationState(
                scenario = scenario,
                inputs = inputs,
                availableWeekdays = available,
                view = view,
                canAdopt = scenario == SimScenario.EXTRA_WEEKDAY && inputs.extraWeekday != null,
            )
    }

    // Null when the rhythm is empty or the engine rejects the settings - the screen invites a rhythm rather than
    // drawing an empty simulation. Every figure comes from the engine (R340/FW12). ReturnCount suppressed as
    // the forecast's projectionOf is: the two guards (empty rhythm, engine refusal) each return the invitation.
    @Suppress("ReturnCount")
    private fun viewOf(
        settings: Settings,
        available: List<DayOfWeek>,
    ): SimulationView? {
        if (rhythm.isEmpty) return null
        val recorded =
            entries
                .filter { it.dayDate.startsWith("$currentTaxYear-") }
                .map { it.toAggregatable() }
        val results =
            simulationResults(
                settings.toAggregatableUser(),
                recorded,
                rhythm.toEntryKindMap(),
                effectiveChange(available, settings),
                today,
                currentTaxYear,
            ) ?: return null
        val rules = ruleSetFor(currentTaxYear)
        return SimulationView(
            recordedRate = results.recorded.declarableRate,
            currentRate = results.baseline.declarableRate,
            simulatedRate = results.simulated.declarableRate,
            simulated = results.simulated,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
        )
    }

    // The dossier change the current scenario + inputs describe. An empty or invalid field is a no-op (the
    // simulated figure then equals the baseline), never a crash - the number parsing lives here, off the screen.
    private fun effectiveChange(
        available: List<DayOfWeek>,
        settings: Settings,
    ): SimChange =
        when (scenario) {
            SimScenario.EXTRA_WEEKDAY -> {
                val day = inputs.extraWeekday ?: available.firstOrNull()
                extraWeekdayChange(day)
            }
            SimScenario.EXTRA_MONTH_DAYS ->
                SimChange.ExtraMonthDays(inputs.extraMonthDays.toIntOrNull()?.coerceAtLeast(0) ?: 0)
            SimScenario.RATE -> {
                val parsed = inputs.targetRate.toIntOrNull()?.takeIf { it in MIN_RATE..MAX_RATE }
                SimChange.Rate(parsed ?: settings.employmentRate)
            }
            SimScenario.MISSIONS ->
                SimChange.Missions(
                    inputs.missionsFrance.toIntOrNull()?.coerceAtLeast(0) ?: 0,
                    inputs.missionsThird.toIntOrNull()?.coerceAtLeast(0) ?: 0,
                )
        }
}

/** Seed the effective weekday (first available) and the rate (the current one) so no field starts empty. */
private fun seeded(
    inputs: SimInputs,
    available: List<DayOfWeek>,
    settings: Settings?,
): SimInputs {
    var seeded = inputs
    if (seeded.extraWeekday == null || seeded.extraWeekday !in available) {
        seeded = seeded.copy(extraWeekday = available.firstOrNull())
    }
    if (seeded.targetRate.isBlank() && settings != null) {
        seeded = seeded.copy(targetRate = settings.employmentRate.toString())
    }
    return seeded
}
