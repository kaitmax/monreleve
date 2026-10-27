package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ParametresCopy
import org.junit.Rule
import org.junit.Test

// AN12 increment 5. The R290 before/after rate rows, at default and 200 percent. The device walkthrough found
// (k-02) that at fontScale 2 the "Apres enregistrement" value fragmented into unreadable pieces when the label
// and value were both unconstrained in a SpaceBetween Row - the after-rate, the whole point of the dialog,
// illegible at 200 percent. This photographs the fixed RateRow (the label flexes and wraps; the value keeps
// its intrinsic width) so a person can confirm "0,83 %" stays whole. A regression guard, not the correctness
// proof - the device is (R176/R177) - but the one that would catch this exact fragment coming back.

class ParametresDialogScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
        )

    @Composable
    private fun host() {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.background) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(Spacing.space16),
                    verticalArrangement = Arrangement.spacedBy(Spacing.space8),
                ) {
                    RateRow(ParametresCopy.RATE_CHANGE_BEFORE_LABEL, BEFORE_RATE)
                    RateRow(ParametresCopy.RATE_CHANGE_AFTER_LABEL, AFTER_RATE)
                }
            }
        }
    }

    @Test
    fun rateRowsDefault() {
        paparazzi.snapshot { host() }
    }

    @Test
    fun rateRowsLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host() }
    }

    private companion object {
        // The walkthrough's own figures: 1 HOME day at rate 100 (0,41 %) and at rate 50 (0,83 %).
        const val BEFORE_RATE = 0.41
        const val AFTER_RATE = 0.83
    }
}
