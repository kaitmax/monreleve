package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.format.formatDeclarableRate
import ch.monreleve.app.parametres.RateChange

// AN-PARAMS. R290's « cette modification recalcule votre année » confirmation: shown BEFORE a consequential save
// when the year's declarable rate would move, with the two figures the DEVICE ENGINE computes (R181 - derived,
// never typed). In its own file so ParametresScreen.kt stays under detekt's TooManyFunctions threshold. Stateless;
// every string from fr/ (R238). The names and behaviour are unchanged from AN12 (a HARD BOUNDARY) - this moved,
// it did not change.

@Composable
internal fun RateChangeDialog(
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
        Text(text = formatDeclarableRate(rate), style = FrontierType.bodyM, maxLines = 1)
    }
}
