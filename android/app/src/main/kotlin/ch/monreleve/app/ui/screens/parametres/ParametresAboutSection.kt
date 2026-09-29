package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.LegalPage

// AN12 increment 4 (FD9 « À propos »). The legal rows open web pages in the browser; the licences row opens the
// in-app licences screen (R280). R282: nothing here names a mode, a reminder or detection consent - a test
// asserts their absence over the copy. Stateless; every string from fr/.

@Composable
internal fun AboutSection(
    actions: ParametresActions,
    appVersion: String,
    onOpenLicences: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        SectionHeading(ParametresCopy.ABOUT_HEADING)
        AboutRow(ParametresCopy.PRIVACY_ROW) { actions.onOpenLegal(LegalPage.PRIVACY) }
        AboutRow(ParametresCopy.TERMS_ROW) { actions.onOpenLegal(LegalPage.TERMS) }
        AboutRow(ParametresCopy.LEGAL_ROW) { actions.onOpenLegal(LegalPage.LEGAL) }
        AboutRow(ParametresCopy.SOURCES_ROW) { actions.onOpenLegal(LegalPage.SOURCES) }
        AboutRow(ParametresCopy.LICENCES_ROW, onOpenLicences)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = ParametresCopy.VERSION_ROW, style = FrontierType.body, color = LightColors.textSecondary)
            Text(text = appVersion, style = FrontierType.bodyM)
        }
        Text(text = ParametresCopy.ABOUT_DISCLAIMER_1, style = FrontierType.caption, color = LightColors.textTertiary)
        Text(text = ParametresCopy.ABOUT_DISCLAIMER_2, style = FrontierType.caption, color = LightColors.textTertiary)
    }
}

@Composable
private fun AboutRow(
    label: String,
    onClick: () -> Unit,
) {
    OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(text = label)
    }
}
