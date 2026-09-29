package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.SignOutPrompt

// AN12 increment 2. « Mes données » (export) and « Compte » (sign-out), split from ParametresScreen so the
// screen file stays small as increment 3 adds the deletion flow. Stateless (fence 5), every string from fr/.

/** A section heading outside its content, in the FD9 caption style. Reused by the settings section too (R206). */
@Composable
internal fun SectionHeading(text: String) {
    Text(text = text, style = FrontierType.caption, color = LightColors.textSecondary)
}

@Composable
internal fun DataSection(actions: ParametresActions) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        SectionHeading(ParametresCopy.DATA_HEADING)
        OutlinedButton(onClick = actions.onExportJson, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_JSON)
        }
        OutlinedButton(onClick = actions.onExportCsv, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_CSV)
        }
        Text(text = ParametresCopy.EXPORT_HELPER, style = FrontierType.caption)
    }
}

@Composable
internal fun AccountSection(actions: ParametresActions) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        SectionHeading(ParametresCopy.ACCOUNT_HEADING)
        OutlinedButton(onClick = actions.onRequestSignOut, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.SIGN_OUT)
        }
    }
}

@Composable
internal fun SignOutDialog(
    prompt: SignOutPrompt,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(text = ParametresCopy.SIGN_OUT_CONFIRM_TITLE) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                Text(text = ParametresCopy.SIGN_OUT_CONFIRM_BODY, style = FrontierType.body)
                // PARKAN-27: name the unsynced days that will be lost - only when there are any, and in the
                // colour of a permanent loss.
                if (prompt.unsyncedDays > 0) {
                    Text(
                        text = ParametresCopy.unsyncedWarning(prompt.unsyncedDays),
                        style = FrontierType.body,
                        color = LightColors.error,
                    )
                }
            }
        },
        confirmButton = { Button(onClick = onConfirm) { Text(text = ParametresCopy.SIGN_OUT) } },
        dismissButton = { TextButton(onClick = onCancel) { Text(text = ParametresCopy.SIGN_OUT_CANCEL) } },
    )
}
