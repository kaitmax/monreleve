package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.Regime
import ch.monreleve.app.calc.regimeFor
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.OnboardingError
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingState

// AN5b increment 1. The manual-onboarding form (SPEC 11.1 manual path). Stateless: it reads an
// OnboardingState and calls back, never touching the session or the store (fence 5). Every string
// comes from OnboardingCopy (R238 / the no-literal fence). R282: no mode chooser, no reminder step -
// six calculation fields and nothing that names a mode this build does not have.

@Composable
fun OnboardingScreen(
    state: OnboardingState,
    actions: OnboardingActions,
    modifier: Modifier = Modifier,
) {
    val submitting = state.phase == OnboardingPhase.SUBMITTING
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = OnboardingCopy.TITLE, style = FrontierType.h1)
        Text(text = OnboardingCopy.INTRO, style = FrontierType.body)

        CantonField(state.canton, actions.onCantonChange, enabled = !submitting)
        RateField(state.employmentRate, actions.onEmploymentRateChange, enabled = !submitting)
        MethodField(state, actions.onDenominatorChange, actions.onExactTotalChange, enabled = !submitting)
        GranularityField(state.granularity, actions.onGranularityChange, enabled = !submitting)
        StartDateField(state.activityStartDate, actions.onActivityStartDateChange, enabled = !submitting)

        state.error?.let { ErrorText(errorCopy(it)) }
        if (state.phase == OnboardingPhase.NETWORK_ERROR) ErrorText(OnboardingCopy.ERROR_NETWORK)
        if (state.phase == OnboardingPhase.SESSION_ENDED) ErrorText(OnboardingCopy.ERROR_SESSION_ENDED)

        Button(onClick = actions.onSubmit, enabled = !submitting, modifier = Modifier.fillMaxWidth()) {
            Text(text = if (submitting) OnboardingCopy.SUBMITTING else OnboardingCopy.SUBMIT)
        }
    }
}

@Composable
private fun CantonField(
    canton: Canton?,
    onCantonChange: (Canton) -> Unit,
    enabled: Boolean,
) {
    // AN-STATE (R310): the dropdown's open state survives a rebuild (the entered values are kept by the controller).
    var expanded by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = OnboardingCopy.CANTON_LABEL, style = FrontierType.bodyM)
        OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text(text = canton?.name ?: OnboardingCopy.CANTON_PLACEHOLDER)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            Canton.entries.forEach { option ->
                DropdownMenuItem(
                    text = { Text(text = option.name) },
                    onClick = {
                        onCantonChange(option)
                        expanded = false
                    },
                )
            }
        }
        if (canton != null) {
            val consequence =
                if (regimeFor(canton) == Regime.RESIDENCE_1983) {
                    OnboardingCopy.CANTON_CONSEQUENCE_RESIDENCE
                } else {
                    OnboardingCopy.CANTON_CONSEQUENCE_SOURCE
                }
            Text(text = consequence, style = FrontierType.caption)
        }
        Text(text = OnboardingCopy.CANTON_LIST_PROVISIONAL, style = FrontierType.caption)
    }
}

@Composable
private fun RateField(
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(text = OnboardingCopy.RATE_LABEL) },
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Text(text = OnboardingCopy.RATE_HINT, style = FrontierType.caption)
    }
}

@Composable
private fun MethodField(
    state: OnboardingState,
    onDenominatorChange: (DenominatorChoice) -> Unit,
    onExactTotalChange: (String) -> Unit,
    enabled: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = OnboardingCopy.METHOD_LABEL, style = FrontierType.bodyM)
        RadioRow(
            selected = state.denominator == DenominatorChoice.SIMPLIFIED240,
            label = OnboardingCopy.METHOD_SIMPLIFIED,
            enabled = enabled,
            onClick = { onDenominatorChange(DenominatorChoice.SIMPLIFIED240) },
        )
        RadioRow(
            selected = state.denominator == DenominatorChoice.EXACT,
            label = OnboardingCopy.METHOD_EXACT,
            enabled = enabled,
            onClick = { onDenominatorChange(DenominatorChoice.EXACT) },
        )
        Text(text = OnboardingCopy.METHOD_HELPER, style = FrontierType.caption)
        if (state.denominator == DenominatorChoice.EXACT) {
            OutlinedTextField(
                value = state.exactTotalWorkDays,
                onValueChange = onExactTotalChange,
                label = { Text(text = OnboardingCopy.EXACT_TOTAL_LABEL) },
                singleLine = true,
                enabled = enabled,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun GranularityField(
    granularity: GranularityChoice,
    onChange: (GranularityChoice) -> Unit,
    enabled: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = OnboardingCopy.GRANULARITY_LABEL, style = FrontierType.bodyM)
        RadioRow(
            selected = granularity == GranularityChoice.DAY,
            label = OnboardingCopy.GRANULARITY_DAY,
            enabled = enabled,
            onClick = { onChange(GranularityChoice.DAY) },
        )
        RadioRow(
            selected = granularity == GranularityChoice.HALF_DAY,
            label = OnboardingCopy.GRANULARITY_HALF_DAY,
            enabled = enabled,
            onClick = { onChange(GranularityChoice.HALF_DAY) },
        )
    }
}

@Composable
private fun StartDateField(
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(text = OnboardingCopy.START_DATE_LABEL) },
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Text(text = OnboardingCopy.START_DATE_HINT, style = FrontierType.caption)
    }
}

@Composable
private fun RadioRow(
    selected: Boolean,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, enabled = enabled, onClick = onClick),
    ) {
        RadioButton(selected = selected, onClick = onClick, enabled = enabled)
        Text(text = label, style = FrontierType.body)
    }
}

@Composable
private fun ErrorText(message: String) {
    Text(text = message, style = FrontierType.body, color = MaterialTheme.colorScheme.error)
}

private fun errorCopy(error: OnboardingError): String =
    when (error) {
        OnboardingError.CANTON_MISSING -> OnboardingCopy.ERROR_CANTON_MISSING
        OnboardingError.RATE_INVALID -> OnboardingCopy.ERROR_RATE_INVALID
        OnboardingError.EXACT_TOTAL_MISSING -> OnboardingCopy.ERROR_EXACT_TOTAL_MISSING
        OnboardingError.EXACT_TOTAL_INVALID -> OnboardingCopy.ERROR_EXACT_TOTAL_INVALID
        OnboardingError.START_DATE_INVALID -> OnboardingCopy.ERROR_START_DATE_INVALID
        OnboardingError.PERIOD_INVALID -> OnboardingCopy.ERROR_PERIOD_INVALID
        OnboardingError.SAVE_REFUSED -> OnboardingCopy.ERROR_SAVE_REFUSED
    }
