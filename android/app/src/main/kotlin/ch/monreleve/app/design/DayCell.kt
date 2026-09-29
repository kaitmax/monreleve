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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
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

/**
 * WHETHER the record can be trusted - independent of WHERE (DayKind).
 *
 * PENDING is a recorded day whose quality the SERVER has not yet fixed (R216): the client may
 * predict lateness to warn (LatenessForecast), but it must not adjudicate the flag. Until the row
 * syncs and the server returns its firstRecordedAt, on-time-versus-late is not yet a fact, so the
 * cell draws no coloured bar - a lettered cell with no bar is already distinct from both an on-time
 * cell (green bar) and an unrecorded one (grey bar). "Pending, never late" (AN10 increment 3).
 */
enum class RecordQuality { ON_TIME, LATE, PENDING, MISSING, NONE }

private fun qualityColour(quality: RecordQuality): Color? =
    when (quality) {
        RecordQuality.ON_TIME -> LightColors.success
        RecordQuality.LATE -> LightColors.warning
        RecordQuality.MISSING -> LightColors.borderStrong
        // PENDING: recorded, but the quality is not yet a server fact (R216) - no coloured bar,
        // distinguished from NONE by the a11y announcement (DayCellCopy), not by colour.
        RecordQuality.PENDING -> null
        // Weekend or future: no bar at all, not a fourth colour standing
        // in for "nothing to report" (SPEC 966: colour never conveys
        // meaning alone, and an absent bar is the honest absence of one).
        RecordQuality.NONE -> null
    }

/**
 * WHO produced the record, in the UI's own vocabulary (R202) - the wire's Provenance enum
 * (data/local) never enters design/ or ui/. In the manual product every entry is MANUAL; the
 * detection cases exist for AN9+ and are carried so the cell renders them without a later change.
 * Rendered in the cell's a11y announcement (SPEC 8: provenance is shown wherever an entry is,
 * "never as an icon alone"); DETECTED_CORRECTED also draws the corner mark.
 */
enum class DayProvenance { MANUAL, DETECTED_CONFIRMED, DETECTED_CORRECTED }

/**
 * One calendar cell. `kind` null renders nothing recorded (D38); `corrected`
 * draws the corner mark a detected-then-edited day carries. `isToday` tints the
 * cell (FD6: today's fill #EDF4FF, day number in brand) - via the info-soft and
 * brand tokens, never a raw 2 dp outline, which has no token (adding one is
 * ask-first, SPEC 20). `provenance` names who produced the record, in the a11y
 * announcement (SPEC 8), null when the day is not recorded.
 *
 * The parameter list is long by design: SPEC 966 keeps the cell's signals on separate
 * axes (date, kind, quality, corrected, today, provenance) and never merges two into
 * one, so a holder would obscure exactly the separation the design requires.
 */
@Suppress("LongParameterList")
@Composable
fun DayCell(
    dayOfMonth: Int,
    kind: DayKind?,
    quality: RecordQuality,
    corrected: Boolean,
    modifier: Modifier = Modifier,
    isToday: Boolean = false,
    provenance: DayProvenance? = null,
    // R292 / PARKAN-22: the afternoon kind of a SPLIT half-day. When set, the cell shows BOTH letters -
    // a day that was Suisse in the morning and Domicile in the afternoon must not read as Suisse alone.
    secondKind: DayKind? = null,
) {
    val description =
        DayCellCopy.contentDescription(
            dayOfMonth,
            kind?.letter,
            quality.name,
            corrected,
            isToday,
            provenance?.name,
            secondKind?.letter,
        )

    BoxWithConstraints(
        modifier =
            modifier
                .size(Spacing.space40)
                .semantics { contentDescription = description },
    ) {
        val cellFill = if (isToday) Modifier.background(LightColors.infoBg) else Modifier
        Box(modifier = Modifier.size(Spacing.space40).then(cellFill)) {
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
                // FD6: today's day number is brand-weighted; the tint plus the number colour
                // carry "today" together, so it is not signalled by fill alone.
                color = if (isToday) LightColors.brand else LightColors.textPrimary,
                modifier = Modifier.align(Alignment.TopStart).padding(Spacing.space4),
            )

            if (kind != null) {
                KindMarkers(kind = kind, secondKind = secondKind)
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

// The kind letter(s) and the country dot. A SPLIT half-day (R292 / PARKAN-22) shows BOTH letters side by
// side at the bottom-left; a whole day or a lone half shows the single letter. The two letters ARE the
// split signal, and the a11y announcement names both halves (« matin ..., apres-midi ... »). BottomStart,
// clear of the date (TopStart), the dot (TopEnd) and the corrected mark (BottomEnd). The dot is the
// morning kind's; the letters carry both kinds.
@Composable
private fun BoxScope.KindMarkers(
    kind: DayKind,
    secondKind: DayKind?,
) {
    Row(
        modifier =
            Modifier
                .align(Alignment.BottomStart)
                .padding(start = Spacing.space4, bottom = Spacing.space4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        Text(text = kind.letter, style = FrontierType.micro)
        if (secondKind != null) {
            Text(text = secondKind.letter, style = FrontierType.micro)
        }
    }
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
