package ch.monreleve.app.forecast

import ch.monreleve.app.calc.TeleworkResult
import java.time.DayOfWeek

// AN-SIM (R340, R281). The simulator's UI-facing state, produced by SimulationController from the engine
// (dossier.simulationResults) run on the imagined year plus the chosen change. R340 - A PROJECTION IS NEVER A
// RECORD: every figure below is READ from the engine result, never computed in the screen (FW12's defect). A
// null [view] is the invitation state: no rhythm set yet, or the engine cannot produce a result from the
// current settings - the screen invites setting a rhythm rather than drawing an empty simulation.
//
// THE SCREEN SPEAKS UI VOCABULARY ONLY. SimScenario / SimInputs are the screen's words; the controller maps
// them to the dossier-level SimChange, so the ui/ repository-only fence (no data.local, no dossier.SimChange in
// a composable) holds.

/** The four changes the engine can model (AN-SIM section 1), in the screen's vocabulary. */
enum class SimScenario { EXTRA_WEEKDAY, EXTRA_MONTH_DAYS, RATE, MISSIONS }

/**
 * The raw inputs the screen collects. Numbers are held as text (the OutlinedTextField idiom, as the Parametres
 * rate field does), parsed by the controller; an empty or invalid field is a no-op, never a crash.
 */
data class SimInputs(
    /** EXTRA_WEEKDAY: which weekday becomes a home day. Seeded to the first available weekday. */
    val extraWeekday: DayOfWeek? = null,
    /** EXTRA_MONTH_DAYS: how many extra home days this month. */
    val extraMonthDays: String = "",
    /** RATE: the new employment rate (1..100). Seeded to the current rate, so no change until it is edited. */
    val targetRate: String = "",
    /** MISSIONS: missions in France. */
    val missionsFrance: String = "",
    /** MISSIONS: missions in a third state. */
    val missionsThird: String = "",
) : java.io.Serializable

/**
 * The simulator's restorable selection (R310): the scenario and its inputs, so a rotation, a text-size change, a
 * dark-mode switch or a background kill reopens the same scenario with the same inputs. Serializable, so the
 * composition root's rememberSaveable stores it in the saved-instance-state Bundle, which outlives process death.
 * The computed view is NOT stored - it is recomputed from the record and the rhythm on restore (R181).
 */
data class SimulationSnapshot(
    val scenario: SimScenario,
    val inputs: SimInputs,
) : java.io.Serializable

data class SimulationState(
    val scenario: SimScenario = SimScenario.EXTRA_WEEKDAY,
    val inputs: SimInputs = SimInputs(),
    /** The weekdays that can still become a home day (not already Domicile) - the EXTRA_WEEKDAY dropdown. */
    val availableWeekdays: List<DayOfWeek> = emptyList(),
    val view: SimulationView? = null,
    /** True only for EXTRA_WEEKDAY with a weekday chosen: adopting means changing the rhythm (still a projection). */
    val canAdopt: Boolean = false,
)

/**
 * Everything the simulator card draws - every number from the engine, through the shared aggregation (R281).
 * The screen maps these to a zone, a status and formatted strings (pure display mappings, as PrevisionScreen
 * does), but recomputes no rate and no headroom.
 */
data class SimulationView(
    /** declarableRate from the record alone today - the rail's solid part (where you stand now). */
    val recordedRate: Double,
    /** declarableRate of the current year-end projection - "Votre projection". */
    val currentRate: Double,
    /** declarableRate of the projection WITH the change - "Avec ce changement" + the rail's soft part. */
    val simulatedRate: Double,
    /** The engine result behind the simulated figure: the rail's zone/status and the two remaining-day tiles. */
    val simulated: TeleworkResult,
    val fiscalCeiling: Double,
    val socialCeiling: Double,
)
