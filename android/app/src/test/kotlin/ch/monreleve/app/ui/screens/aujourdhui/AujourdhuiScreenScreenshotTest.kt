package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import org.junit.Rule
import org.junit.Test

/**
 * AN1 increment 5: component-level baseline for the placeholder Aujourd'hui
 * (AC1's shape, as a regression guard - never as the proof of correctness;
 * that proof is the walkthrough, R176/R177/R135). Paparazzi over Roborazzi:
 * empirically verified to apply and run against this application module
 * (`./gradlew :app:tasks --all` registers record/verifyPaparazzi*; the only
 * failure on the first run was a missing `src/test/snapshots` directory, not
 * a module-type rejection) - so it needs neither Robolectric nor its ~150-300
 * MB android-all download, which R136 would otherwise require justifying.
 *
 * DEVICE CONFIG PINNED HERE (relay/AN1.txt increment 5): PIXEL_5, portrait,
 * light mode only (FrontierTheme has no dark variant wired - see
 * FrontierTheme.kt). Changing this regenerates every baseline in the file.
 */
class AujourdhuiScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    @Test
    fun aujourdhuiPlaceholder() {
        // Mirrors MainActivity.kt's actual host exactly: Surface's own
        // default colour is colorScheme.surface (white), not the canvas -
        // MainActivity sets `color = background` explicitly, and the first
        // recorded baseline (a white canvas, not #F7F8FA) silently omitted
        // it, found by comparing against the real walkthrough PNG.
        paparazzi.snapshot {
            FrontierTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    AujourdhuiScreen()
                }
            }
        }
    }
}
