package ch.monreleve.app.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * FrontierTheme WRAPS MaterialTheme (D37, DESIGN-SYSTEM.md section 4). Material
 * components are permitted and themed: every colour, shape and text style below
 * is a token from Tokens.kt or Typography.kt, never a Material default.
 *
 * LIGHT ONLY, DELIBERATELY (DESIGN-SYSTEM.md section 12 override): "Tokens
 * adopted; light ships first, dark after launch." DarkColors exists in
 * Tokens.kt so the values are ready, and is NOT referenced here - there is no
 * darkTheme parameter, so a caller cannot accidentally opt in. AN0's
 * edge-to-edge conflict (docs/android-skills.md 6.2) applies at the Activity
 * level: status/navigation bar appearance does not invert on system dark mode.
 *
 * CARD ELEVATION IS NOT SET HERE. Material3 has no theme-wide "default card
 * elevation" the way it has colorScheme/typography/shapes; DESIGN-SYSTEM's
 * "no shadow on cards" is enforced per call site (AN3's FrontierCard) and by
 * the increment-3 fence that scans ui/ for an unthemed Card().
 */
@Composable
fun FrontierTheme(content: @Composable () -> Unit) {
    val colorScheme =
        lightColorScheme(
            primary = LightColors.brand,
            onPrimary = LightColors.surface,
            primaryContainer = LightColors.franceSoft,
            onPrimaryContainer = LightColors.franceText,
            secondary = LightColors.brand,
            onSecondary = LightColors.surface,
            tertiary = LightColors.info,
            onTertiary = LightColors.surface,
            background = LightColors.canvas,
            onBackground = LightColors.textPrimary,
            surface = LightColors.surface,
            onSurface = LightColors.textPrimary,
            surfaceVariant = LightColors.surface,
            onSurfaceVariant = LightColors.textSecondary,
            outline = LightColors.borderDefault,
            outlineVariant = LightColors.borderStrong,
            error = LightColors.error,
            onError = LightColors.surface,
            errorContainer = LightColors.errorBg,
            onErrorContainer = LightColors.error,
        )

    val shapes =
        Shapes(
            extraSmall = RoundedCornerShape(Radius.xs),
            small = RoundedCornerShape(Radius.sm),
            medium = RoundedCornerShape(Radius.md),
            large = RoundedCornerShape(Radius.lg),
            extraLarge = RoundedCornerShape(Radius.xl),
        )

    MaterialTheme(
        colorScheme = colorScheme,
        typography = FrontierTypography,
        shapes = shapes,
        content = content,
    )
}
