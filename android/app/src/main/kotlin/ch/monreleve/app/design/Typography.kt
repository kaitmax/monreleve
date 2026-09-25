package ch.monreleve.app.design

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * DESIGN-SYSTEM.md section 1: "All figures, percentages, dates and timestamps
 * use Inter with TABULAR NUMERALS (tnum) so columns align." Applied via the
 * OpenType feature, which a font advertises support for independently of which
 * family is loaded - Roboto (today's fallback) supports tnum too, so alignment
 * holds even before Inter is bundled. Apply to a figure with
 * `Typography.Display.tabularNums()`; base styles are NOT tabular by default
 * because most text (labels, prose) is not a figure.
 */
fun TextStyle.tabularNums(): TextStyle = copy(fontFeatureSettings = "tnum")

/** DESIGN-SYSTEM.md section 1 type scale: size/lineHeight/weight, in that order. */
object FrontierType {
    /** 48/56 600 - large statistics only (SPEC 11.2: the annualised rate hero). */
    val display =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 48.sp,
            lineHeight = 56.sp,
            fontWeight = FontWeight.SemiBold,
        )

    /** 32/40 700 */
    val h1 =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 32.sp,
            lineHeight = 40.sp,
            fontWeight = FontWeight.Bold,
        )

    /** 24/32 700 */
    val h2 =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 24.sp,
            lineHeight = 32.sp,
            fontWeight = FontWeight.Bold,
        )

    /** 20/28 600 */
    val h3 =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 20.sp,
            lineHeight = 28.sp,
            fontWeight = FontWeight.SemiBold,
        )

    /** 17/26 400 */
    val bodyL =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 17.sp,
            lineHeight = 26.sp,
            fontWeight = FontWeight.Normal,
        )

    /** 15/22 400 */
    val body =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 15.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Normal,
        )

    /** 15/22 500 */
    val bodyM =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 15.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Medium,
        )

    /** 13/18 400 */
    val caption =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.Normal,
        )

    /** 11/14 500 - sparingly (DESIGN-SYSTEM.md section 1). */
    val micro =
        TextStyle(
            fontFamily = FrontierFontFamily,
            fontSize = 11.sp,
            lineHeight = 14.sp,
            fontWeight = FontWeight.Medium,
        )
}

/**
 * Maps the nine-style DESIGN-SYSTEM scale onto ALL FIFTEEN of Material3's
 * Typography slots, so MaterialTheme.typography.* never falls back to M3's
 * default (Roboto-metric) scale on ANY slot - a component this project has not
 * built yet (M3 TopAppBar reads titleLarge; NavigationBar's label reads
 * labelMedium) would otherwise render Roboto-metric text nobody chose, and
 * silently switch families alone the day Inter lands on the nine slots that
 * were set. The nine styles are a CLOSED set (DESIGN-SYSTEM.md section 1); M3's
 * finer fifteen-slot grid reuses them rather than inventing a tenth size.
 * ThemeCensusTest.kt asserts every slot resolves to one of the nine.
 *
 * displayLarge is the only slot given tabular numerals by default, matching
 * "large statistics only" - callers needing a tabular figure at another size
 * call .tabularNums() explicitly.
 */
val FrontierTypography =
    Typography(
        displayLarge = FrontierType.display.tabularNums(),
        displayMedium = FrontierType.display,
        displaySmall = FrontierType.h1,
        headlineLarge = FrontierType.h1,
        headlineMedium = FrontierType.h2,
        headlineSmall = FrontierType.h3,
        titleLarge = FrontierType.h3,
        titleMedium = FrontierType.bodyM,
        titleSmall = FrontierType.bodyM,
        bodyLarge = FrontierType.bodyL,
        bodyMedium = FrontierType.body,
        bodySmall = FrontierType.caption,
        labelLarge = FrontierType.caption,
        labelMedium = FrontierType.micro,
        labelSmall = FrontierType.micro,
    )
