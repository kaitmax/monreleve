package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// DESIGN-SYSTEM.md section 1, as Kotlin. The single source for every radius,
// colour and spacing value in ui/ (SPEC 5 / D37). No other file defines one.

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
 * those files land, with every TextStyle in Typography.kt unchanged.
 *
 * LIVES HERE, NOT IN Typography.kt, DELIBERATELY. FrontierType's styles need
 * this value; Typography.kt's FrontierTypography needs FrontierType's styles.
 * Declaring it alongside FrontierType in the same file created a genuine
 * circular static initializer (FrontierType.<clinit> -> TypographyKt.<clinit>
 * -> FrontierType.display, read before FrontierType finished initialising ->
 * NPE) - caught by ThemeCensusTest.kt's first run, not reasoned out in advance.
 */
val FrontierFontFamily: FontFamily = FontFamily.Default

/**
 * The radius scale: a closed set of NINE token names, never arbitrary
 * (DESIGN-SYSTEM 4.1 / ruling R8). A test asserts each value below and that no
 * other radius token exists - the web project's two-sided enforcement (token
 * names at the point of use; the closed numeric set at the point of
 * definition), ported. Component mapping lives in DESIGN-SYSTEM 1, not as a
 * second set of aliases here - an alias would be a tenth name.
 */
object Radius {
    // THE ONE SOURCE. Named vals below are DERIVED from this map, never typed
    // independently, so they cannot disagree with it - and the closed-set test
    // (RadiusTest.kt) asserts against this map directly. No reflection, no new
    // dependency (kotlin-reflect) for what a map already gives for free.
    private val tokens: Map<String, Dp> =
        mapOf(
            "xs" to 4.dp,
            "checkbox" to 6.dp,
            "sm" to 8.dp,
            "md" to 12.dp,
            "buttonLg" to 14.dp,
            "lg" to 16.dp,
            "xl" to 20.dp,
            "xxl" to 24.dp,
            "pill" to 999.dp,
        )

    val xs: Dp = tokens.getValue("xs")
    val checkbox: Dp = tokens.getValue("checkbox")
    val sm: Dp = tokens.getValue("sm")
    val md: Dp = tokens.getValue("md")
    val buttonLg: Dp = tokens.getValue("buttonLg")
    val lg: Dp = tokens.getValue("lg")
    val xl: Dp = tokens.getValue("xl")
    val xxl: Dp = tokens.getValue("xxl")
    val pill: Dp = tokens.getValue("pill")

    // IOS-1b-A R603: public, not internal - RadiusTest in :app reads it across the module boundary.

    /** For RadiusTest.kt only (R8 ported) - never referenced by ui/ code. */
    val allForTest: Map<String, Dp> get() = tokens
}

/** The 4 dp spacing scale (DESIGN-SYSTEM 1). No spacing value off this scale in ui/. */
object Spacing {
    val space4: Dp = 4.dp
    val space8: Dp = 8.dp
    val space12: Dp = 12.dp
    val space16: Dp = 16.dp
    val space20: Dp = 20.dp
    val space24: Dp = 24.dp
    val space28: Dp = 28.dp
    val space32: Dp = 32.dp
    val space40: Dp = 40.dp
    val space48: Dp = 48.dp
    val space64: Dp = 64.dp
    val space80: Dp = 80.dp
}

/** Card elevation is zero, everywhere, by contract (D37 / DESIGN-SYSTEM "SHADOWS: none on cards"). */
object Elevation {
    val none: Dp = 0.dp
}

/**
 * Component sizes - a token category ported from the web's R62 SIZE family
 * (`$size-button-large-height` etc.), distinct from Radius (corners), Spacing
 * (padding/gaps), Elevation and Breakpoints. R285 answers PARKAN-16, which parked
 * the day's record buttons at the 48 dp touch target pending this: SPEC 11.2 names
 * 56 dp for the day's primary action button, and R77 (a token whose value already
 * appears in a brief needs no separate value ruling) covers the 56. Ratified in
 * DESIGN-SYSTEM section 1, the R272 Breakpoints precedent for an Android token.
 */
object Size {
    /** SPEC 11.2 / DESIGN-SYSTEM: the large primary action button height (the day's one-tap record). */
    val buttonLarge: Dp = 56.dp

    /**
     * The default icon size. DESIGN-SYSTEM section 1 holds it twice and agrees with itself: the R62 SIZE
     * family names « `icon-sm` 16 · `icon` 20 · `icon-lg` 24 », and the ICONS line says « Lucide, 1.75 px
     * stroke, 20 px default ». Ported to Kotlin by AN-ANSWER-ICON, which needs it for the answer line's kind
     * glyph (R430 names « the `icon` size token (20) » directly). The value is already in the brief, so R77
     * covers it (no separate value ruling) and the R285 / R272 precedent governs ratifying an Android token
     * here rather than inventing one - it is NOT a new value, it is `icon` ported, exactly as `rule` was.
     *
     * NOTHING ELSE IS MOVED ONTO IT. Material3's Icon defaults to 24 dp and every existing call site takes
     * that default; retrofitting them is a visual change to screens this task was not asked to touch.
     */
    val icon: Dp = 20.dp

    /**
     * The hairline rule / card border width. DESIGN-SYSTEM section 1 names it « `size-rule` 1 ... a
     * hairline », distinct from the card radius or a spacing step. Ported to Kotlin by AN-HOME, which
     * needs the « one white card with a 1 px border » section 1 calls for; the value is already in the
     * brief, so R77 covers it (no separate value ruling) and the R285 / R272 precedent governs ratifying
     * an Android token here rather than inventing one - it is NOT a new value, it is `size-rule` ported.
     */
    val rule: Dp = 1.dp
}

