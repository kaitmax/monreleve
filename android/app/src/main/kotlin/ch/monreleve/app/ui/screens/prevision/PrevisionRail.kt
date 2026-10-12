package ch.monreleve.app.ui.screens.prevision

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZONE_BAND_COLOUR
import ch.monreleve.app.design.Zone
import ch.monreleve.app.forecast.Projection
import ch.monreleve.app.fr.PrevisionCopy

// AN-FORECAST. The forecast card's two-segment rail and its legend, split from PrevisionScreen.kt to keep each
// file within detekt's per-file function budget (the ReleveSections split idiom). R340: the recorded part is
// SOLID and the projected part SOFT (a shape difference, not colour alone), with the fiscal and social ceilings
// marked; every figure is the engine's, passed in. 0..100 % scale, as the design draws it.

private const val PERCENT = 100.0
private const val TICK_WIDTH = 2

@Composable
internal fun ProjectionRail(
    projection: Projection,
    projectedZone: Zone,
) {
    val recordedFrac = frac(projection.currentRate)
    val projectedFrac = frac(projection.projectedRate)
    val solid = ZONE_BAND_COLOUR.getValue(projectedZone)
    val soft = softZoneColour(projectedZone)
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val full = maxWidth
        Box(modifier = Modifier.fillMaxWidth().height(Spacing.space12)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(Radius.pill))
                        .background(LightColors.borderDefault),
            )
            // Projected (soft) under the recorded (solid) part; the recorded sits on top from the start.
            RailSegment(fraction = projectedFrac, colour = soft)
            RailSegment(fraction = recordedFrac, colour = solid)
            Tick(offsetX = full * projection.fiscalCeiling.toFloat())
            Tick(offsetX = full * projection.socialCeiling.toFloat())
        }
    }
}

@Composable
private fun RailSegment(
    fraction: Float,
    colour: Color,
) {
    Box(
        modifier =
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction)
                .clip(RoundedCornerShape(Radius.pill))
                .background(colour),
    )
}

@Composable
private fun Tick(offsetX: Dp) {
    Box(
        modifier =
            Modifier
                .offset(x = offsetX)
                .width(Size.rule * TICK_WIDTH)
                .fillMaxHeight()
                .background(LightColors.textPrimary),
    )
}

@Composable
internal fun Legend(projectedZone: Zone) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space16)) {
        LegendItem(colour = ZONE_BAND_COLOUR.getValue(projectedZone), label = PrevisionCopy.LEGEND_RECORDED)
        LegendItem(colour = softZoneColour(projectedZone), label = PrevisionCopy.LEGEND_PROJECTED)
    }
}

@Composable
private fun LegendItem(
    colour: Color,
    label: String,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .width(Spacing.space12)
                    .height(Spacing.space8)
                    .clip(RoundedCornerShape(Radius.xs))
                    .background(colour),
        )
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}

/** The soft (lighter) band colour for each zone - the background token of the band's status colour. */
private fun softZoneColour(zone: Zone): Color =
    when (zone) {
        Zone.COMPLIANT -> LightColors.successBg
        Zone.FISCAL_EXPOSURE -> LightColors.warningBg
        Zone.SOCIAL_SWITCH -> LightColors.errorBg
    }

/** A rate (percentage 0..100) as a 0..1 fraction of the rail, clamped. */
private fun frac(rate: Double): Float = (rate / PERCENT).toFloat().coerceIn(0f, 1f)
