package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresState

// AN-PARAMS. The work-setting EDIT SHEETS (SPEC 11.5 / FD9), one per « Situation professionnelle » row.
// Each is a standalone content composable (ParametresScreen wraps it in a ModalBottomSheet, the CalendarEditSheet
// idiom: a ModalBottomSheet's own scaffolding does not render reliably under Layoutlib, so the content is
// photographed directly). Each sheet carries: the setting's control, its explanation (the helper texts moved
// here from the old always-on screen), the « ces réglages recalculent l'année » warning - made concrete by
// R290's before/after when a save would move the year's rate - and its own Enregistrer / Annuler.
//
// ONE WAY OF SAVING (SPEC 11.5): the floating « Enregistrer les réglages » is gone. A sheet's controls bind
// LIVE to the controller's editing state (the same callbacks the old form used); « Enregistrer » runs save()
// (R290's before/after appears as the confirmation when the rate moves); « Annuler » reverts and writes
// nothing. The revert lives in ParametresScreen (it holds the committed snapshot). The chrome every sheet shares
// - the error, the in-flight flag, Enregistrer and Annuler - is bundled in EditSheetFrame, so each sheet stays
// at or below five parameters without a @Suppress the no-inline-string fence (Fence 4) forbids in ui/. The field
// LABELS reuse OnboardingCopy (R206 - the same fields the person set at onboarding); the sheet chrome reuses
// CalendarCopy's « Enregistrer » / « Annuler » (R206). The « Début d'activité » sheet lives in its own file
// (ParametresDateField) with the date picker. Stateless (fence 5); every string from fr/ (the no-literal fence).

@Composable
internal fun CantonSheetContent(
    canton: Canton?,
    frame: EditSheetFrame,
    onCantonChange: (Canton) -> Unit,
) {
    EditSheet(OnboardingCopy.CANTON_LABEL, frame) {
        CantonControl(canton, onCantonChange, enabled = !frame.saving)
        // R125 / the relay: the canton sheet keeps the hedged 1983-accord line that onboarding shows.
        Text(text = OnboardingCopy.CANTON_LIST_PROVISIONAL, style = FrontierType.caption)
    }
}

@Composable
internal fun RateSheetContent(
    value: String,
    frame: EditSheetFrame,
    onChange: (String) -> Unit,
) {
    EditSheet(OnboardingCopy.RATE_LABEL, frame) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(text = OnboardingCopy.RATE_LABEL) },
            singleLine = true,
            enabled = !frame.saving,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Text(text = OnboardingCopy.RATE_HINT, style = FrontierType.caption)
    }
}

@Composable
internal fun MethodSheetContent(
    state: ParametresState,
    frame: EditSheetFrame,
    onDenominatorChange: (DenominatorChoice) -> Unit,
    onExactTotalChange: (String) -> Unit,
) {
    EditSheet(OnboardingCopy.METHOD_LABEL, frame) {
        RadioRow(
            selected = state.denominator == DenominatorChoice.SIMPLIFIED240,
            label = OnboardingCopy.METHOD_SIMPLIFIED,
            enabled = !frame.saving,
            onClick = { onDenominatorChange(DenominatorChoice.SIMPLIFIED240) },
        )
        RadioRow(
            selected = state.denominator == DenominatorChoice.EXACT,
            label = OnboardingCopy.METHOD_EXACT,
            enabled = !frame.saving,
            onClick = { onDenominatorChange(DenominatorChoice.EXACT) },
        )
        Text(text = OnboardingCopy.METHOD_HELPER, style = FrontierType.caption)
        if (state.denominator == DenominatorChoice.EXACT) {
            OutlinedTextField(
                value = state.exactTotalWorkDays,
                onValueChange = onExactTotalChange,
                label = { Text(text = OnboardingCopy.EXACT_TOTAL_LABEL) },
                singleLine = true,
                enabled = !frame.saving,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
internal fun GranularitySheetContent(
    granularity: GranularityChoice,
    frame: EditSheetFrame,
    onChange: (GranularityChoice) -> Unit,
) {
    EditSheet(OnboardingCopy.GRANULARITY_LABEL, frame) {
        RadioRow(
            selected = granularity == GranularityChoice.DAY,
            label = OnboardingCopy.GRANULARITY_DAY,
            enabled = !frame.saving,
            onClick = { onChange(GranularityChoice.DAY) },
        )
        RadioRow(
            selected = granularity == GranularityChoice.HALF_DAY,
            label = OnboardingCopy.GRANULARITY_HALF_DAY,
            enabled = !frame.saving,
            onClick = { onChange(GranularityChoice.HALF_DAY) },
        )
    }
}

@Composable
private fun CantonControl(
    canton: Canton?,
    onCantonChange: (Canton) -> Unit,
    enabled: Boolean,
) {
    // AN-STATE (R310): the dropdown's open state survives a rebuild.
    var expanded by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text(text = canton?.let(CantonCopy::name) ?: OnboardingCopy.CANTON_PLACEHOLDER)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            Canton.entries.forEach { option ->
                DropdownMenuItem(
                    text = { Text(text = CantonCopy.name(option)) },
                    onClick = {
                        onCantonChange(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

// The common sheet scaffold: title, the field's control + its helper (the `body` slot), the « recalculates the
// year » warning common to every work setting, the error (if the last save in this sheet failed), then its own
// Enregistrer / Annuler. Scrolls, so a tall sheet (the method sheet with its exact-total field) stays reachable.
// Every sheet's chrome comes from one EditSheetFrame, so this is the single place the save/cancel wiring lives.
@Composable
internal fun EditSheet(
    title: String,
    frame: EditSheetFrame,
    body: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = title, style = FrontierType.h3)
        body()
        RecalcWarning()
        frame.error?.let { Text(text = it, style = FrontierType.body, color = LightColors.error) }
        Button(
            onClick = frame.onSave,
            enabled = !frame.saving,
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = if (frame.saving) ParametresCopy.SAVING else CalendarCopy.SHEET_SAVE)
        }
        OutlinedButton(onClick = frame.onCancel, enabled = !frame.saving, modifier = Modifier.fillMaxWidth()) {
            Text(text = CalendarCopy.SHEET_CANCEL)
        }
    }
}

// The « ces réglages recalculent l'année » warning, now where it belongs (inside the edit sheet) instead of an
// always-visible amber box that stopped reading as a warning. Soft-warning box; the words carry the meaning.
@Composable
private fun RecalcWarning() {
    Text(
        text = ParametresCopy.SITUATION_WARNING,
        style = FrontierType.caption,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.warningBg)
                .padding(Spacing.space12),
    )
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
