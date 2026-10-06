package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.R
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.GapHeight
import ch.monreleve.app.ui.screens.onboarding.IconCircle
import ch.monreleve.app.ui.screens.onboarding.LogoMark
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton

// AN-ONBOARD. Bienvenue (design/onboarding/Main.dc.html), shown on a fresh install only. Logo + wordmark,
// the promise, three feature rows, and "Commencer". No string literal here (fence 4): all copy from fr/.

@Composable
fun WelcomeScreen(
    onStart: () -> Unit,
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
            Text(text = Fr.APP_NAME, style = FrontierType.h3, color = LightColors.brand)
            Text(text = WelcomeCopy.TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space16)) {
                Feature(R.drawable.ic_calendar_check, WelcomeCopy.FEATURE_RECORD_ICON, WelcomeCopy.FEATURE_RECORD)
                Feature(R.drawable.ic_file_text, WelcomeCopy.FEATURE_RELEVE_ICON, WelcomeCopy.FEATURE_RELEVE)
                Feature(R.drawable.ic_lock, WelcomeCopy.FEATURE_PRIVACY_ICON, WelcomeCopy.FEATURE_PRIVACY)
            }
            GapHeight(Spacing.space8)
        }
        BottomActions {
            PrimaryButton(label = WelcomeCopy.START, onClick = onStart)
        }
    }
}

@Composable
private fun Feature(
    iconRes: Int,
    iconDescription: String,
    text: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        IconCircle(iconRes = iconRes, contentDescription = iconDescription)
        Text(text = text, style = FrontierType.bodyL, color = LightColors.textPrimary)
    }
}
