package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.OnboardingState

// AN-ONBOARD. A selectable card's text, bundled so ChoiceCard stays within detekt's parameter limit. The file
// is named for the data class (MatchingDeclarationName); the card composable lives beside it.
data class ChoiceCardText(
    val title: String,
    val description: String,
    val badge: String? = null,
)

/**
 * A selectable card: a radio, a title (with an optional "Bêta" badge) and a description - the shape the method,
 * period and mode steps draw. Selected = brand border tint; otherwise surface. The whole card is one tap
 * target. `content` renders extra fields inside the card (the exact-total input, the date button).
 */
@Composable
fun ChoiceCard(
    selected: Boolean,
    text: ChoiceCardText,
    onClick: () -> Unit,
    content: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    if (selected) LightColors.brandSoft else LightColors.surface,
                    RoundedCornerShape(Radius.lg),
                ).selectable(selected = selected, onClick = onClick)
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            RadioButton(selected = selected, onClick = onClick)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
                ) {
                    Text(text = text.title, style = FrontierType.bodyM, color = LightColors.textPrimary)
                    text.badge?.let { BetaBadge(it) }
                }
                Text(text = text.description, style = FrontierType.body, color = LightColors.textSecondary)
                content?.invoke()
            }
        }
    }
}

/**
 * R336 (AN-ONBOARD-2): the granularity step - whole days or half-days, two choice cards in the Méthode pattern.
 * Lives here beside ChoiceCard (its building block) rather than in OnboardingScreen.kt, which is at detekt's
 * per-file function limit. Stateless; every string is an OnboardingCopy constant (no-literal fence).
 */
@Composable
internal fun GranularityStep(
    state: OnboardingState,
    onGranularityChange: (GranularityChoice) -> Unit,
) {
    Text(text = OnboardingCopy.GRANULARITY_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    Text(text = OnboardingCopy.GRANULARITY_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
    ChoiceCard(
        selected = state.granularity == GranularityChoice.DAY,
        text = ChoiceCardText(OnboardingCopy.GRANULARITY_DAY, OnboardingCopy.GRANULARITY_DAY_DESC),
        onClick = { onGranularityChange(GranularityChoice.DAY) },
    )
    ChoiceCard(
        selected = state.granularity == GranularityChoice.HALF_DAY,
        text = ChoiceCardText(OnboardingCopy.GRANULARITY_HALF_DAY, OnboardingCopy.GRANULARITY_HALF_DAY_DESC),
        onClick = { onGranularityChange(GranularityChoice.HALF_DAY) },
    )
    InfoNote(text = OnboardingCopy.GRANULARITY_INFO)
}

/** The small "Bêta" pill the automatic-mode card carries. */
@Composable
private fun BetaBadge(label: String) {
    Box(
        modifier =
            Modifier
                .background(LightColors.brandSoft, RoundedCornerShape(Radius.pill))
                .padding(horizontal = Spacing.space8, vertical = Spacing.space4),
    ) {
        Text(text = label, style = FrontierType.caption, color = LightColors.brand)
    }
}
