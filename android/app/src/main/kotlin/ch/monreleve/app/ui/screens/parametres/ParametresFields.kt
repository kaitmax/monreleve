package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresState

// AN12 increment 1. The five calculation-field editors for the Parametres form, split from ParametresScreen
// so neither file carries too many functions as the screen grows across increments (export, sign-out,
// deletion, legal). Same fields and the same OnboardingCopy labels (R206) as the onboarding form - the person
// is editing exactly what they set there. Stateless (fence 5), every string from fr/ (the no-literal fence).

@Composable
internal fun CantonField(
    canton: Canton?,
    onCantonChange: (Canton) -> Unit,
    enabled: Boolean,
) {
    var expanded by remember { mutableStateOf(false) }
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
    }
}

@Composable
internal fun RateField(
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
internal fun MethodField(
    state: ParametresState,
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
internal fun GranularityField(
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
internal fun StartDateField(
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