/**
 * Layout breakpoints - a different token category from Radius/Spacing
 * (a viewport width, not a padding or corner value). AN3 increment 6:
 * promoted from a literal `320.dp` repeated in ThresholdRailScreenshotTest.kt
 * and dev/GalleryScreen.kt, both independently exercising R127's "the 320 dp
 * requirement: the narrowest width this product supports".
 */
object Breakpoints {
    val minSupportedWidth: Dp = 320.dp
}

/**
 * Motion durations in milliseconds (DESIGN-SYSTEM.md section 1: "MOTION: 200 ms
 * standard, 250 enter/modal, 300 bottom sheet, numbers animate over 300 ms. No
 * bounce, no parallax, no animated maps"). A token category distinct from
 * Radius/Spacing/Elevation/Breakpoints/Size.
 *
 * Ported to Kotlin by AN-HOME, citing R77 (a token whose value already appears
 * in a brief needs no separate value ruling) and the AN-HOME relay, which
 * authorises adding the motion tokens here rather than typing a duration inline.
 *
 * A CLOSED SET, enforced like Radius (MotionTest.kt): the values are DERIVED from
 * the one map, never typed independently, and a fifth name or a changed value
 * fails. bottomSheetMillis and numbersMillis both read 300 and keep distinct
 * names (R68: distinct names even where values coincide). Fence 8 (FencesTest)
 * forbids a raw duration literal in ui//design/, so a duration reaches a call
 * site only through one of these names.
 */
object Motion {
    private val tokens: Map<String, Int> =
        mapOf(
            "standardMillis" to 200,
            "enterMillis" to 250,
            "bottomSheetMillis" to 300,
            "numbersMillis" to 300,
        )

    /** 200 ms - the standard transition (the choice card's fade + height change, AN-HOME). */
    val standardMillis: Int = tokens.getValue("standardMillis")

    /** 250 ms - an enter/modal transition. */
    val enterMillis: Int = tokens.getValue("enterMillis")

    /** 300 ms - the bottom sheet. */
    val bottomSheetMillis: Int = tokens.getValue("bottomSheetMillis")

    /** 300 ms - a number change (the year panel's figures, AN-HOME). */
    val numbersMillis: Int = tokens.getValue("numbersMillis")

    // IOS-1b-A R603: public, not internal - MotionTest in :app reads it across the module boundary.

    /** For MotionTest.kt only (R8 shape ported) - never referenced by ui/ code. */
    val allForTest: Map<String, Int> get() = tokens
}

/**
 * LIGHT colours (DESIGN-SYSTEM 1). Light ships first - DarkColors below is
 * defined but NOT wired into FrontierTheme (DESIGN-SYSTEM section 12 override;
 * AN0's edge-to-edge conflict).
 */
object LightColors {
    val canvas = Color(0xFFF7F8FA)
    val surface = Color(0xFFFFFFFF)

    val textPrimary = Color(0xFF111827)
    val textSecondary = Color(0xFF667085)
    val textTertiary = Color(0xFF98A2B3)
    val textDisabled = Color(0xFFC4C8D0)

    val borderDefault = Color(0xFFE4E7EC)
    val borderStrong = Color(0xFFD0D5DD)

    /** Deep Alpine Blue - primary CTA, active nav, links, selected states. Not everywhere. */
    val brand = Color(0xFF173B63)

    /**
     * The light brand tint (R337, closes PARKAN-42): the brand colour at 8 %
     * alpha, DERIVED from `brand` - not a new hue (R9). The onboarding icon
     * badges and selected choice-card fills (#EAF0F7 in the mockups) use it.
     * Named ONCE here so no file open-codes `brand.copy(alpha = ...)`; Fence 9
     * (FencesTest) fails on that form anywhere but this file.
     */
    val brandSoft = brand.copy(alpha = 0.08f)

    val franceMain = Color(0xFF315FA8)
    val franceSoft = Color(0xFFEAF1FB)
    val franceText = Color(0xFF244A82)

    val switzerlandMain = Color(0xFFD84B4B)
    val switzerlandSoft = Color(0xFFFCECEC)
    val switzerlandText = Color(0xFFA93636)

    val success = Color(0xFF15803D)
    val successBg = Color(0xFFEAF7EE)
    val warning = Color(0xFFB7791F)
    val warningBg = Color(0xFFFFF7E6)
    val error = Color(0xFFC53030)
    val errorBg = Color(0xFFFDECEC)
    val info = Color(0xFF2563EB)
    val infoBg = Color(0xFFEDF4FF)
}

/**
 * DARK colours (DESIGN-SYSTEM 1 / section 12: "Tokens adopted; light ships
 * first, dark after launch"). Defined so the values exist when dark mode is
 * built; DELIBERATELY NOT REFERENCED by FrontierTheme. AN0's edge-to-edge
 * conflict (docs/android-skills.md 6.2): the launch build does not invert on
 * system dark mode.
 */
object DarkColors {
    val canvas = Color(0xFF0B0F14)
    val surface = Color(0xFF111827)
    val elevated = Color(0xFF18202C)
    val border = Color(0xFF273244)
    val textPrimary = Color(0xFFF9FAFB)
    val textSecondary = Color(0xFF98A2B3)
    val brand = Color(0xFF6EA1D7)
    val france = Color(0xFF6B93D6)
    val switzerland = Color(0xFFE97878)
}
