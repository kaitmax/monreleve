package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.SettingsError

// AN-PARAMS (SPEC 11.5, FD9). The settings screen, rebuilt as ONE clean list (ParametresSettingsColumn) of
// Material 3 rows grouped under section headers, with each « Situation professionnelle » setting edited in its
// own sheet (ParametresFields) and the floating « Enregistrer les réglages » gone. Presentation and navigation
// only - the controller, /api/v1/me, R290's before/after, R289/R295/R315 and the data model are unchanged (a
// HARD BOUNDARY).
//
// ONE WAY OF SAVING. A sheet's controls bind LIVE to the controller's editing state; « Enregistrer » runs
// save() and R290's before/after appears as the RateChangeDialog when the year's rate would move; « Annuler »
// (or dismissing the sheet) reverts the controller to the committed snapshot and writes nothing. The committed
// snapshot - the last SAVED values - is what the list rows display (so an in-flight edit never shows there) and
// what the revert restores; it is updated only when a save succeeds (phase SAVED). The chrome each sheet shares
// (the error, the in-flight flag, Enregistrer and Annuler) is bundled in EditSheetFrame so no composable needs a
// @Suppress the no-inline-string fence (Fence 4) forbids in ui/.
//
// R310 (P6): an open edit sheet survives rotation and a background kill. `editing` is rememberSaveable; the
// in-progress edit itself lives in the controller's state, already persisted across both by ShellState's
// ParametresSnapshot. The shared title uses the four screens' header style (FrontierType.h2 - ReleveScreen's
// title and Aujourd'hui's greeting), down from the oversized h1 AN12 used.

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
    // committed = the last SAVED settings, what the rows show and what « Annuler » restores; updated only on a
    // successful save. rememberSaveable so a rebuild keeps it while the controller keeps the in-flight edit (R310).
    var committed by rememberSaveable { mutableStateOf(committedOf(state)) }

    LaunchedEffect(state.phase) {
        if (state.phase == ParametresPhase.SAVED && editing != null) {
            committed = committedOf(state)
            editing = null
            saveAttempted = false
        }
    }

    val frame =
        EditSheetFrame(
            error = if (saveAttempted) sheetErrorFor(state) else null,
            saving = state.phase == ParametresPhase.SAVING,
            onSave = {
                saveAttempted = true
                actions.onSave()
            },
            onCancel = {
                revertTo(committed, actions)
                editing = null
                saveAttempted = false
            },
        )
    val callbacks =
        ParametresListCallbacks(
            onEdit = {
                editing = it
                saveAttempted = false
            },
            onLearnMore = { showLearnMore = true },
            onExport = { showExport = true },
            onOpenLicences = { showLicences = true },
        )
    val info = InfoSheets(showLearnMore, showExport, { showLearnMore = false }, { showExport = false })

    ParametresSettingsColumn(committed, state, actions, appVersion, callbacks)
    ParametresOverlays(editing, state, actions, frame, info)
}

// The scrollable list. It does not take a `modifier` - the one caller (MainActivity) passes none, the host shell
// owns the screen's padding, and ParametresScreen's own `modifier` still reaches the LicencesScreen branch - so
// adding it here would only be a sixth parameter the no-inline-string fence then forces a @Suppress for in ui/.
@Composable
internal fun ParametresSettingsColumn(
    committed: CommittedSettings,
    state: ParametresState,
    actions: ParametresActions,
    appVersion: String,
    callbacks: ParametresListCallbacks,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = ParametresCopy.TITLE, style = FrontierType.h2)
        SituationSection(committed, callbacks.onEdit, actions.onOpenRhythm)
        SaisieSection(state, actions, callbacks.onLearnMore)
        CompteSection(onSignOut = actions.onRequestSignOut)
        DonneesSection(onExport = callbacks.onExport, onDelete = actions.onRequestDelete)
        AProposSection(appVersion, actions.onOpenLegal, onOpenLicences = callbacks.onOpenLicences)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ParametresOverlays(
    editing: EditTarget?,
    state: ParametresState,
    actions: ParametresActions,
    frame: EditSheetFrame,
    info: InfoSheets,
) {
    editing?.let { target ->
        ModalBottomSheet(onDismissRequest = frame.onCancel, sheetState = rememberModalBottomSheetState()) {
            EditSheetBody(target, state, actions, frame)
        }
    }
    if (info.showLearnMore) {
        ModalBottomSheet(onDismissRequest = info.onDismissLearnMore, sheetState = rememberModalBottomSheetState()) {
            LearnMoreSheetContent(onClose = info.onDismissLearnMore)
        }
    }
    if (info.showExport) {
        ModalBottomSheet(onDismissRequest = info.onDismissExport, sheetState = rememberModalBottomSheetState()) {
            ExportChooserContent(actions.onExportJson, actions.onExportCsv, onClose = info.onDismissExport)
        }
    }

    state.pendingRateChange?.let { change ->
        RateChangeDialog(change, actions.onConfirmRateChange, actions.onCancelRateChange)
    }
    // AN-POLISH (R440): sign-out is sending the pending days before it discards anything. The sending
    // dialog comes first because the prompt is null while it runs - the two are never on screen together.
    if (state.signOutSending) SignOutSendingDialog()
    state.signOutPrompt?.let { prompt ->
        SignOutDialog(
            prompt,
            SignOutActions(actions.onRetrySignOutSync, actions.onConfirmSignOut, actions.onCancelSignOut),
        )
    }
    state.deletePrompt?.let {
        DeleteDialog(it, actions)
    }
    state.deleteOutcome?.let { outcome ->
        DeleteOutcomeDialog(outcome, actions.onAcknowledgeDelete)
    }
}

@Composable
private fun EditSheetBody(
    target: EditTarget,
    state: ParametresState,
    actions: ParametresActions,
    frame: EditSheetFrame,
) {
    when (target) {
        EditTarget.CANTON -> CantonSheetContent(state.canton, frame, actions.onCantonChange)
        EditTarget.RATE -> RateSheetContent(state.employmentRate, frame, actions.onEmploymentRateChange)
        EditTarget.METHOD ->
            MethodSheetContent(state, frame, actions.onDenominatorChange, actions.onExactTotalChange)
        EditTarget.GRANULARITY ->
            GranularitySheetContent(state.granularity, frame, actions.onGranularityChange)
        EditTarget.START_DATE ->
            StartDateSheetContent(state.activityStartDate, frame, actions.onActivityStartDateChange)
    }
}

// « Annuler » restores the controller to the committed (last SAVED) snapshot and clears any pending before/after.
// Setting `editing`/`saveAttempted` is the caller's (it owns those), so this is a plain function, not a composable.
private fun revertTo(
    committed: CommittedSettings,
    actions: ParametresActions,
) {
    committed.canton?.let(actions.onCantonChange)
    actions.onEmploymentRateChange(committed.employmentRate)
    actions.onDenominatorChange(committed.denominator)
    actions.onExactTotalChange(committed.exactTotalWorkDays)
    actions.onGranularityChange(committed.granularity)
    actions.onActivityStartDateChange(committed.activityStartDate)
    actions.onCancelRateChange()
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
