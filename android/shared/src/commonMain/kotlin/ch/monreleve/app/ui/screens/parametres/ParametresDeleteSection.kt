package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.DELETE_CONFIRMATION
import ch.monreleve.app.parametres.DeleteOutcome
import ch.monreleve.app.parametres.DeletePrompt

// AN12 increment 3 (D11, R289, FD9 A2). The destructive account-deletion flow: a red row, a confirmation that
// names what is destroyed and requires the typed word, and the outcome afterwards. Stateless except the typed
// word, which is local to the open dialog (it must reset each time). Every string from fr/.

@Composable
internal fun DeleteDialog(
    prompt: DeletePrompt,
    actions: ParametresActions,
) {
    // AN-STATE (R310): the typed confirmation word survives a rebuild while the delete dialog is open (the
    // dialog itself is reopened by the controller's deleteOpen flag). Dismissing the dialog drops this slot, so
    // reopening it fresh starts empty.
    var typed by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = actions.onCancelDelete,
        title = { Text(text = ParametresCopy.DELETE_TITLE) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.space12),
            ) {
                DestructionList(prompt)
                Text(text = ParametresCopy.DELETE_IRREVERSIBLE, style = FrontierType.body, color = LightColors.error)
                Text(text = ParametresCopy.DELETE_EXPORT_OFFER, style = FrontierType.body)
                ExportOffer(actions)
                Text(text = ParametresCopy.deleteTypePrompt(DELETE_CONFIRMATION), style = FrontierType.bodyM)
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typed = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = actions.onConfirmDelete,
                enabled = typed == DELETE_CONFIRMATION,
                colors =
                    ButtonDefaults.buttonColors(containerColor = LightColors.error, contentColor = LightColors.surface),
            ) {
                Text(text = ParametresCopy.DELETE_CONFIRM)
            }
        },
        dismissButton = { TextButton(onClick = actions.onCancelDelete) { Text(text = ParametresCopy.DELETE_CANCEL) } },
    )
}

@Composable
private fun DestructionList(prompt: DeletePrompt) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = ParametresCopy.DELETE_INTRO, style = FrontierType.body)
        Text(text = ParametresCopy.deleteEntriesItem(prompt.recordedDays), style = FrontierType.body)
        Text(text = ParametresCopy.DELETE_ITEM_PROVENANCE, style = FrontierType.body)
        Text(text = ParametresCopy.DELETE_ITEM_RELEVE, style = FrontierType.body)
        Text(text = ParametresCopy.DELETE_ITEM_ACCOUNT, style = FrontierType.body)
        // R289: name the unsynced days that cannot be recovered, only when there are any.
        if (prompt.unsyncedDays > 0) {
            Text(
                text = ParametresCopy.unsyncedWarning(prompt.unsyncedDays),
                style = FrontierType.body,
                color = LightColors.error,
            )
        }
    }
}

@Composable
private fun ExportOffer(actions: ParametresActions) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        TextButton(onClick = actions.onExportJson, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_JSON)
        }
        TextButton(onClick = actions.onExportCsv, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_CSV)
        }
    }
}

@Composable
internal fun DeleteOutcomeDialog(
    outcome: DeleteOutcome,
    onAcknowledge: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onAcknowledge,
        title = { Text(text = outcomeTitle(outcome)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                Text(text = outcomeBody(outcome), style = FrontierType.body)
                if (outcome is DeleteOutcome.Done && outcome.alertSubscriptionRemains) {
                    Text(text = ParametresCopy.DELETE_ALERT_REMAINS, style = FrontierType.body)
                }
            }
        },
        confirmButton = { Button(onClick = onAcknowledge) { Text(text = outcomeAck(outcome)) } },
    )
}

private fun outcomeTitle(outcome: DeleteOutcome): String =
    when (outcome) {
        is DeleteOutcome.Done -> ParametresCopy.DELETE_DONE_TITLE
        DeleteOutcome.Refused, DeleteOutcome.Unknown -> ParametresCopy.DELETE_TITLE
    }

private fun outcomeBody(outcome: DeleteOutcome): String =
    when (outcome) {
        is DeleteOutcome.Done -> ParametresCopy.deleteDoneBody(outcome.removedEntries)
        DeleteOutcome.Refused -> ParametresCopy.DELETE_REFUSED
        DeleteOutcome.Unknown -> ParametresCopy.DELETE_UNKNOWN
    }

private fun outcomeAck(outcome: DeleteOutcome): String =
    when (outcome) {
        is DeleteOutcome.Done -> ParametresCopy.DELETE_DONE_ACK
        DeleteOutcome.Refused, DeleteOutcome.Unknown -> ParametresCopy.DELETE_ACK
    }
