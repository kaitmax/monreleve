package ch.monreleve.app.design.rail

// AN3 increment 3 (AC2, AC3). The Compose rendering of railGeometry's
// numbers - web/lib/ui/react/ThresholdRail/ThresholdRail.tsx's counterpart.
//
// A GENUINE PLATFORM DIFFERENCE FROM THE WEB SIDE, RECORDED RATHER THAN
// WORKED AROUND (matching the relay's own anticipation). Ruling R130 gives
// the web rail's ticks vector-effect="non-scaling-stroke" because an SVG
// with `max-width: 100%` and a viewBox scales EVERYTHING inside it
// uniformly when the container is narrower than the intrinsic width - so a
// 2 px tick becomes 1.6 px at 320 and drifts off the device pixel grid
// unless something exempts it from that scaling.
//
// A Compose Canvas has no equivalent implicit scaling: railGeometry is
// computed directly against the composable's OWN measured width (read via
// BoxWithConstraints below), never against a fixed "design width" that is
// later scaled down to fit a narrower container. There is no viewBox, so
// there is nothing to counteract - the tick is drawn at TICK_WIDTH dp,
// converted to real pixels via DrawScope's own Density (a DrawScope IS a
// Density in Compose), at every width the rail is ever asked to render
// at. Proven in ThresholdRailScreenshotTest.kt: the same rail rendered at
// the default width and at 320 dp keeps its tick visually identical in
// both, which is the property R130 exists to guarantee on the web side.

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.ZONE_BAND_COLOUR
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.rail.RailCopy
import ch.monreleve.app.fr.rail.ZONE_BAND_NAME
import ch.monreleve.app.fr.rail.railAriaLabel
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.fr.text.formatPercent

// R40: the rate label is declarableRate at its native two decimals - formatted by its one home (R479).

/** DrawScope IS a Density in Compose, so this needs no density parameter of its own. */
private fun DrawScope.toPx(value: Double): Float = value.dp.toPx()

/**
 * A single line's rendered height, in dp, AT THE CURRENT fontScale. The digit
 * is irrelevant - a caption line box is the same height whatever it holds - so
 * "0" is measured rather than a threshold string a fence would flag (R35). This
 * is what makes the rail scale-aware: at 100% it returns caption's 18, at 200%
 * roughly 36, and the vertical stack is built from whichever it is.
 */
private fun lineHeightDp(
    textMeasurer: TextMeasurer,
    density: Density,
    style: TextStyle,
): Double = with(density) { textMeasurer.measure("0", style).size.height.toDp().value.toDouble() }

/**
 * R271 (PARK-17). Rebuild ONLY the vertical coordinates of a non-social
 * geometry from the measured caption line height, leaving every horizontal
 * field (track x/width, tick x, fill width, label x, anchors) exactly as
 * railGeometry produced it - so AC2's RailGeometryTest, which asserts the
 * pure function, is untouched.
 *
 * The rate sits with its top at 0; the track a ROW_GAP + protrusion below it;
 * the tick labels a full ROW_GAP below the tick region, top-aligned there via
 * the SAME line height drawLabel will measure. At 100% this matches the old
 * stack height (60) while correcting a pre-existing 5 px top-clip on the rate
 * and a 5 px overlap of the labels into the ticks; above 100% the whole rail
 * grows to fit rather than colliding.
 */
private fun RailGeometry.withTextScaledVertical(lineDp: Double): RailGeometry {
    val newTrackY = lineDp + ROW_GAP + TICK_PROTRUSION
    val trackBottom = newTrackY + track.height
    val tickLabelTop = trackBottom + TICK_PROTRUSION + ROW_GAP
    val newLabelBaselineY = tickLabelTop + lineDp
    return copy(
        svgHeight = newLabelBaselineY,
        track = track.copy(y = newTrackY),
        fill = fill.copy(y = newTrackY),
        rateBaselineY = lineDp,
        ticks = ticks.map { tick -> tick.copy(y = newTrackY - TICK_PROTRUSION, labelY = newLabelBaselineY) },
    )
}

/** Where a label's baseline sits - bundled so drawLabel stays under the parameter-count fence. */
private data class LabelBaseline(val x: Double, val y: Double)

/**
 * The rail. `percentage` non-finite renders the unavailable state and
 * NEVER reaches zoneFor (R33) - the caller's own Zone is used only when
 * finite, and railGeometry is called with a substituted 0 so the geometry
 * itself never sees the non-finite value either.
 */
@Composable
fun ThresholdRail(
    percentage: Double,
    zone: Zone,
    variant: RailVariant,
    thresholds: ZoneThresholds,
    modifier: Modifier = Modifier,
) {
    val unavailable = !percentage.isFinite()
    val textMeasurer = rememberTextMeasurer()

    BoxWithConstraints(modifier = modifier) {
        val requestedWidth = if (variant == RailVariant.SOCIAL) SOCIAL_WIDTH else maxWidth.value.toDouble()

        val baseGeometry =
            remember(percentage, zone, variant, thresholds, requestedWidth) {
                railGeometry(
                    RailData(
                        percentage = if (unavailable) 0.0 else percentage,
                        zone = zone,
                        width = requestedWidth,
                        height = TRACK_HEIGHT,
                        variant = variant,
                    ),
                    thresholds,
                )
            }

        val generic = variant == RailVariant.SOCIAL

        // R271 (PARK-17). The tick and rate labels scale with fontScale; the
        // vertical stack railGeometry computed does NOT (it works from the
        // fixed 18/22/32 line constants). At 200% text those labels overran
        // the track and each caption's own inline percent. The horizontal
        // geometry stays railGeometry's (AC2's 33-case proof is untouched);
        // the vertical stack is rebuilt here from the MEASURED line box, so
        // the rail grows its own height to fit at any scale rather than
        // capping the glyphs (which would defeat the setting R16 serves).
        // Social keeps its fixed 1200x630 layout (a known-limit cropped
        // baseline; not part of the 200% concern).
        val density = LocalDensity.current
        val geometry =
            if (generic) {
                baseGeometry
            } else {
                baseGeometry.withTextScaledVertical(lineHeightDp(textMeasurer, density, FrontierType.caption))
            }

        val ariaLabel =
            when {
                generic -> RailCopy.RAIL_SOCIAL_ARIA
                unavailable -> RailCopy.RAIL_UNAVAILABLE_ARIA
                else -> railAriaLabel(formatDeclarableRate(geometry.percentage), zone.wireKey)
            }

        Box(
            modifier =
                Modifier
                    .width(geometry.svgWidth.dp)
                    .height(geometry.svgHeight.dp)
                    .semantics { contentDescription = ariaLabel },
        ) {
            Canvas(modifier = Modifier.width(geometry.svgWidth.dp).height(geometry.svgHeight.dp)) {
                drawRail(geometry, zone, unavailable, textMeasurer)
            }
        }
    }
}

