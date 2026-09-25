package ch.monreleve.app.design

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * DESIGN-SYSTEM.md section 1: "FONT: Inter everywhere (web + Android; Roboto
 * only as system fallback)."
 *
 * PARKED (see REPORT-AN1.txt / docs/android-skills.md): Inter ships as woff2 in
 * web/public/fonts, which Android's font-resource system does not load, and no
 * ttf/otf exists anywhere in this repository or its caches. Fetching one is a
 * missing-external-artefact decision (a licence, PHASE-4-PROTOCOL's PARK list)
 * this session does not make blind. FrontierFontFamily is the ONE seam: it is
 * FontFamily.Default today - the documented fallback, not a defect - and
 * becomes the bundled Inter family with TTF files under res/font/ the day
 * those files land, with every TextStyle below unchanged.
 */
val FrontierFontFamily: FontFamily = FontFamily.Default

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
 * Maps the nine-style DESIGN-SYSTEM scale onto Material3's Typography slots, so
 * MaterialTheme.typography.* never falls back to M3's default (Roboto-metric)
 * scale. displayLarge is the only slot given tabular numerals by default,
 * matching "large statistics only" - callers needing a tabular figure at
 * another size call .tabularNums() explicitly.
 */
val FrontierTypography =
    Typography(
        displayLarge = FrontierType.display.tabularNums(),
        headlineLarge = FrontierType.h1,
        headlineMedium = FrontierType.h2,
        headlineSmall = FrontierType.h3,
        bodyLarge = FrontierType.bodyL,
        bodyMedium = FrontierType.body,
        titleMedium = FrontierType.bodyM,
        labelLarge = FrontierType.caption,
        labelSmall = FrontierType.micro,
    )
