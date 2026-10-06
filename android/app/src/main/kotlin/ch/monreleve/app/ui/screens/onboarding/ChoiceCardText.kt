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
                    if (selected) BrandCircle else LightColors.surface,
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

/** The small "Bêta" pill the automatic-mode card carries. */
@Composable
private fun BetaBadge(label: String) {
    Box(
        modifier =
            Modifier
                .background(BrandCircle, RoundedCornerShape(Radius.pill))
                .padding(horizontal = Spacing.space8, vertical = Spacing.space4),
    ) {
        Text(text = label, style = FrontierType.caption, color = LightColors.brand)
    }
}
