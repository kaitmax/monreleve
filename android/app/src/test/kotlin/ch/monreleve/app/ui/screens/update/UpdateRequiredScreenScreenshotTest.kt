package ch.monreleve.app.ui.screens.update

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import org.junit.Rule
import org.junit.Test

/**
 * AN-FORCE-UPDATE (R1111): the update screen at the default text size and at 200 percent (fontScale 2f). TWO NEW
 * baselines, named before they were recorded (R207): UpdateRequiredScreenScreenshotTest_updateRequiredDefault and
 * _updateRequiredLarge. No existing baseline moves - the screen is new and no shared component changed. Device
 * PIXEL_5 light, as the other baselines; the emulator run in REPORT-AN-FORCE-UPDATE is the hosted view.
 */
class UpdateRequiredScreenScreenshotTest {
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
    private fun frame(content: @Composable () -> Unit) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { content() }
        }
    }

    @Test fun updateRequiredDefault() = paparazzi.snapshot { frame { UpdateRequiredScreen(onUpdate = {}) } }

    @Test fun updateRequiredLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { frame { UpdateRequiredScreen(onUpdate = {}) } }
    }
}
