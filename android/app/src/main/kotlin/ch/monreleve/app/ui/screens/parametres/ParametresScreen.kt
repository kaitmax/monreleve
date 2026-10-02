package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.RateChange
import ch.monreleve.app.parametres.SettingsError

// AN12 increment 1 (SPEC 11.5, FD9 A1). The settings form. Stateless (fence 5): it reads a ParametresState
// and calls back through ParametresActions, never touching the session or the store. Every string comes from
// fr/ (R238 / the no-literal fence); the six field labels reuse OnboardingCopy (R206) - the same fields, the
// same words. R282: five calculation fields, and nothing that names a mode this build does not have. The
// field editors live in ParametresFields.kt (same package), split so neither file carries too many functions.
//
// R290 - the consequential-change dialog. When the controller computes that a save would move the year's
// declarable rate, it exposes state.pendingRateChange; this screen shows the before and after (the device
// engine's own figures, formatted here, never typed) and asks before the change is written.

private const val PERCENT_DECIMALS = 2

@Composable
fun ParametresScreen(
    state: ParametresState,
    actions: ParametresActions,
    appVersion: String,
    modifier: Modifier = Modifier,
) {
    // A local sub-screen: the licences screen (R280) opens over Parametres and « Retour » returns. UI-only
    // navigation state, the same shape as a dropdown's expanded flag - it holds no data (fence 5).
    // AN-STATE (R310): rememberSaveable so a rebuild keeps the reader on the licences sub-screen.
    var showLicences by rememberSaveable { mutableStateOf(false) }
    if (showLicences) {
        LicencesScreen(onBack = { showLicences = false }, modifier = modifier)
        return
    }
    val busy = state.phase == ParametresPhase.SAVING
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = ParametresCopy.TITLE, style = FrontierType.h1)

        SectionHeading(ParametresCopy.SITUATION_HEADING)
        SituationWarning()

        CantonField(state.canton, actions.onCantonChange, enabled = !busy)
        RateField(state.employmentRate, actions.onEmploymentRateChange, enabled = !busy)
        MethodField(state, actions.onDenominatorChange, actions.onExactTotalChange, enabled = !busy)
        GranularityField(state.granularity, actions.onGranularityChange, enabled = !busy)
        StartDateField(state.activityStartDate, actions.onActivityStartDateChange, enabled = !busy)

        state.error?.let { ErrorText(errorCopy(it)) }
        if (state.phase == ParametresPhase.NETWORK_ERROR) ErrorText(OnboardingCopy.ERROR_NETWORK)
        if (state.phase == ParametresPhase.SESSION_ENDED) ErrorText(OnboardingCopy.ERROR_SESSION_ENDED)

        Button(onClick = actions.onSave, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text(text = if (busy) ParametresCopy.SAVING else ParametresCopy.SAVE)
        }

        if (state.phase == ParametresPhase.SAVED) {
            Text(text = ParametresCopy.SAVED_CONFIRMATION, style = FrontierType.bodyM, color = LightColors.success)
        }

        AutoDetectionSection(state.autoDetectionEnabled, actions.onToggleAutoDetection, enabled = !busy)

        DataSection(actions)
        DeleteRow(actions.onRequestDelete)
        AccountSection(actions)
        AboutSection(actions, appVersion, onOpenLicences = { showLicences = true })
    }

    state.pendingRateChange?.let { change ->
        RateChangeDialog(change, actions.onConfirmRateChange, actions.onCancelRateChange)
    }
    state.signOutPrompt?.let { prompt ->
        SignOutDialog(prompt, actions.onConfirmSignOut, actions.onCancelSignOut)
    }
    state.deletePrompt?.let { prompt ->
        DeleteDialog(prompt, actions)
    }
    state.deleteOutcome?.let { outcome ->
        DeleteOutcomeDialog(outcome, actions.onAcknowledgeDelete)
    }
}

