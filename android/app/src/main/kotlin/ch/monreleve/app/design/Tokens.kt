package ch.monreleve.app.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// DESIGN-SYSTEM.md section 1, as Kotlin. The single source for every radius,
// colour and spacing value in ui/ (SPEC 5 / D37). No other file defines one.

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

    /** For RadiusTest.kt only (R8 ported) - never referenced by ui/ code. */
    internal val allForTest: Map<String, Dp> get() = tokens
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
