package ch.monreleve.app.design

// AN3 increment 4. First Paparazzi coverage for the six increment-4
// components, one state each - a regression guard, never proof of
// correctness (R135). Increment 5 states the full states-covered scope
// explicitly and extends this to every remaining state; increment 6's
// walkthrough is what a person actually looks at.

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.fr.format.SignedDays
import org.junit.Rule
import org.junit.Test

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
    fun zoneBadgeMissionExposure() {
        snapshot { ZoneBadge(status = Status.MISSION_EXPOSURE) }
    }

    @Test
    fun rateDisplayDiverging() {
        // Geneva case (c): 39,16% declarable, 45,0% raw.
        snapshot { RateDisplay(declarableRate = 39.16, zone = Zone.COMPLIANT, rawRate = 45.0) }
    }

    @Test
    fun metricTileNegative() {
        snapshot {
            MetricTile(
                label = "Jours restants avant le plafond fiscal",
                overLabel = "Jours au-dessus du plafond fiscal",
                days = SignedDays(text = "4", negative = true),
            )
        }
    }

    @Test
    fun dayCellMissionCorrected() {
        snapshot {
            DayCell(dayOfMonth = 14, kind = DayKind.MISSION, quality = RecordQuality.LATE, corrected = true)
        }
    }

    @Test
    fun dayKindLegend() {
        snapshot { DayKindLegend() }
    }

    @Test
    fun confidenceTierMedium() {
        snapshot { ConfidenceTierBadge(tier = ConfidenceTier.MEDIUM) }
    }
}
