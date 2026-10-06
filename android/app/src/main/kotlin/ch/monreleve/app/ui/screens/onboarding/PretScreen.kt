package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.onboarding.readyMethod
import ch.monreleve.app.onboarding.readyPeriod
import ch.monreleve.app.onboarding.readyRate
import ch.monreleve.app.settings.Settings

// AN-ONBOARD. "Tout est prêt" (design/onboarding/Pret). The relevé's identification block, built from the
// values just saved (R181: shown, never a second source). The operator edit: the button reads "Continuer"
// and leads to Aujourd'hui. Stateless; no string literal (fence 4) - every value is from a fr constant or a
// non-composable helper (OnboardingDates).

@Composable
fun PretScreen(
    settings: Settings,
    taxYear: Int,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cantonName = Canton.entries.find { it.name == settings.canton }?.let { CantonCopy.name(it) } ?: settings.canton
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space20),
        ) {
            GapHeight(Spacing.space24)
            LogoMark(contentDescription = Fr.LOGO, diameter = Spacing.space48)
            Text(text = OnboardingCopy.READY_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
            Text(text = OnboardingCopy.READY_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .background(LightColors.surface, RoundedCornerShape(Radius.lg))
                        .padding(Spacing.space16),
                verticalArrangement = Arrangement.spacedBy(Spacing.space12),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = ReleveCopy.TITLE, style = FrontierType.caption, color = LightColors.textSecondary)
                    Text(text = taxYear.toString(), style = FrontierType.bodyM, color = LightColors.brand)
                }
                SummaryRow(OnboardingCopy.TITULAIRE, settings.name ?: "")
                SummaryRow(OnboardingCopy.READY_ROW_CANTON, cantonName)
                SummaryRow(ReleveCopy.HEADER_EMPLOYMENT_RATE, readyRate(settings.employmentRate))
                SummaryRow(OnboardingCopy.READY_ROW_METHOD, readyMethod(settings.denominatorKind))
                SummaryRow(OnboardingCopy.READY_ROW_PERIOD, readyPeriod(settings.activityStartDate, taxYear))
            }
            Text(text = OnboardingCopy.READY_NOTE, style = FrontierType.caption, color = LightColors.textSecondary)
        }
        BottomActions {
            PrimaryButton(label = OnboardingCopy.CONTINUE, onClick = onContinue)
        }
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space16)) {
        Text(text = label, style = FrontierType.body, color = LightColors.textSecondary, modifier = Modifier.weight(1f))
        Text(text = value, style = FrontierType.bodyM, color = LightColors.textPrimary, textAlign = TextAlign.End)
    }
}
