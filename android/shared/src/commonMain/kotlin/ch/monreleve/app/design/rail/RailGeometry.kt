package ch.monreleve.app.design.rail

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

// AN3 increment 3. Kotlin port of web/lib/ui/core/rail/geometry.ts.
//
// SPEC 6.3: "an 8 px pill track, filled from 0 to the declarable rate in
// the band colour, with two tick markers at 40 and 49.9 protruding 4 px
// above and below the bar, labelled in tabular figures."
//
// Every number here is unit-less, exactly like the TS reference - a
// caller converts to Dp at the point of drawing (RailCanvas.kt). This
// keeps the geometry testable as plain Kotlin, with no Compose runtime
// needed, the same way calc/ stays testable without android.* (though
// this file is NOT calc/ and fence 1 does not apply to it - Zone/
// ZoneThresholds are design/ types).
//
// RULING R35 carried: the two ceilings arrive as a parameter. design/ may
// not carry 40 or 49.9 as bare literals (NoBareThresholdTest.kt, extended
// to design/rail/ in this increment).
//
// BYTE DETERMINISM carried: every emitted coordinate rounds to three
// decimals, so the arithmetic order cannot change the result - proved
// empirically for this platform in RailGeometryTest.kt rather than
// assumed to hold the same way it does for V8.

import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneThresholds
import kotlin.math.roundToLong

/** SPEC 6.3's 8 px track. */
const val TRACK_HEIGHT = 8.0

/**
 * The social card's track (ruling R48) - DOUBLE the ordinary 8, and the
 * one documented exception to "progress bars, never taller than 8": the
 * social variant is a 1200x630 raster seen as a feed thumbnail, where 8 is
 * a hairline. No other variant may read this constant.
 */
const val SOCIAL_TRACK_HEIGHT = 16.0

/** SPEC 6.3's "protruding 4 px above and below". */
const val TICK_PROTRUSION = 4.0

/**
 * The tick's own thickness (ruling R46, superseding R42's 1.5): the
 * device pixel grid, not the design brief, decided this - a 1.5 px rect
 * lands on a half-pixel wherever its centre falls, rendering the two
 * ticks at visibly different alpha values. 2 sits on the grid. Not a
 * design token, and deliberately absent from the spacing scale.
 */
const val TICK_WIDTH = 2.0

/** The compact variant is unreadable narrower than this. */
const val COMPACT_MIN_WIDTH = 200.0

/** SPEC 6.3: "The `social` variant is 1200 x 630". */
const val SOCIAL_WIDTH = 1200.0
const val SOCIAL_HEIGHT = 630.0

/** R48: the social card's rail spans 80% of the card and is centred. */
private const val SOCIAL_RAIL_FRACTION = 0.8

private const val BAND_NAME_LINE = 14.0
private const val LABEL_LINE = 18.0
private const val SOCIAL_LABEL_LINE = 22.0
private const val RATE_LINE_INLINE = 18.0
private const val PRODUCT_NAME_LINE = 32.0

const val CAPTION_SIZE = 13.0
const val MICRO_SIZE = 11.0
const val H2_SIZE = 24.0
const val BODY_SIZE = 15.0

// internal (was private): ThresholdRail.withTextScaledVertical (R271) rebuilds
// the vertical stack from the measured line box and needs the same row gap the
// pure geometry uses, rather than a second copy of 4.0 that could drift (R206).
internal const val ROW_GAP = 4.0

private val BAND_ORDER: List<Zone> = listOf(Zone.COMPLIANT, Zone.FISCAL_EXPOSURE, Zone.SOCIAL_SWITCH)

private const val PERCENT = 1e2
private const val ROUND_SCALE = 1e3

enum class RailVariant { INLINE, COMPACT, SOCIAL }

/**
 * SPEC 6.3's RailData, unchanged. FOR THE SOCIAL VARIANT, percentage AND
 * zone ARE IGNORED (ruling R44) - that card is generic and never
 * per-result. They stay required rather than nullable: the honest
 * guarantee is a TEST (RailGeometryTest.kt renders social twice with
 * wildly different rates and zones and requires identical geometry), not
 * a type.
 */
data class RailData(
    val percentage: Double,
    val zone: Zone,
    val width: Double,
    val height: Double,
    val variant: RailVariant,
)

data class RailRect(val x: Double, val y: Double, val width: Double, val height: Double, val rx: Double)

data class RailBandRow(val zone: Zone, val y: Double)

/** One coloured segment of the social track (ruling R48): empty for every other variant. */
data class RailBandSegment(val zone: Zone, val x: Double, val width: Double)

data class RailTick(
    /** The ceiling this tick marks, as a percentage. From the RuleSet. */
    val percentage: Double,
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
    val labelX: Double,
    val labelY: Double,
    /** R39: the fiscal label ends at its tick, the social label starts at its. */
    val labelAnchor: LabelAnchor,
)

enum class LabelAnchor { START, END }

data class RailGeometry(
    val svgWidth: Double,
    val svgHeight: Double,
    val track: RailRect,
    val fill: RailRect,
    val ticks: List<RailTick>,
    /** The rate as given, never clamped - the label is the truth. */
    val percentage: Double,
    /** True when the rate fell outside 0..100 and the FILL was bounded. */
    val clampedFill: Boolean,
    /** True when a compact request narrower than the minimum was widened. */
    val clampedWidth: Boolean,
    val bandNamesShown: Boolean,
    val bandNameX: Double,
    val bandNameRows: List<RailBandRow>,
    val bandSegments: List<RailBandSegment>,
    val rateShown: Boolean,
    val rateBaselineY: Double,
    val productNameShown: Boolean,
    val productNameBaselineY: Double,
)

