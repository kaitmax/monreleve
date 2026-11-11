package ch.monreleve.app.ui.screens.disclosure

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.DisclosureCopy

// AN-AUTO increment 3b (R316 / D5 / SPEC 11.1 "Avant l'autorisation"). The prominent disclosure, shown BEFORE
// the OS permission prompt. Stateless (fence 5); every string from fr/ (the no-literal fence). It states the
// background USE plainly and that only one conclusion per day is kept (D18) - never "collecte". The two choices
// are equally weighted (D19): "Autoriser la localisation" and "Rester en saisie manuelle" are the same 56 dp
// height, neither diminished.

@Composable
fun DisclosureScreen(
    onAllow: () -> Unit,
    onStayManual: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = DisclosureCopy.TITLE, style = FrontierType.h2)
        Text(text = DisclosureCopy.USES_LOCATION, style = FrontierType.body)
        Text(text = DisclosureCopy.FOUR_TIMES, style = FrontierType.body)
        Text(text = DisclosureCopy.ON_DEVICE, style = FrontierType.body)
        Text(text = DisclosureCopy.NETWORK_LOCATION, style = FrontierType.body)
        Text(text = DisclosureCopy.WHAT_IS_KEPT, style = FrontierType.body)
        Text(text = DisclosureCopy.NEVER_SHARED, style = FrontierType.body)
        Text(
            text = DisclosureCopy.ANDROID_TEN_WARNING,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )

        // Both actions are the same 56 dp height and full width - equal weight (D19). "Autoriser" is filled,
        // "Rester en saisie manuelle" outlined; the difference is role, never prominence.
        Button(
            onClick = onAllow,
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = DisclosureCopy.ALLOW)
        }
        OutlinedButton(
            onClick = onStayManual,
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = DisclosureCopy.STAY_MANUAL)
        }
    }
}
