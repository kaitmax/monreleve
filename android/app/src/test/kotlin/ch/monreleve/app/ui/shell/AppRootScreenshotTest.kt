package ch.monreleve.app.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.LightColors
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import kotlin.math.roundToInt

// AN-EDGE-INSETS (R1171's positive half, R154). The census proves every screen is HOSTED by AppRoot; this proves
// AppRoot DOES what hosting is supposed to buy - measured, not read from source. Paparazzi's window reports no system
// bars, so the test hands AppRoot fixed insets (its `insets` parameter, whose default is the real set) and reads the
// bounds its content is laid out in:
//   - the content starts exactly inside the insets on all four sides (the padding is APPLIED), and
//   - a second windowInsetsPadding of the same insets beneath it - what MainShell's Scaffold and NavigationBar each
//     do - moves nothing (the insets were CONSUMED once, so no Scaffold screen pads twice).
// The baseline is the picture of the same thing: the canvas bands are the insets, and the white fills the rest with
// no second band inside it. A regression guard for the look (R135); the two assertions are the proof.

class AppRootScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
            // R345: zero, stated (fences/PaparazziZeroToleranceTest reads the value).
            maxPercentDifference = 0.0,
        )

    @Test
    fun appRootPadsTheInsetsOnce() {
        val insets = WindowInsets(left = 8.dp, top = 24.dp, right = 16.dp, bottom = 48.dp)
        var window: IntSize? = null
        var outer: Rect? = null
        var inner: Rect? = null
        var density = 0f
        paparazzi.snapshot {
            density = LocalDensity.current.density
            Box(modifier = Modifier.fillMaxSize().onGloballyPositioned { window = it.size }) {
                AppRoot(insets = insets) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .onGloballyPositioned { outer = it.boundsInRoot() }
                                .windowInsetsPadding(insets)
                                .onGloballyPositioned { inner = it.boundsInRoot() }
                                .background(LightColors.surface),
                    )
                }
            }
        }
        val size = window ?: error("the root was never laid out")
        val content = outer ?: error("AppRoot's content was never laid out")

        fun px(dp: Int): Float = (dp * density).roundToInt().toFloat()

        // APPLIED: AppRoot's content sits exactly inside the insets.
        assertEquals("left", px(8), content.left, 0f)
        assertEquals("top", px(24), content.top, 0f)
        assertEquals("right", size.width - px(16), content.right, 0f)
        assertEquals("bottom", size.height - px(48), content.bottom, 0f)
        // CONSUMED: the same insets applied again beneath AppRoot add nothing.
        assertEquals("a second application of the insets moved the content", content, inner)
    }
}
