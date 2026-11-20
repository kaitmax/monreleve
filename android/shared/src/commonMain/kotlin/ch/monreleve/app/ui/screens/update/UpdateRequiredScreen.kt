package ch.monreleve.app.ui.screens.update

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.UpdateCopy
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.GapHeight
import ch.monreleve.app.ui.screens.onboarding.LogoMark
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton

// AN-FORCE-UPDATE (R1111). THE UPDATE SCREEN: shown IN PLACE OF the whole app when the server's minimum supported
// version is above this build's (update/MinimumVersion.kt decides; the activity hosts it inside AppRoot). A title, one
// sentence, one button - nothing else is reachable from it: no back arrow, no menu, no link. The button's action is
// the host's (Android opens the Play listing), so this screen holds no store address and no platform call.
// The welcome screen's treatment (logo, h1, the bottom action), so it reads as the app speaking, not an error page.
// No string literal here (fence 4): the words are UpdateCopy's, the logo's description Fr.LOGO's (R206).

/** The plain update screen: [UpdateCopy.TITLE], [UpdateCopy.BODY], and one button that calls [onUpdate]. */
@Composable
fun UpdateRequiredScreen(
    onUpdate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space20),
        ) {
            GapHeight(Spacing.space48)
            LogoMark(contentDescription = Fr.LOGO, diameter = Spacing.space48)
            Text(text = UpdateCopy.TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
            Text(text = UpdateCopy.BODY, style = FrontierType.bodyL, color = LightColors.textPrimary)
        }
        BottomActions {
            PrimaryButton(label = UpdateCopy.BUTTON, onClick = onUpdate)
        }
    }
}