// R315: « Détection automatique (beta) ». Opt-in, manual by default; a plain Switch, no confirmation dialog
// (SPEC 13). The description and beta note state that both modes produce the same relevé (D19 - manual is never
// the lesser option). The disclosure before the OS permission prompt is R316's (increment 3); this row records
// the person's consent and reflects the mode. Emits into the parent Column, like the other sections.
@Composable
private fun AutoDetectionSection(
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    enabled: Boolean,
) {
    SectionHeading(ParametresCopy.AUTO_HEADING)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = ParametresCopy.AUTO_LABEL, style = FrontierType.bodyM, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onToggle, enabled = enabled)
    }
    Text(text = ParametresCopy.AUTO_DESCRIPTION, style = FrontierType.caption, color = LightColors.textSecondary)
    Text(text = ParametresCopy.AUTO_BETA_NOTE, style = FrontierType.caption, color = LightColors.textSecondary)
    // R317: the honest battery-management note - no exemption asked, no system setting changed on their behalf.
    Text(text = ParametresCopy.AUTO_BATTERY_NOTE, style = FrontierType.caption, color = LightColors.textSecondary)
}

@Composable
private fun SituationWarning() {
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
private fun RateChangeDialog(
    change: RateChange,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(text = ParametresCopy.RATE_CHANGE_TITLE) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                Text(text = ParametresCopy.RATE_CHANGE_BODY, style = FrontierType.body)
                RateRow(ParametresCopy.RATE_CHANGE_BEFORE_LABEL, change.before)
                RateRow(ParametresCopy.RATE_CHANGE_AFTER_LABEL, change.after)
            }
        },
        confirmButton = { Button(onClick = onConfirm) { Text(text = ParametresCopy.RATE_CHANGE_CONFIRM) } },
        dismissButton = { TextButton(onClick = onCancel) { Text(text = ParametresCopy.RATE_CHANGE_CANCEL) } },
    )
}

// internal (not private) so ParametresDialogScreenshotTest can photograph it at 200 percent - the walkthrough
// found the value fragmenting there when both texts were unconstrained in a SpaceBetween Row (k-02).
@Composable
internal fun RateRow(
    label: String,
    rate: Double,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The label takes the flexible space and WRAPS at a large font scale; the value has no weight, so it
        // measures at its intrinsic width and stays intact on the right (never fragmented, R127/200 percent).
        Text(
            text = label,
            style = FrontierType.body,
            color = LightColors.textSecondary,
            modifier = Modifier.weight(1f),
        )
        // R181: the figure is DERIVED from the engine's rate, formatted here - never typed into copy.
        Text(text = formatPercent(rate, PERCENT_DECIMALS), style = FrontierType.bodyM, maxLines = 1)
    }
}

@Composable
private fun ErrorText(message: String) {
    Text(text = message, style = FrontierType.body, color = LightColors.error)
}

private fun errorCopy(error: SettingsError): String =
    when (error) {
        SettingsError.CANTON_MISSING -> OnboardingCopy.ERROR_CANTON_MISSING
        SettingsError.RATE_INVALID -> OnboardingCopy.ERROR_RATE_INVALID
        SettingsError.EXACT_TOTAL_MISSING -> OnboardingCopy.ERROR_EXACT_TOTAL_MISSING
        SettingsError.EXACT_TOTAL_INVALID -> OnboardingCopy.ERROR_EXACT_TOTAL_INVALID
        SettingsError.START_DATE_INVALID -> OnboardingCopy.ERROR_START_DATE_INVALID
        SettingsError.PERIOD_INVALID -> OnboardingCopy.ERROR_PERIOD_INVALID
        SettingsError.SAVE_REFUSED -> OnboardingCopy.ERROR_SAVE_REFUSED
        SettingsError.CHANGE_CONFLICTS_WITH_RECORD -> ParametresCopy.ERROR_CHANGE_CONFLICTS
    }
