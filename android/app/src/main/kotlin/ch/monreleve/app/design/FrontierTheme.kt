package ch.monreleve.app.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * EVERY ColorScheme slot Material3 defines, in two groups (ThemeCensusTest.kt
 * asserts the whole function's result never equals Material's own untethered
 * `lightColorScheme()` baseline on any slot - no Material default leaks
 * through, D37):
 *
 * DOCUMENTED - DESIGN-SYSTEM.md section 1 names these directly: primary,
 * background, surface, error and their "on"/container pairs, outline.
 *
 * DERIVED, NOT DOCUMENTED - M3's API surface is wider than the token block
 * (a tiered surfaceContainer* family, inverse* for snackbars, scrim). These
 * are conservatively derived FROM documented tokens - never a new colour, never
 * Material's baseline - so a component reads flat, undocumented-but-honest
 * values rather than Material's purple-tinted defaults. surfaceTint is
 * Color.Transparent: M3 uses it to tint elevated surfaces with primary, which
 * is the exact "default surface tint" DESIGN-SYSTEM.md section 14 forbids.
 */
internal fun frontierColorScheme(): ColorScheme =
    lightColorScheme(
        // --- documented ---
        primary = LightColors.brand,
        onPrimary = LightColors.surface,
        primaryContainer = LightColors.franceSoft,
        onPrimaryContainer = LightColors.franceText,
        secondary = LightColors.brand,
        onSecondary = LightColors.surface,
        secondaryContainer = LightColors.switzerlandSoft,
        onSecondaryContainer = LightColors.switzerlandText,
        tertiary = LightColors.info,
        onTertiary = LightColors.surface,
        tertiaryContainer = LightColors.infoBg,
        onTertiaryContainer = LightColors.info,
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
        // --- derived, not documented (see KDoc) ---
        surfaceTint = Color.Transparent,
        scrim = LightColors.textPrimary,
        inverseSurface = LightColors.textPrimary,
        inverseOnSurface = LightColors.surface,
        inversePrimary = LightColors.brand,
        surfaceBright = LightColors.surface,
        surfaceDim = LightColors.canvas,
        surfaceContainerLowest = LightColors.surface,
        surfaceContainerLow = LightColors.surface,
        surfaceContainer = LightColors.surface,
        surfaceContainerHigh = LightColors.surface,
        surfaceContainerHighest = LightColors.surface,
    )

/**
 * FrontierTheme WRAPS MaterialTheme (D37, DESIGN-SYSTEM.md section 4). Material
 * components are permitted and themed: every ColorScheme slot (frontierColorScheme,
 * all of them - ThemeCensusTest.kt proves it), every Typography slot (all
 * fifteen - see Typography.kt) and every Shapes slot below is a token, never a
 * Material default.
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
    val colorScheme = frontierColorScheme()

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
