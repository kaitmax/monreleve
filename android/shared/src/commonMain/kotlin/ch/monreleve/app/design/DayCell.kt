package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

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
import androidx.compose.foundation.border
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.fr.DayCellCopy

private val DOT_COLOURS =
    Colours(
        switzerland = LightColors.switzerlandMain,
        france = LightColors.franceMain,
        neutral = LightColors.textSecondary,
        tertiary = LightColors.textTertiary,
    )

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
    // AN-CAL2: the cell is in a multi-day selection. Shown NOT by colour alone - a 1 dp brand ring (a shape)
    // and the Lucide circle-check glyph (a shape that reads in greyscale), with TalkBack announcing it (R206,
    // DayCellCopy). The check sits where the country dot would; the dot is suppressed while selecting, and the
    // kind LETTER stays at the bottom-left, so the kind is never lost.
    selected: Boolean = false,
    // AN-GRANULARITY (R519): the afternoon's provenance when the halves were recorded differently, so the
    // announcement states each half's rather than the morning's for both. Null otherwise.
    secondProvenance: DayProvenance? = null,
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
            selected,
            secondProvenance?.name,
        )

    BoxWithConstraints(
        modifier =
            modifier
                .size(Spacing.space40)
                .semantics { contentDescription = description },
    ) {
        val cellFill = if (isToday) Modifier.background(LightColors.infoBg) else Modifier
        val selectionRing = if (selected) Modifier.border(Size.rule, LightColors.brand) else Modifier
        Box(modifier = Modifier.size(Spacing.space40).then(cellFill).then(selectionRing)) {
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
                KindMarkers(kind = kind, secondKind = secondKind, showDot = !selected)
            }

            // AN-CAL2: the selection check (Lucide circle-check), at the top-end where the dot would sit while
            // selecting. The a11y word is in the cell's announcement, so this icon is decorative (desc null).
            if (selected) {
                SelectionCheck()
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

// AN-CAL2: the selection check glyph (Lucide circle-check, brand), at the top-end where the kind dot sits
// when not selecting. A shape cue that reads in greyscale; the a11y word is in the cell's announcement.
@Composable
private fun BoxScope.SelectionCheck() {
    Icon(
        painter = glyphPainter(Glyph.CIRCLE_CHECK),
        contentDescription = null,
        tint = LightColors.brand,
        modifier =
            Modifier
                .align(Alignment.TopEnd)
                .padding(Spacing.space4)
                .size(Spacing.space16),
    )
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
    // AN-CAL2: the country dot is hidden while the cell is selected, so the selection check can sit at the
    // top-end without crowding; the kind LETTER below stays, so the kind is never lost (SPEC 966).
    showDot: Boolean = true,
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
    if (showDot) {
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
}
