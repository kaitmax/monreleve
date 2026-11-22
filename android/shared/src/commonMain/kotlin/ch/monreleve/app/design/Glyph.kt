package ch.monreleve.app.design

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.painter.Painter

// IOS-1b-A R603. THE LUCIDE GLYPHS THE SHARED SCREEN AND DESIGN SYSTEM DRAW, NAMED BY AN ENUM.
//
// ONE HOME FOR THE FILES, AND IT IS STILL app/src/main/res/drawable (REPORT-IOS-1b-A, DEVIATION 4 / QUESTION Q2).
// R603 asked for the drawables to move into Compose Multiplatform resources with Android reading them from there.
// A HARD BOUNDARY forbids what that costs: Aujourd'hui's instrumented tests assert the glyph semantics against
// literal ch.monreleve.app.R.drawable ids, and those ids exist only while the XMLs are :app resources. So:
//   - ANDROID draws each glyph exactly as before - androidx painterResource of the app's own drawable, found by
//     name at run time (glyph.android.kt) - pixel-identical by construction, and the semantics carry the same Int;
//   - iOS draws the SAME XML files, GENERATED into its Compose Multiplatform resources at build time by
//     :shared's generateGlyphResources task (derived, never transcribed - R181), and GlyphResourceGeneratorTest
//     proves the generator delivered each file's path data unchanged (R154).
//
// THE FILE NAME IS DERIVED FROM THE ENUM: "ic_" + the constant in lower case (HOUSE -> ic_house, BUILDING_2 ->
// ic_building_2), so the name is never typed twice. A constant whose drawable does not exist fails
// GlyphDrawablesExistTest in :app (and the iOS compile, whose Res accessor would not be generated).
enum class Glyph {
    BUILDING_2,
    HOUSE,
    BRIEFCASE,
    PLANE,
    CALENDAR_X,
    CLOCK,
    CIRCLE_CHECK,
    TRIANGLE_ALERT,
    CIRCLE_X,
    OCTAGON_ALERT,

    // IOS-2a R767: the onboarding kit's glyphs (OnboardingKit.kt - the back chevron, the info note, the brand mark)
    // and the ones its callers hand IconCircle (the code screen's mail, the welcome rows, the reminder's bell).
    CHEVRON_LEFT,
    INFO,
    LOGO_MARK,
    MAIL,
    CALENDAR_CHECK,
    FILE_TEXT,
    LOCK,
    BELL,

    // IOS-MOVE-CORE R1300 (I0's N5): the bottom bar's three, now that AppBottomBar is common. APPENDED, never inserted:
    // on iOS the semantics id is the ordinal (glyphSemanticsId), so every earlier constant keeps its own.
    SUN,
    CALENDAR,
    SETTINGS,
    ;

    /** The drawable's file name without extension - the one derivation every platform uses. */
    val fileName: String get() = FILE_PREFIX + name.lowercase()
}

private const val FILE_PREFIX = "ic_"

/** The glyph's painter on this platform: Android's own drawable, or the iOS Compose resource generated from it. */
@Composable
expect fun glyphPainter(glyph: Glyph): Painter

/**
 * The Int the glyph-semantics keys carry (kindIconResKey, statusIconResKey) - read by tests, never by TalkBack. On
 * Android it is the app's R.drawable id itself, so the instrumented tests' literal R.drawable assertions hold
 * unedited; on iOS, where no such id exists, it is the enum's ordinal.
 */
@Composable
expect fun glyphSemanticsId(glyph: Glyph): Int
