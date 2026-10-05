package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy

// AN-PARAMS. The two information sheets the settings list opens: « En savoir plus » (the full detection
// disclosure, relocated here VERBATIM) and the export chooser. In their own file so ParametresSections.kt stays
// under detekt's TooManyFunctions threshold. Stateless (fence 5); every string from fr/ (R238).

// « En savoir plus »: the full detection disclosure, relocated here VERBATIM (R282/R312/R317 honest disclosures
// are moved, never deleted; CopyReachabilityTest keeps each reachable, R238). The title is the switch's own label.
@Composable
internal fun LearnMoreSheetContent(onClose: () -> Unit) {
    SheetColumn {
        Text(text = ParametresCopy.AUTO_LABEL, style = FrontierType.h3)
        Text(text = ParametresCopy.AUTO_DESCRIPTION, style = FrontierType.body)
        Text(text = ParametresCopy.AUTO_BETA_NOTE, style = FrontierType.body, color = LightColors.textSecondary)
        Text(text = ParametresCopy.AUTO_BATTERY_NOTE, style = FrontierType.body, color = LightColors.textSecondary)
        OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.CLOSE)
        }
    }
}

// The export chooser: one « Exporter mes données » row opens this, offering the two documents (AC2) and the
// helper that names what they contain. Tapping either hands the server's render to the platform share sheet.
@Composable
internal fun ExportChooserContent(
    onExportJson: () -> Unit,
    onExportCsv: () -> Unit,
    onClose: () -> Unit,
) {
    SheetColumn {
        Text(text = ParametresCopy.DATA_EXPORT_ROW, style = FrontierType.h3)
        Text(text = ParametresCopy.EXPORT_HELPER, style = FrontierType.body)
        Button(
            onClick = {
                onExportJson()
                onClose()
            },
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = ParametresCopy.EXPORT_JSON)
        }
        OutlinedButton(onClick = {
            onExportCsv()
            onClose()
        }, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_CSV)
        }
        TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.CLOSE)
        }
    }
}

@Composable
private fun SheetColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
        content = content,
    )
}
