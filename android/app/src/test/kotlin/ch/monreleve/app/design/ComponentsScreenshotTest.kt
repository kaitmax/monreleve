package ch.monreleve.app.design

// AN3 increments 4-5. Paparazzi coverage for the six increment-4
// components, across every closed-enum state - a regression guard,
// never proof of correctness (R135); the walkthrough (increment 6) is
// what a person actually looks at and describes in words.
//
// SCOPE, STATED RATHER THAN LEFT IMPLICIT (R176's own "direct attention,
// never restrict it" - a scope note names what IS covered so a reader
// does not have to guess what a silent absence means): every Status
// (ZoneBadge, 4), every ConfidenceTier (3), a representative DayCell per
// DayKind crossed with one RecordQuality each rather than the full 4x4
// grid (16 cases add little beyond the geometry ComponentLogicTest.kt
// already asserts - color/letter/dot are independent per-property
// lookups, not per-combination logic), MetricTile's two signs, and
// RateDisplay's converging/diverging pair. The rail's own six states are
// increment 3's own file, unchanged here.

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.fr.MetricCopy
import ch.monreleve.app.fr.format.SignedDays
import ch.monreleve.app.fr.format.formatPercent
import org.junit.Rule
import org.junit.Test

// AN4 increment 0 - Q3. MetricTile's captions were hand-typed noun phrases
// ("...avant le plafond fiscal") that encoded the PRE-contract form. MetricCopy's
// documented contract (web/lib/fr/metrics.ts) is a formatted PERCENTAGE, so the
// caption is derived here from the RuleSet exactly as the gallery's own tile does
// (formatPercent of the ceiling) - codepoint-faithful (the U+202F before %) and
// moving with the ceiling rather than going stale. Regenerated baselines:
// metricTilePositive.png, metricTileNegative.png (R135/R207).
private val RULES = ruleSetFor(2026)
private const val PERCENT = 100.0
private val FISCAL_CEILING_LABEL = formatPercent(RULES.fiscalCeiling * PERCENT, 0)

class ComponentsScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private fun snapshot(content: @androidx.compose.runtime.Composable () -> Unit) {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    Column(modifier = Modifier.padding(Spacing.space20)) { content() }
                }
            }
        }
    }

    @Test
    fun zoneBadgeCompliant() {
        snapshot { ZoneBadge(status = Status.COMPLIANT) }
    }

    @Test
    fun zoneBadgeMissionExposure() {
        snapshot { ZoneBadge(status = Status.MISSION_EXPOSURE) }
    }

    @Test
    fun zoneBadgeRegimeLost() {
        snapshot { ZoneBadge(status = Status.REGIME_LOST) }
    }

    @Test
    fun zoneBadgeSocialSwitch() {
        snapshot { ZoneBadge(status = Status.SOCIAL_SWITCH) }
    }

    @Test
    fun rateDisplayConverging() {
        snapshot { RateDisplay(declarableRate = 30.0, zone = Zone.COMPLIANT, rawRate = 30.0) }
    }

    @Test
    fun rateDisplayDiverging() {
        // Geneva case (c): 39,16% declarable, 45,0% raw.
        snapshot { RateDisplay(declarableRate = 39.16, zone = Zone.COMPLIANT, rawRate = 45.0) }
    }

    @Test
    fun metricTilePositive() {
        snapshot {
            MetricTile(
                label = MetricCopy.remaining(FISCAL_CEILING_LABEL),
                overLabel = MetricCopy.over(FISCAL_CEILING_LABEL),
                days = SignedDays(text = "24", negative = false),
            )
        }
    }

    @Test
    fun metricTileNegative() {
        snapshot {
            MetricTile(
                label = MetricCopy.remaining(FISCAL_CEILING_LABEL),
                overLabel = MetricCopy.over(FISCAL_CEILING_LABEL),
                days = SignedDays(text = "4", negative = true),
            )
        }
    }

    @Test
    fun dayCellSuisseOnTime() {
        snapshot {
            DayCell(dayOfMonth = 3, kind = DayKind.SUISSE, quality = RecordQuality.ON_TIME, corrected = false)
        }
    }

    @Test
    fun dayCellDomicileMissing() {
        snapshot {
            DayCell(dayOfMonth = 9, kind = DayKind.DOMICILE, quality = RecordQuality.MISSING, corrected = false)
        }
    }

    @Test
    fun dayCellMissionCorrected() {
        snapshot {
            DayCell(dayOfMonth = 14, kind = DayKind.MISSION, quality = RecordQuality.LATE, corrected = true)
        }
    }

    @Test
    fun dayCellAbsence() {
        snapshot {
            DayCell(dayOfMonth = 21, kind = DayKind.ABSENCE, quality = RecordQuality.NONE, corrected = false)
        }
    }

    @Test
    fun dayCellUnrecorded() {
        // D38: nothing when unrecorded - no letter, no dot, no bar.
        snapshot {
            DayCell(dayOfMonth = 28, kind = null, quality = RecordQuality.NONE, corrected = false)
        }
    }

    @Test
    fun dayKindLegend() {
        snapshot { DayKindLegend() }
    }

    @Test
    fun confidenceTierLow() {
        snapshot { ConfidenceTierBadge(tier = ConfidenceTier.LOW) }
    }

    @Test
    fun confidenceTierMedium() {
        snapshot { ConfidenceTierBadge(tier = ConfidenceTier.MEDIUM) }
    }

    @Test
    fun confidenceTierHigh() {
        snapshot { ConfidenceTierBadge(tier = ConfidenceTier.HIGH) }
    }
}