private fun DrawScope.drawRail(
    geometry: RailGeometry,
    zone: Zone,
    unavailable: Boolean,
    textMeasurer: TextMeasurer,
) {
    val generic = geometry.bandSegments.isNotEmpty()

    if (generic) {
        drawRect(color = LightColors.canvas, size = Size(size.width, size.height))
    }

    if (geometry.productNameShown) {
        val baseline = LabelBaseline(geometry.track.x, geometry.productNameBaselineY)
        drawLabel(textMeasurer, Fr.APP_NAME, FrontierType.h2, baseline)
    }

    if (geometry.rateShown) {
        val rateText =
            if (unavailable) RailCopy.RAIL_UNAVAILABLE_LABEL else formatDeclarableRate(geometry.percentage)
        val baseline = LabelBaseline(geometry.track.x, geometry.rateBaselineY)
        drawLabel(textMeasurer, rateText, FrontierType.caption, baseline)
    }

    drawTrackAndFill(geometry, zone, unavailable, generic)

    // R48: the social card fills its whole track with the three static bands.
    geometry.bandSegments.forEach { segment ->
        drawRect(
            color = ZONE_BAND_COLOUR.getValue(segment.zone),
            topLeft = Offset(toPx(segment.x), toPx(geometry.track.y)),
            size = Size(toPx(segment.width), toPx(geometry.track.height)),
        )
    }

    drawTicks(geometry, generic, textMeasurer)

    if (geometry.bandNamesShown) {
        geometry.bandNameRows.forEach { row ->
            val name = ZONE_BAND_NAME.getValue(row.zone.wireKey)
            drawLabel(textMeasurer, name, FrontierType.micro, LabelBaseline(geometry.bandNameX, row.y))
        }
    }
}

/** A text node whose BASELINE sits at `baseline` - the same anchor railGeometry computes for. */
private fun DrawScope.drawLabel(
    textMeasurer: TextMeasurer,
    text: String,
    style: TextStyle,
    baseline: LabelBaseline,
    endAnchored: Boolean = false,
) {
    val layout = textMeasurer.measure(text, style)
    val left = if (endAnchored) toPx(baseline.x) - layout.size.width else toPx(baseline.x)

    drawText(layout, topLeft = Offset(left, toPx(baseline.y) - layout.size.height))
}

private fun DrawScope.drawTrackAndFill(
    geometry: RailGeometry,
    zone: Zone,
    unavailable: Boolean,
    generic: Boolean,
) {
    drawRoundRect(
        color = LightColors.borderDefault,
        topLeft = Offset(toPx(geometry.track.x), toPx(geometry.track.y)),
        size = Size(toPx(geometry.track.width), toPx(geometry.track.height)),
        cornerRadius = CornerRadius(toPx(geometry.track.rx)),
    )

    // The fill, in the band colour - omitted when unavailable or generic (R33, R44).
    if (!unavailable && !generic) {
        drawRoundRect(
            color = ZONE_BAND_COLOUR.getValue(zone),
            topLeft = Offset(toPx(geometry.fill.x), toPx(geometry.fill.y)),
            size = Size(toPx(geometry.fill.width), toPx(geometry.fill.height)),
            cornerRadius = CornerRadius(toPx(geometry.fill.rx)),
        )
    }
}

/**
 * The two ticks, drawn at a FIXED pixel stroke width (TICK_WIDTH.dp
 * converted once) regardless of the track's own width - the Compose
 * analogue of vector-effect="non-scaling-stroke" (see this file's header).
 */
private fun DrawScope.drawTicks(
    geometry: RailGeometry,
    generic: Boolean,
    textMeasurer: TextMeasurer,
) {
    val tickWidthPx = toPx(TICK_WIDTH)

    geometry.ticks.forEach { tick ->
        val centreX = toPx(tick.x) + tickWidthPx / 2

        drawLine(
            color = LightColors.textPrimary,
            start = Offset(centreX, toPx(tick.y)),
            end = Offset(centreX, toPx(tick.y) + toPx(tick.height)),
            strokeWidth = tickWidthPx,
            cap = StrokeCap.Butt,
        )
    }

    geometry.ticks.forEach { tick ->
        val labelStyle = if (generic) FrontierType.body else FrontierType.caption
        val whole = tick.percentage.toInt().toDouble()
        val labelText = formatPercent(tick.percentage, if (tick.percentage == whole) 0 else 1)

        drawLabel(
            textMeasurer,
            labelText,
            labelStyle,
            LabelBaseline(tick.labelX, tick.labelY),
            endAnchored = tick.labelAnchor == LabelAnchor.END,
        )
    }
}
