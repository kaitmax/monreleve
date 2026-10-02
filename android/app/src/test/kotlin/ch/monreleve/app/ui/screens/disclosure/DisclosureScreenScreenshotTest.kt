package ch.monreleve.app.ui.screens.disclosure

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
 * AN-AUTO increment 3b: the prominent disclosure (R316 / D5 / SPEC 11.1). A regression guard. Captured at
 * default and 200 percent (fontScale 2f) - the Android-10 warning paragraph is the longest, so the large
 * variant is where a layout defect would show (R178: crop and look).
 */
class DisclosureScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    @Composable
    private fun host() {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                DisclosureScreen(onAllow = {}, onStayManual = {})
            }
        }
    }

    @Test
    fun disclosure() {
        paparazzi.snapshot { host() }
    }

    @Test
    fun disclosureLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host() }
    }
}
