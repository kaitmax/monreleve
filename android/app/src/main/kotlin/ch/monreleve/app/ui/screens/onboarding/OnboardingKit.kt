package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import ch.monreleve.app.R
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing

// AN-ONBOARD. The shared vocabulary for the welcome, sign-in and onboarding screens, built from the
// approved mockups (design/onboarding/*.dc.html) on tokens only. No string literal lives here (fence 4):
// every label is a parameter the caller passes from fr/.
//
// TOKEN NOTES (reported):
// - The mockups' CTA buttons are full pills (border-radius 999), so the large primary uses Radius.pill.
//   DESIGN-SYSTEM §1's generic "large primary radius 14" is overridden by the operator-approved mockups
//   for these onboarding screens; Radius.pill is an exact token, so this is a component-mapping choice,
//   not a raw value.
// - The icon-circle background (#EAF0F7 in the mockups) has no token; it is the brand at a low alpha, a
//   derived brand tint rather than a new colour (PARKAN-42).

/** The mockups' #EAF0F7 icon-circle fill: a faint brand tint (PARKAN-42 - no "brand soft" token yet). */
val BrandCircle: Color = LightColors.brand.copy(alpha = 0.08f)

/** The large primary action (56 dp, pill, brand fill) the mockups use for "Continuer" / "Commencer". */
@Composable
fun PrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(Radius.pill),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = LightColors.brand,
                contentColor = LightColors.surface,
            ),
        modifier = modifier.fillMaxWidth().height(Size.buttonLarge),
    ) {
        Text(text = label, style = FrontierType.bodyM)
    }
}

/** The secondary action (outline pill) - "Ouvrir ma messagerie". */
@Composable
fun SecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(Radius.pill),
        border = BorderStroke(Size.rule, LightColors.brand),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = LightColors.brand),
        modifier = modifier.fillMaxWidth().height(Size.buttonLarge),
    ) {
        Text(text = label, style = FrontierType.bodyM)
    }
}

/** A text-only tertiary action - "Pas maintenant". */
@Composable
fun TertiaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Text(text = label, style = FrontierType.bodyM, color = LightColors.brand)
    }
}

/** A round brand-tinted circle holding a glyph, as the mockups draw their feature and header icons. */
@Composable
fun IconCircle(
    iconRes: Int,
    contentDescription: String,
    modifier: Modifier = Modifier,
    diameter: androidx.compose.ui.unit.Dp = Spacing.space48,
    iconSize: androidx.compose.ui.unit.Dp = Spacing.space24,
) {
    Box(
        modifier = modifier.size(diameter).background(BrandCircle, RoundedCornerShape(Radius.pill)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = LightColors.brand,
            modifier = Modifier.size(iconSize),
        )
    }
}

/** The back arrow at the top left of every screen after the welcome. */
@Composable
fun BackButton(
    contentDescription: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconButton(onClick = onBack, modifier = modifier.size(Spacing.space48)) {
        Icon(
            painter = painterResource(R.drawable.ic_chevron_left),
            contentDescription = contentDescription,
            tint = LightColors.brand,
            modifier = Modifier.size(Spacing.space24),
        )
    }
}

/** The 7-segment step progress bar + "Étape N sur 7" label, as the onboarding steps draw it. */
@Composable
fun StepProgress(
    step: Int,
    total: Int,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space4), modifier = Modifier.fillMaxWidth()) {
            repeat(total) { index ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(Spacing.space4)
                            .background(
                                if (index < step) LightColors.brand else LightColors.borderDefault,
                                RoundedCornerShape(Radius.pill),
                            ),
                )
            }
        }
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}

/** An info line (info glyph + muted text), as every step's footnote draws it. */
@Composable
fun InfoNote(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Icon(
            painter = painterResource(R.drawable.ic_info),
            contentDescription = null,
            tint = LightColors.textSecondary,
            modifier = Modifier.size(Spacing.space20).clearAndSetSemantics {},
        )
        Text(text = text, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}

/** The brand mark image (Bienvenue, Connexion, Tout est prêt). */
@Composable
fun LogoMark(
    contentDescription: String,
    modifier: Modifier = Modifier,
    diameter: androidx.compose.ui.unit.Dp = Spacing.space48,
) {
    Icon(
        painter = painterResource(R.drawable.ic_logo_mark),
        contentDescription = contentDescription,
        tint = Color.Unspecified,
        modifier = modifier.size(diameter),
    )
}

/** The screen's bottom action area, pinned under the scrolling content. */
@Composable
fun BottomActions(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.space24, vertical = Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        content()
    }
}

/** A thin spacer helper to match the mockups' baseline gaps without a raw dp in a screen. */
@Composable
fun GapHeight(dp: androidx.compose.ui.unit.Dp) {
    Spacer(modifier = Modifier.height(dp))
}
