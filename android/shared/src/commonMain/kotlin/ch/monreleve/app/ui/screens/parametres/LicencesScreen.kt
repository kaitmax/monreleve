package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.LicencesCopy

// AN12 increment 4 (R280, discharged). The licences screen: the ODbL attribution for the bundled Swiss-border
// polygon (shown now because the data ships now), alongside the open-source licences. A sub-screen of
// Parametres, opened by the « Licences » row and dismissed by « Retour » - no new Activity, no manifest change.
// Stateless (fence 5); every string from fr/.

@Composable
fun LicencesScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        OutlinedButton(onClick = onBack) { Text(text = LicencesCopy.BACK) }
        Text(text = LicencesCopy.TITLE, style = FrontierType.h1)

        SectionHeading(LicencesCopy.DATA_HEADING)
        Text(text = LicencesCopy.OSM_ATTRIBUTION, style = FrontierType.bodyM)
        Text(text = LicencesCopy.ODBL_BODY, style = FrontierType.body)
        Text(text = LicencesCopy.ODBL_LINK, style = FrontierType.caption, color = LightColors.textSecondary)

        SectionHeading(LicencesCopy.OSS_HEADING)
        Text(text = LicencesCopy.OSS_BODY, style = FrontierType.body)
        Text(text = LicencesCopy.APACHE_LINK, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}
