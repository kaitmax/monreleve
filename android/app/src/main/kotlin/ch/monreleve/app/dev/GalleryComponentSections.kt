package ch.monreleve.app.dev

// AN3 increment 6. See GalleryScreen.kt's own header for why these
// sections live in their own file.

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.ConfidenceTier
import ch.monreleve.app.design.ConfidenceTierBadge
import ch.monreleve.app.design.DayCell
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.DayKindLegend
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.MetricTile
import ch.monreleve.app.design.RateDisplay
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.Status
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneBadge
import ch.monreleve.app.fr.GalleryCopy
import ch.monreleve.app.fr.GalleryFixtures
import ch.monreleve.app.fr.MetricCopy
import ch.monreleve.app.fr.format.formatDate
import ch.monreleve.app.fr.format.formatDateTime
import ch.monreleve.app.fr.format.formatDays
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.fr.format.formatSignedDays
import kotlin.math.floor

private const val PERCENT_FACTOR = 100.0

/**
 * SPEC 9.3: "jours restants avant 40 %" - a formatted PERCENTAGE, never a
 * noun phrase. web/lib/fr/metrics.ts documents this explicitly ("threshold
 * is an already-formatted percentage... passing a NUMBER here would put
 * the formatting decision in two places") - found only after this file's
 * first version called MetricCopy with "le plafond fiscal" and rendered
 * "Jours au-dessus de le plafond fiscal", see MetricCopy.kt's own header.
 * Zero decimals for a whole ceiling, one otherwise - the same rule
 * ThresholdRail.kt's own tick labels use.
 */
private fun thresholdLabel(percent: Double): String {
    val decimals = if (percent == floor(percent)) 0 else 1
    return formatPercent(percent, decimals)
}

private val FISCAL_CEILING_LABEL = thresholdLabel(RULES.fiscalCeiling * PERCENT_FACTOR)

internal fun LazyListScope.badgeSection() {
    item { SectionHeader(GalleryCopy.SECTION_BADGE) }
    item {
        Caption(GalleryCopy.BADGE_COMPLIANT)
        ZoneBadge(status = Status.COMPLIANT, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.BADGE_MISSION_EXPOSURE)
        ZoneBadge(status = Status.MISSION_EXPOSURE, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.BADGE_REGIME_LOST)
        ZoneBadge(status = Status.REGIME_LOST, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.BADGE_SOCIAL_SWITCH)
        ZoneBadge(status = Status.SOCIAL_SWITCH, modifier = ITEM_BOTTOM)
    }
}

internal fun LazyListScope.rateSection() {
    item { SectionHeader(GalleryCopy.SECTION_RATE) }
    item {
        Caption(GalleryCopy.RATE_CONVERGING)
        RateDisplay(declarableRate = 30.0, zone = Zone.COMPLIANT, rawRate = 30.0, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.RATE_DIVERGING)
        RateDisplay(declarableRate = 39.16, zone = Zone.COMPLIANT, rawRate = 45.0, modifier = ITEM_BOTTOM)
    }
}

internal fun LazyListScope.tileSection() {
    item { SectionHeader(GalleryCopy.SECTION_TILE) }
    item {
        Caption(GalleryCopy.TILE_POSITIVE)
        MetricTile(
            label = MetricCopy.remaining(FISCAL_CEILING_LABEL),
            overLabel = MetricCopy.over(FISCAL_CEILING_LABEL),
            days = formatSignedDays(24.0),
            modifier = ITEM_BOTTOM,
        )
    }
    item {
        Caption(GalleryCopy.TILE_NEGATIVE)
        MetricTile(
            label = MetricCopy.remaining(FISCAL_CEILING_LABEL),
            overLabel = MetricCopy.over(FISCAL_CEILING_LABEL),
            days = formatSignedDays(-4.0),
            modifier = ITEM_BOTTOM,
        )
    }
}

internal fun LazyListScope.dayCellSection() {
    item { SectionHeader(GalleryCopy.SECTION_DAY_CELL) }
    item {
        Row(modifier = Modifier.padding(bottom = Spacing.space8)) {
            DayCell(dayOfMonth = 3, kind = DayKind.SUISSE, quality = RecordQuality.ON_TIME, corrected = false)
            DayCell(dayOfMonth = 9, kind = DayKind.DOMICILE, quality = RecordQuality.MISSING, corrected = false)
            DayCell(dayOfMonth = 14, kind = DayKind.MISSION, quality = RecordQuality.LATE, corrected = true)
            DayCell(dayOfMonth = 21, kind = DayKind.ABSENCE, quality = RecordQuality.NONE, corrected = false)
            DayCell(dayOfMonth = 28, kind = null, quality = RecordQuality.NONE, corrected = false)
            // AN10: a recorded-but-unsynced day (no bar, quality not yet the server's) and today
            // (fill + brand number). Both from the calendar, DayKind letters carrying the country.
            DayCell(dayOfMonth = 4, kind = DayKind.DOMICILE, quality = RecordQuality.PENDING, corrected = false)
            DayCell(
                dayOfMonth = 15,
                kind = DayKind.SUISSE,
                quality = RecordQuality.ON_TIME,
                corrected = false,
                isToday = true,
            )
        }
        // R119's shape, carried from increment 4's own text: a legend
        // wherever a DayCell grid exists, asserted by
        // fences/DayCellGridHasLegendTest.kt rather than assumed to follow
        // from the row above existing.
        DayKindLegend(modifier = ITEM_BOTTOM)
    }
}

internal fun LazyListScope.formattersSection() {
    item { SectionHeader(GalleryCopy.SECTION_FORMATTERS) }
    item {
        // AC1: codepoint-exact. Rendered here so the walkthrough can look
        // directly at the Swiss dots, the a-grave with U+00A0 on both
        // sides, and U+202F's thousands grouping - formatPercent is
        // already exercised above (RateDisplay/ThresholdRail both call
        // it), so it is not repeated here.
        Text(text = formatDate(GalleryFixtures.EXAMPLE_DATE), style = FrontierType.body)
        Text(text = formatDateTime(GalleryFixtures.EXAMPLE_INSTANT), style = FrontierType.body)
        Text(text = formatDays(1234.5), style = FrontierType.body)
    }
}

internal fun LazyListScope.confidenceSection() {
    item { SectionHeader(GalleryCopy.SECTION_CONFIDENCE) }
    item {
        Caption(GalleryCopy.CONFIDENCE_LOW)
        ConfidenceTierBadge(tier = ConfidenceTier.LOW, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.CONFIDENCE_MEDIUM)
        ConfidenceTierBadge(tier = ConfidenceTier.MEDIUM, modifier = ITEM_BOTTOM)
    }
    item {
        Caption(GalleryCopy.CONFIDENCE_HIGH)
        ConfidenceTierBadge(tier = ConfidenceTier.HIGH, modifier = Modifier.padding(bottom = Spacing.space40))
    }
}
