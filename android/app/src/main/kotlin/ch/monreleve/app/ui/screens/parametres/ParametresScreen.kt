package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.RateChange
import ch.monreleve.app.parametres.SettingsError

// AN-PARAMS (SPEC 11.5, FD9). The settings screen, rebuilt as ONE clean list (ParametresSections) of Material 3
// rows grouped under section headers, with each « Situation professionnelle » setting edited in its own sheet
// (ParametresFields) and the floating « Enregistrer les réglages » gone. Presentation and navigation only - the
// controller, /api/v1/me, R290's before/after, R289/R295/R315 and the data model are unchanged (a HARD BOUNDARY).
//
// ONE WAY OF SAVING. A sheet's controls bind LIVE to the controller's editing state; « Enregistrer » runs
// save() and R290's before/after appears as the RateChangeDialog when the year's rate would move; « Annuler »
// (or dismissing the sheet) reverts the controller to the committed snapshot and writes nothing. The committed
// snapshot - the last SAVED values - is what the list rows display (so an in-flight edit never shows there) and
// what the revert restores; it is updated only when a save succeeds (phase SAVED).
//
// R310 (P6): an open edit sheet survives rotation and a background kill. `editing` is rememberSaveable; the
// in-progress edit itself lives in the controller's state, already persisted across both by ShellState's
// ParametresSnapshot. The shared title uses the four screens' header style (FrontierType.h2 - ReleveScreen's
// title and Aujourd'hui's greeting), down from the oversized h1 AN12 used.

private const val PERCENT_DECIMALS = 2

