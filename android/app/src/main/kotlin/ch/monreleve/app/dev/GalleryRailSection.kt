package ch.monreleve.app.dev

// AN3 increment 6. See GalleryScreen.kt's own header for why this section
// lives in its own file and is split into two functions rather than one.

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.Breakpoints
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.rail.RailVariant
import ch.monreleve.app.design.rail.ThresholdRail
import ch.monreleve.app.fr.GalleryCopy

internal fun LazyListScope.railInlineSection() {
    item { SectionHeader(GalleryCopy.SECTION_RAIL) }
    item {
        Caption(GalleryCopy.RAIL_INLINE_COMPLIANT)
        ThresholdRail(
            percentage = 30.0,
            zone = Zone.COMPLIANT,
            variant = RailVariant.INLINE,
            thresholds = THRESHOLDS,
            modifier = Modifier.fillMaxWidth().then(ITEM_BOTTOM),
        )
    }
    item {
        Caption(GalleryCopy.RAIL_INLINE_FISCAL_EXPOSURE)
        ThresholdRail(
            percentage = 45.0,
            zone = Zone.FISCAL_EXPOSURE,
            variant = RailVariant.INLINE,
            thresholds = THRESHOLDS,
            modifier = Modifier.fillMaxWidth().then(ITEM_BOTTOM),
        )
    }
    item {
        Caption(GalleryCopy.RAIL_INLINE_SOCIAL_SWITCH)
        ThresholdRail(
            percentage = 55.0,
            zone = Zone.SOCIAL_SWITCH,
            variant = RailVariant.INLINE,
            thresholds = THRESHOLDS,
            modifier = Modifier.fillMaxWidth().then(ITEM_BOTTOM),
        )
    }
}

internal fun LazyListScope.railOtherSection() {
    item {
        // R127/the 320 dp requirement, checked explicitly: a fixed 320 dp
        // width nested inside the gallery, not the gallery's own width -
        // that one is exercised separately by the walkthrough's own
        // 320 dp emulator capture (relay/AN3.txt increment 6).
        Caption(GalleryCopy.RAIL_COMPACT_320)
        ThresholdRail(
            percentage = 39.16,
            zone = Zone.COMPLIANT,
            variant = RailVariant.COMPACT,
            thresholds = THRESHOLDS,
            modifier = Modifier.width(Breakpoints.minSupportedWidth).then(ITEM_BOTTOM),
        )
    }
    item {
        Caption(GalleryCopy.RAIL_SOCIAL)
        ThresholdRail(
            percentage = 0.0,
            zone = Zone.COMPLIANT,
            variant = RailVariant.SOCIAL,
            thresholds = THRESHOLDS,
            modifier = ITEM_BOTTOM,
        )
    }
    item {
        // No Caption() here, deliberately: the rail's own unavailable
        // state already renders RailCopy.RAIL_UNAVAILABLE_LABEL on
        // screen (R33) - a caption repeating the identical string just
        // printed it twice in a row, found by looking at the walkthrough
        // screenshot rather than assumed harmless.
        ThresholdRail(
            percentage = Double.NaN,
            zone = Zone.COMPLIANT,
            variant = RailVariant.INLINE,
            thresholds = THRESHOLDS,
            modifier = Modifier.fillMaxWidth().then(ITEM_BOTTOM),
        )
    }
}
