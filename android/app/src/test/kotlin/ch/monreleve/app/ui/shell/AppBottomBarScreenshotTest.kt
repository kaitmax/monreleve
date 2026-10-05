package ch.monreleve.app.ui.shell

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import org.junit.Rule
import org.junit.Test

// AN-CAL2 defect 4. The screenshot assertion that the bottom navigation's selected item is the brand colour
// with NO indicator pill (DESIGN-SYSTEM.md section 1 BOTTOM NAV), so the Material3 default pink pill + red
// icon cannot return. A regression guard (R135): it certifies the nav keeps looking the way the baseline
// shows, which the reviewer cropped and looked at (R178). Captured with Calendrier active, so the baseline
// shows one brand-tinted item (no pill behind it) among three neutral ones.

class AppBottomBarScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    @Test
    fun appBottomBarCalendrierActive() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    AppBottomBar(selected = AppTab.CALENDRIER, onSelect = {})
                }
            }
        }
    }
}
