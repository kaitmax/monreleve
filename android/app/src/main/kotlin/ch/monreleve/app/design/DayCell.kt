package ch.monreleve.app.design

// AN3 increment 4. No direct web component to port from - detection and
// the calendar are AN6+ scope on both platforms, so this is built directly
// from SPEC line 847 and DESIGN-SYSTEM.md's FrontierCalendar row, rather
// than transcribed from an existing implementation:
//
//   "A letter plus a 6 dp country dot carry the kind: S Suisse
//   (Switzerland red), D Domicile (France blue), M Mission (neutral),
//   A Absence (tertiary); nothing when unrecorded (D38)."
//
//   "Cell: date 14/500, kind letter, country dot, 4 px quality bar at the
//   bottom edge (kept - it is the product's signature), corner triangle
//   for corrected."
//
// TWO INDEPENDENT AXES, DELIBERATELY NOT COMBINED INTO ONE COLOUR (SPEC
// 966's own "colour and shape convey nothing on their own"): the LETTER
// and DOT answer WHERE a day was worked; the QUALITY BAR answers WHETHER
// the record can be trusted (logged on time, late, or missing). A day can
// be "M" (mission) with a grey (missing) bar, or "S" (Suisse) with a
// green one - the two never merge into a single semantic.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.fr.DayCellCopy

/** The four letters SPEC 847 names. Mission's two destinations (FR/third-state) share one letter and a neutral dot. */
enum class DayKind(val letter: String, val dotColour: (Colours) -> Color) {
    SUISSE("S", { it.switzerland }),
    DOMICILE("D", { it.france }),
    MISSION("M", { it.neutral }),
    ABSENCE("A", { it.tertiary }),
}

/** Bundles the four dot colours DayKind reads from, so DayCell needs no direct Tokens import inside the enum. */
data class Colours(val switzerland: Color, val france: Color, val neutral: Color, val tertiary: Color)

private val DOT_COLOURS =
    Colours(
        switzerland = LightColors.switzerlandMain,
        france = LightColors.franceMain,
        neutral = LightColors.textSecondary,
        tertiary = LightColors.textTertiary,
    )

/** WHETHER the record can be trusted - independent of WHERE (DayKind). */
enum class RecordQuality { ON_TIME, LATE, MISSING, NONE }

private fun qualityColour(quality: RecordQuality): Color? =
    when (quality) {
        RecordQuality.ON_TIME -> LightColors.success
        RecordQuality.LATE -> LightColors.warning
        RecordQuality.MISSING -> LightColors.borderStrong
        // Weekend or future: no bar at all, not a fourth colour standing
        // in for "nothing to report" (SPEC 966: colour never conveys
        // meaning alone, and an absent bar is the honest absence of one).
        RecordQuality.NONE -> null
    }

/**
 * One calendar cell. `kind` null renders nothing recorded (D38); `corrected`
 * draws the corner mark a detected-then-edited day carries.
 */
@Composable
fun DayCell(
    dayOfMonth: Int,
    kind: DayKind?,
    quality: RecordQuality,
    corrected: Boolean,
    modifier: Modifier = Modifier,
) {
    val description = DayCellCopy.contentDescription(dayOfMonth, kind?.letter, quality.name, corrected)

    BoxWithConstraints(
        modifier =
            modifier
                .size(Spacing.space40)
                .semantics { contentDescription = description },
    ) {
        Box(modifier = Modifier.size(Spacing.space40)) {
            // THE QUALITY BAR IS THE FIRST CHILD, DELIBERATELY - a Box's
            // later children paint OVER its earlier ones, and this needs
            // to sit behind the letter and the corrected mark rather than
            // over them. It also needs an explicit fillMaxWidth(): found
            // necessary by looking at the rendered baseline (R176/R177's
            // instinct, applied inside one component rather than a whole
            // screen) - a Box with only a background and no width has no
            // intrinsic size and rendered nothing at all in a first draft.
            qualityColour(quality)?.let { colour ->
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(Spacing.space4)
                            .background(colour),
                )
            }

            // Date top-left, kind letter bottom-left - stacked rather than
            // overlapping. A first draft centred the letter directly under
            // the top-left date and the two glyphs sat on top of each
            // other at this cell's real 40 dp size; found the same way.
            Text(
                text = dayOfMonth.toString(),
                style = FrontierType.caption,
                modifier = Modifier.align(Alignment.TopStart).padding(Spacing.space4),
            )

            if (kind != null) {
                Text(
                    text = kind.letter,
                    style = FrontierType.micro,
                    modifier =
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(start = Spacing.space4, bottom = Spacing.space4),
                )
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(Spacing.space4)
                            .size(Radius.checkbox)
                            .clip(CircleShape)
                            .background(kind.dotColour(DOT_COLOURS)),
                )
            }

            // The corrected mark sits at BottomEnd, deliberately distinct
            // from the date (TopStart), the letter (BottomStart) and the
            // dot (TopEnd) - the fourth corner was the only one free of
            // the other three, found the same way as the layout above.
            if (corrected) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .padding(start = Spacing.space4, end = Spacing.space4, bottom = Spacing.space4)
                            .size(Radius.checkbox)
                            .background(LightColors.textTertiary),
                )
            }
        }
    }
}
