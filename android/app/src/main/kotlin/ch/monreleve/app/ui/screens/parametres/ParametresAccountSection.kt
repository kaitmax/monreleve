package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.SignOutPrompt

// AN12 increment 2, trimmed by AN-PARAMS. The shared section heading and the R295 sign-out confirmation. The old
// « Mes données » / « Compte » button sections were replaced by the settings list's rows (ParametresSections).
// Stateless (fence 5), every string from fr/.

/** A section heading outside its content, in the FD9 caption style. Reused by every list section (R206). */
@Composable
internal fun SectionHeading(text: String) {
    Text(text = text, style = FrontierType.caption, color = LightColors.textSecondary)
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