/** Three decimals, so the arithmetic order cannot change the bytes. */
private fun round(value: Double): Double = (value * ROUND_SCALE).roundToLong() / ROUND_SCALE

private fun clamp(
    value: Double,
    low: Double,
    high: Double,
): Double = minOf(maxOf(value, low), high)

/**
 * Everything a Compose draw call needs, from RailData and the year's
 * ceilings. Clamping bounds the GEOMETRY and never the value: a rate of
 * -5 draws an empty track and a rate of 140 draws a full one, while
 * `percentage` carries the real number through for the label.
 */
@Suppress("LongMethod", "CyclomaticComplexMethod")
fun railGeometry(
    data: RailData,
    thresholds: ZoneThresholds,
): RailGeometry {
    require(data.percentage.isFinite()) { "railGeometry needs a finite percentage, received ${data.percentage}" }
    require(data.width.isFinite()) { "railGeometry needs a finite width, received ${data.width}" }

    val social = data.variant == RailVariant.SOCIAL
    val compact = data.variant == RailVariant.COMPACT

    val requestedWidth = if (social) SOCIAL_WIDTH else data.width
    require(requestedWidth > 0) { "railGeometry needs a positive width, received ${data.width}" }

    val clampedWidth = compact && requestedWidth < COMPACT_MIN_WIDTH
    val svgWidth = if (clampedWidth) COMPACT_MIN_WIDTH else requestedWidth

    val trackWidth = round(if (social) svgWidth * SOCIAL_RAIL_FRACTION else svgWidth)
    val trackX = round(if (social) (svgWidth - trackWidth) / 2 else 0.0)

    val bandNamesShown = social
    val productNameShown = social
    val rateShown = !social
    val trackHeight = if (social) SOCIAL_TRACK_HEIGHT else TRACK_HEIGHT
    val labelSize = if (social) BODY_SIZE else CAPTION_SIZE
    val labelLine = if (social) SOCIAL_LABEL_LINE else LABEL_LINE

    val productNameRow = if (productNameShown) PRODUCT_NAME_LINE + ROW_GAP else 0.0
    val rateRow = if (rateShown) RATE_LINE_INLINE + ROW_GAP else 0.0
    val barRow = trackHeight + TICK_PROTRUSION * 2
    val labelRow = ROW_GAP + labelLine
    val bandNameBlock = if (bandNamesShown) ROW_GAP + BAND_ORDER.size * BAND_NAME_LINE else 0.0
    val stackHeight = productNameRow + rateRow + barRow + labelRow + bandNameBlock

    val svgHeight = if (social) SOCIAL_HEIGHT else stackHeight
    val stackTop = if (social) round((SOCIAL_HEIGHT - stackHeight) / 2) else 0.0

    val trackY = round(stackTop + productNameRow + rateRow + TICK_PROTRUSION)
    val rx = trackHeight / 2

    val fillFraction = clamp(data.percentage, 0.0, PERCENT) / PERCENT
    val clampedFill = data.percentage < 0 || data.percentage > PERCENT

    val track = RailRect(x = trackX, y = trackY, width = trackWidth, height = trackHeight, rx = rx)
    val fill =
        RailRect(x = trackX, y = trackY, width = round(trackWidth * fillFraction), height = trackHeight, rx = rx)

    val labelBaselineY = round(trackY + trackHeight + TICK_PROTRUSION + ROW_GAP + labelSize)

    fun tickAt(
        ceilingFraction: Double,
        anchor: LabelAnchor,
    ): RailTick {
        val percentage = ceilingFraction * PERCENT
        val centre = round(trackX + trackWidth * (percentage / PERCENT))

        return RailTick(
            percentage = percentage,
            x = round(centre - TICK_WIDTH / 2),
            y = round(trackY - TICK_PROTRUSION),
            width = TICK_WIDTH,
            height = trackHeight + TICK_PROTRUSION * 2,
            labelX = centre,
            labelY = labelBaselineY,
            labelAnchor = anchor,
        )
    }

    val bandSegments =
        if (social) {
            val bands =
                listOf(
                    Triple(Zone.COMPLIANT, 0.0, thresholds.fiscalCeiling),
                    Triple(Zone.FISCAL_EXPOSURE, thresholds.fiscalCeiling, thresholds.socialCeiling),
                    Triple(Zone.SOCIAL_SWITCH, thresholds.socialCeiling, 1.0),
                )
            bands.map { (zone, from, to) ->
                RailBandSegment(
                    zone = zone,
                    x = round(trackX + trackWidth * from),
                    width = round(trackWidth * (to - from)),
                )
            }
        } else {
            emptyList()
        }

    val bandNameRows =
        if (bandNamesShown) {
            BAND_ORDER.mapIndexed { index, zone ->
                RailBandRow(zone = zone, y = round(labelBaselineY + ROW_GAP + MICRO_SIZE + index * BAND_NAME_LINE))
            }
        } else {
            emptyList()
        }

    return RailGeometry(
        svgWidth = svgWidth,
        svgHeight = svgHeight,
        track = track,
        fill = fill,
        ticks =
            listOf(
                tickAt(thresholds.fiscalCeiling, LabelAnchor.END),
                tickAt(thresholds.socialCeiling, LabelAnchor.START),
            ),
        percentage = data.percentage,
        clampedFill = clampedFill,
        clampedWidth = clampedWidth,
        bandNamesShown = bandNamesShown,
        bandNameX = trackX,
        bandNameRows = bandNameRows,
        bandSegments = bandSegments,
        rateShown = rateShown,
        rateBaselineY = round(stackTop + productNameRow + CAPTION_SIZE),
        productNameShown = productNameShown,
        productNameBaselineY = round(stackTop + H2_SIZE),
    )
}
