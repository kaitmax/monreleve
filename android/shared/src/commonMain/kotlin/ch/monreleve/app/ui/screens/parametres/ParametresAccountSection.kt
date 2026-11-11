package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.text.formatDate
import ch.monreleve.app.parametres.SignOutPrompt

// AN12 increment 2, trimmed by AN-PARAMS. The shared section heading and the R295 sign-out confirmation. The old
// « Mes données » / « Compte » button sections were replaced by the settings list's rows (ParametresSections).
// Stateless (fence 5), every string from fr/.
//
// AN-POLISH (R440): THERE ARE NOW THREE SIGN-OUT STATES, not one. Sign-out wipes this device (R295), so it
// first tries to SEND what the server has not got - SignOutSendingDialog while that runs; then either the
// plain confirmation it has always been (nothing left), or SignOutStillPendingDialog, which NAMES the days
// that could not be sent and offers three ways out instead of one.

/** A section heading outside its content, in the FD9 caption style. Reused by every list section (R206). */
@Composable
internal fun SectionHeading(text: String) {
    Text(text = text, style = FrontierType.caption, color = LightColors.textSecondary)
}

/** R440: the three ways out of the sign-out confirmation, bundled so each dialog takes one parameter. */
internal class SignOutActions(
    val onRetry: () -> Unit,
    val onConfirm: () -> Unit,
    val onCancel: () -> Unit,
)

/**
 * AN-POLISH (R440): the bounded send is in flight. No buttons, because there is nothing to decide until the
 * attempt has an answer - and nothing has been discarded either way.
 *
 * IT CANNOT HANG. The controller bounds the send with SIGN_OUT_SYNC_TIMEOUT_MS, so this dialog has a ceiling
 * of a few seconds whatever the network does. onDismissRequest is empty, which means the BACK key does
 * nothing while it is up: deliberate, and bounded by that same ceiling, because a half-cancelled send that
 * left this dialog behind would be worse than a few seconds of waiting.
 */
@Composable
internal fun SignOutSendingDialog() {
    AlertDialog(
        onDismissRequest = {},
        title = { Text(text = ParametresCopy.SIGN_OUT_CONFIRM_TITLE) },
        text = { Text(text = ParametresCopy.SIGN_OUT_SENDING, style = FrontierType.body) },
        confirmButton = {},
    )
}

/**
 * The sign-out confirmation, in the state the send left it. EMPTY pendingDates means the server has
 * everything - the plain two-button confirmation PARKAN-27 shipped, unchanged. Otherwise the days that could
 * not be sent are NAMED, and « Réessayer » is offered before « Se déconnecter quand même ».
 */
@Composable
internal fun SignOutDialog(
    prompt: SignOutPrompt,
    actions: SignOutActions,
) {
    if (prompt.pendingDates.isEmpty()) {
        SignOutClearDialog(actions)
    } else {
        SignOutStillPendingDialog(prompt, actions)
    }
}

/** Nothing is left on the phone: the confirmation names the device wipe and nothing more (R295). */
@Composable
private fun SignOutClearDialog(actions: SignOutActions) {
    AlertDialog(
        onDismissRequest = actions.onCancel,
        title = { Text(text = ParametresCopy.SIGN_OUT_CONFIRM_TITLE) },
        text = { Text(text = ParametresCopy.SIGN_OUT_CONFIRM_BODY, style = FrontierType.body) },
        confirmButton = { Button(onClick = actions.onConfirm) { Text(text = ParametresCopy.SIGN_OUT) } },
        dismissButton = { TextButton(onClick = actions.onCancel) { Text(text = ParametresCopy.SIGN_OUT_CANCEL) } },
    )
}

/**
 * R440: the send ran and some days are still only on this phone. The warning names HOW MANY and WHICH DATES,
 * in the colour of a permanent loss, and the three actions are STACKED rather than laid in a row - three
 * buttons side by side do not survive 320 dp, let alone 320 dp at 200 % (R159's reasoning, on a dialog).
 *
 * The dates are formatted here because fr/format lives in :app and the copy in :shared; the JOINING is in
 * ParametresCopy.dateList, not a separator typed in a composable (fence 4) and not joinToString's default
 * (R345: a default is a setting nobody chose).
 */
@Composable
private fun SignOutStillPendingDialog(
    prompt: SignOutPrompt,
    actions: SignOutActions,
) {
    AlertDialog(
        onDismissRequest = actions.onCancel,
        title = { Text(text = ParametresCopy.SIGN_OUT_CONFIRM_TITLE) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                Text(text = ParametresCopy.SIGN_OUT_CONFIRM_BODY, style = FrontierType.body)
                Text(
                    text =
                        ParametresCopy.stillPendingWarning(
                            prompt.unsyncedDays,
                            ParametresCopy.dateList(prompt.pendingDates.map(::formatDate)),
                        ),
                    style = FrontierType.body,
                    color = LightColors.error,
                )
            }
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(Spacing.space8),
            ) {
                Button(onClick = actions.onRetry, modifier = Modifier.fillMaxWidth()) {
                    Text(text = ParametresCopy.SIGN_OUT_RETRY)
                }
                TextButton(onClick = actions.onConfirm, modifier = Modifier.fillMaxWidth()) {
                    Text(text = ParametresCopy.SIGN_OUT_ANYWAY)
                }
                TextButton(onClick = actions.onCancel, modifier = Modifier.fillMaxWidth()) {
                    Text(text = ParametresCopy.SIGN_OUT_CANCEL)
                }
            }
        },
    )
}