enum class EditTarget { CANTON, RATE, METHOD, GRANULARITY, START_DATE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParametresScreen(
    state: ParametresState,
    actions: ParametresActions,
    appVersion: String,
    modifier: Modifier = Modifier,
) {
    var showLicences by rememberSaveable { mutableStateOf(false) }
    if (showLicences) {
        LicencesScreen(onBack = { showLicences = false }, modifier = modifier)
        return
    }

    var editing by rememberSaveable { mutableStateOf<EditTarget?>(null) }
    var saveAttempted by rememberSaveable { mutableStateOf(false) }
    var showLearnMore by rememberSaveable { mutableStateOf(false) }
    var showExport by rememberSaveable { mutableStateOf(false) }

    // The committed (last SAVED) settings: what the rows show and what « Annuler » restores. Seeded from the
    // loaded state (== saved at first composition); updated only on a successful save. rememberSaveable so a
    // rebuild keeps the saved values while the controller keeps the in-flight edit (R310).
    var committed by rememberSaveable { mutableStateOf(committedOf(state)) }

    LaunchedEffect(state.phase) {
        if (state.phase == ParametresPhase.SAVED && editing != null) {
            committed = committedOf(state)
            editing = null
            saveAttempted = false
        }
    }

    val saving = state.phase == ParametresPhase.SAVING
    val sheetError = if (saveAttempted) sheetErrorFor(state) else null

    fun revertAndClose() {
        committed.canton?.let(actions.onCantonChange)
        actions.onEmploymentRateChange(committed.employmentRate)
        actions.onDenominatorChange(committed.denominator)
        actions.onExactTotalChange(committed.exactTotalWorkDays)
        actions.onGranularityChange(committed.granularity)
        actions.onActivityStartDateChange(committed.activityStartDate)
        actions.onCancelRateChange()
        editing = null
        saveAttempted = false
    }

    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = ParametresCopy.TITLE, style = FrontierType.h2)
        SituationSection(committed) {
            editing = it
            saveAttempted = false
        }
        SaisieSection(
            autoDetectionEnabled = state.autoDetectionEnabled,
            eveningNotificationEnabled = state.eveningNotificationEnabled,
            enabled = !saving,
            onToggleAuto = actions.onToggleAutoDetection,
            onToggleEvening = actions.onToggleEveningNotification,
            onLearnMore = { showLearnMore = true },
        )
        CompteSection(onSignOut = actions.onRequestSignOut)
        DonneesSection(onExport = { showExport = true }, onDelete = actions.onRequestDelete)
        AProposSection(appVersion, actions.onOpenLegal, onOpenLicences = { showLicences = true })
    }

    ParametresOverlays(
        editing = editing,
        state = state,
        actions = actions,
        saving = saving,
        sheetError = sheetError,
        showLearnMore = showLearnMore,
        showExport = showExport,
        onSave = {
            saveAttempted = true
            actions.onSave()
        },
        onCancel = { revertAndClose() },
        onDismissLearnMore = { showLearnMore = false },
        onDismissExport = { showExport = false },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Suppress("LongParameterList")
@Composable
private fun ParametresOverlays(
    editing: EditTarget?,
    state: ParametresState,
    actions: ParametresActions,
    saving: Boolean,
    sheetError: String?,
    showLearnMore: Boolean,
    showExport: Boolean,
    onSave: () -> Unit,
    onCancel: () -> Unit,
    onDismissLearnMore: () -> Unit,
    onDismissExport: () -> Unit,
) {
    editing?.let { target ->
        ModalBottomSheet(onDismissRequest = onCancel, sheetState = rememberModalBottomSheetState()) {
            EditSheetBody(target, state, actions, saving, sheetError, onSave, onCancel)
        }
    }
    if (showLearnMore) {
        ModalBottomSheet(onDismissRequest = onDismissLearnMore, sheetState = rememberModalBottomSheetState()) {
            LearnMoreSheetContent(onClose = onDismissLearnMore)
        }
    }
    if (showExport) {
        ModalBottomSheet(onDismissRequest = onDismissExport, sheetState = rememberModalBottomSheetState()) {
            ExportChooserContent(actions.onExportJson, actions.onExportCsv, onClose = onDismissExport)
        }
    }

    state.pendingRateChange?.let { change ->
        RateChangeDialog(change, actions.onConfirmRateChange, actions.onCancelRateChange)
    }
    state.signOutPrompt?.let { prompt ->
        SignOutDialog(prompt, actions.onConfirmSignOut, actions.onCancelSignOut)
    }
    state.deletePrompt?.let {
        DeleteDialog(it, actions)
    }
    state.deleteOutcome?.let { outcome ->
        DeleteOutcomeDialog(outcome, actions.onAcknowledgeDelete)
    }
}

@Suppress("LongParameterList")
@Composable
private fun EditSheetBody(
    target: EditTarget,
    state: ParametresState,
    actions: ParametresActions,
    saving: Boolean,
    error: String?,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    when (target) {
        EditTarget.CANTON ->
            CantonSheetContent(state.canton, error, saving, actions.onCantonChange, onSave, onCancel)
        EditTarget.RATE ->
            RateSheetContent(state.employmentRate, error, saving, actions.onEmploymentRateChange, onSave, onCancel)
        EditTarget.METHOD ->
            MethodSheetContent(
                state,
                error,
                saving,
                actions.onDenominatorChange,
                actions.onExactTotalChange,
                onSave,
                onCancel,
            )
        EditTarget.GRANULARITY ->
            GranularitySheetContent(state.granularity, error, saving, actions.onGranularityChange, onSave, onCancel)
        EditTarget.START_DATE ->
            StartDateSheetContent(state.activityStartDate, error, saving, actions.onActivityStartDateChange, onSave, onCancel)
    }
}

private fun committedOf(state: ParametresState): CommittedSettings =
    CommittedSettings(
        canton = state.canton,
        employmentRate = state.employmentRate,
        denominator = state.denominator,
        exactTotalWorkDays = state.exactTotalWorkDays,
        granularity = state.granularity,
        activityStartDate = state.activityStartDate,
    )

private fun sheetErrorFor(state: ParametresState): String? =
    when {
        state.error != null -> errorCopy(state.error)
        state.phase == ParametresPhase.NETWORK_ERROR -> OnboardingCopy.ERROR_NETWORK
        state.phase == ParametresPhase.SESSION_ENDED -> OnboardingCopy.ERROR_SESSION_ENDED
        else -> null
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
