package ch.monreleve.app.ui.screens.simulation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.forecast.SimInputs
import ch.monreleve.app.forecast.SimScenario
import ch.monreleve.app.forecast.SimulationState
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.SimulationCopy
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.InfoNote
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton
import ch.monreleve.app.ui.screens.onboarding.SecondaryButton
import ch.monreleve.app.ui.screens.rythme.ForecastTopBar
import kotlinx.datetime.DayOfWeek

// AN-SIM (R340, R281). The simulator (design/decide/Simulation.dc.html): pick a scenario, feed its input, see
// the current projection beside the simulated one, and the consequence. R340 - A PROJECTION IS NEVER A RECORD:
// the screen is titled "Simulation", the result card is labelled "Votre projection", computing writes nothing
// (the controller has no record seam), and the not-covered cases are stated ALWAYS so a case outside the model
// never produces a confident number. Stateless (fence 5): it reads a SimulationState and calls back. Tokens
// only; every string from fr/.
//
// THE BUTTONS. "Revenir a ma prevision" is always the primary. "Adopter ce rythme" appears ONLY for the extra-
// weekday scenario (adopting changes the rhythm - still a projection, nothing recorded; the shell routes it to
// the ForecastController's setDay). For the rate scenario, the secondary is a LINK to change the rate in
// Parametres, where R290's before/after confirmation fires. Missions and extra days have no adopt - they are
// recorded as days when they happen.

private val SCENARIO_LABELS: Map<SimScenario, String> =
    mapOf(
        SimScenario.EXTRA_WEEKDAY to SimulationCopy.SCENARIO_EXTRA_WEEKDAY,
        SimScenario.EXTRA_MONTH_DAYS to SimulationCopy.SCENARIO_EXTRA_DAYS,
        SimScenario.RATE to SimulationCopy.SCENARIO_RATE,
        SimScenario.MISSIONS to SimulationCopy.SCENARIO_MISSIONS,
    )

data class SimulationActions(
    val onSelectScenario: (SimScenario) -> Unit = {},
    val onInputsChange: (SimInputs) -> Unit = {},
    val onAdopt: () -> Unit = {},
    val onChangeRate: () -> Unit = {},
    val onReturn: () -> Unit = {},
    val onBack: () -> Unit = {},
)

@Composable
fun SimulationScreen(
    state: SimulationState,
    actions: SimulationActions,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        ForecastTopBar(onBack = actions.onBack, title = SimulationCopy.NAV_TITLE)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space16),
        ) {
            Text(text = SimulationCopy.TITLE, style = FrontierType.h1)
            ScenarioChips(state.scenario, actions.onSelectScenario)
            if (state.view == null) {
                Text(text = PrevisionCopy.INVITE_BODY, style = FrontierType.body, color = LightColors.textSecondary)
            } else {
                ScenarioInput(state, actions.onInputsChange)
                SimulationCard(state.view)
            }
            InfoNote(text = SimulationCopy.NOT_COVERED)
        }
        BottomActions {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                PrimaryButton(label = SimulationCopy.RETURN, onClick = actions.onReturn)
                when {
                    state.canAdopt -> SecondaryButton(label = SimulationCopy.ADOPT, onClick = actions.onAdopt)
                    state.scenario == SimScenario.RATE ->
                        SecondaryButton(label = SimulationCopy.CHANGE_RATE, onClick = actions.onChangeRate)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScenarioChips(
    selected: SimScenario,
    onSelect: (SimScenario) -> Unit,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        for (scenario in SimScenario.entries) {
            ScenarioChip(
                label = SCENARIO_LABELS.getValue(scenario),
                selected = scenario == selected,
                onClick = { onSelect(scenario) },
            )
        }
    }
}

// The AujourdhuiScreen RecordButton / Rythme DayToggle idiom: selected renders filled (brand), unselected
// outlined - the choice is visible without colour alone (R340). `selected` is announced for TalkBack.
@Composable
private fun ScenarioChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.pill)
    val sizing = Modifier.heightIn(min = Spacing.space48).semantics { this.selected = selected }
    val padding = PaddingValues(horizontal = Spacing.space12)
    if (selected) {
        Button(onClick = onClick, shape = shape, contentPadding = padding, modifier = sizing) {
            Text(text = label, style = FrontierType.bodyM)
        }
    } else {
        OutlinedButton(onClick = onClick, shape = shape, contentPadding = padding, modifier = sizing) {
            Text(text = label, style = FrontierType.bodyM)
        }
    }
}

// The per-scenario input: a weekday dropdown, or one or two number fields. An empty or invalid number is a no-op
// (the controller parses), so the simulated figure simply equals the baseline until a real value is entered.
@Composable
private fun ScenarioInput(
    state: SimulationState,
    onInputsChange: (SimInputs) -> Unit,
) {
    val inputs = state.inputs
    when (state.scenario) {
        SimScenario.EXTRA_WEEKDAY ->
            WeekdayField(state.availableWeekdays, inputs.extraWeekday) {
                onInputsChange(inputs.copy(extraWeekday = it))
            }
        SimScenario.EXTRA_MONTH_DAYS ->
            NumberField(SimulationCopy.EXTRA_DAYS_LABEL, inputs.extraMonthDays) {
                onInputsChange(inputs.copy(extraMonthDays = it))
            }
        SimScenario.RATE ->
            NumberField(SimulationCopy.RATE_LABEL, inputs.targetRate) {
                onInputsChange(inputs.copy(targetRate = it))
            }
        SimScenario.MISSIONS ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                NumberField(SimulationCopy.MISSIONS_FRANCE_LABEL, inputs.missionsFrance) {
                    onInputsChange(inputs.copy(missionsFrance = it))
                }
                NumberField(SimulationCopy.MISSIONS_THIRD_LABEL, inputs.missionsThird) {
                    onInputsChange(inputs.copy(missionsThird = it))
                }
            }
    }
}

// "Quel jour en plus ?" - the weekdays not already a home day (CantonControl idiom: a labelled button opening a
// dropdown). The weekday names have one home in RythmeCopy.DAYS (R206).
@Composable
private fun WeekdayField(
    available: List<DayOfWeek>,
    selected: DayOfWeek?,
    onSelect: (DayOfWeek) -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = SimulationCopy.WEEKDAY_LABEL, style = FrontierType.bodyM)
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(text = selected?.let { RythmeCopy.DAYS[it.ordinal] } ?: SimulationCopy.WEEKDAY_LABEL)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            for (day in available) {
                DropdownMenuItem(
                    text = { Text(text = RythmeCopy.DAYS[day.ordinal]) },
                    onClick = {
                        onSelect(day)
                        expanded = false
                    },
                )
            }
        }
    }
}

// A labelled number field (the Parametres rate field idiom). The label floats, so the field carries its own
// accessible name for TalkBack.
@Composable
private fun NumberField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(text = label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
    )
}
