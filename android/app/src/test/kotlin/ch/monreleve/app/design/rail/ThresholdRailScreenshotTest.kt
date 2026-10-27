package ch.monreleve.app.design.rail

// AN3 increment 3. First Paparazzi coverage for the rail component - a
// regression guard, never proof of correctness (R135); the walkthrough
// (increment 6) is what looks at a real device. Increment 5 extends this
// same discipline to every remaining component and states its scope
// explicitly.

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneThresholds
import org.junit.Rule
import org.junit.Test

private val RULES = ruleSetFor(2026)
private val THRESHOLDS = ZoneThresholds(RULES.fiscalCeiling, RULES.socialCeiling)

class ThresholdRailScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
        )

    @Test
    fun inlineCompliant() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ThresholdRail(
                        percentage = 30.0,
                        zone = Zone.COMPLIANT,
                        variant = RailVariant.INLINE,
                        thresholds = THRESHOLDS,
                        modifier = Modifier.fillMaxWidth().padding(Spacing.space20),
                    )
                }
            }
        }
    }

    @Test
    fun inlineFiscalExposure() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ThresholdRail(
                        percentage = 45.0,
                        zone = Zone.FISCAL_EXPOSURE,
                        variant = RailVariant.INLINE,
                        thresholds = THRESHOLDS,
                        modifier = Modifier.fillMaxWidth().padding(Spacing.space20),
                    )
                }
            }
        }
    }

    @Test
    fun inlineSocialSwitch() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ThresholdRail(
                        percentage = 55.0,
                        zone = Zone.SOCIAL_SWITCH,
                        variant = RailVariant.INLINE,
                        thresholds = THRESHOLDS,
                        modifier = Modifier.fillMaxWidth().padding(Spacing.space20),
                    )
                }
            }
        }
    }

    @Test
    fun compactAt320Dp() {
        // R127/the 320 dp requirement: the narrowest width this product
        // supports, checked explicitly rather than only at the default.
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ThresholdRail(
                        percentage = 39.16,
                        zone = Zone.COMPLIANT,
                        variant = RailVariant.COMPACT,
                        thresholds = THRESHOLDS,
                        modifier = Modifier.width(320.dp).padding(Spacing.space20),
                    )
                }
            }
        }
    }

    @Test
    fun social() {
        // KNOWN LIMIT, found rather than assumed: SPEC 6.3's social card is
        // 1200x630, PIXEL_5's own viewport is far narrower, and Paparazzi's
        // DeviceConfig.copy(screenWidth=1200, screenHeight=630, xdpi=160,
        // ydpi=160) - the documented way to widen the canvas - measured to
        // NOT produce a 1200x630 output (525x1000 was recorded instead, an
        // unrelated aspect ratio). Not pursued further: the web reference's
        // own social card is not embedded in a page either - it renders
        // through a standalone OG-image route - so an Android equivalent
        // most likely wants its own dedicated render path too, which is a
        // question for whichever task adds a share-image feature, not this
        // one. This baseline is the left portion of the card, cropped by
        // the viewport - real content, incompletely captured, not a
        // rendering defect. See REPORT-AN3.txt.
        paparazzi.snapshot {
            FrontierTheme {
                ThresholdRail(
                    percentage = 0.0,
                    zone = Zone.COMPLIANT,
                    variant = RailVariant.SOCIAL,
                    thresholds = THRESHOLDS,
                )
            }
        }
    }

    @Test
    fun unavailable() {
        // R33's third state: a non-finite rate. Never a colour, never an
        // empty rail read as "compliant" - a word.
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ThresholdRail(
                        percentage = Double.NaN,
                        zone = Zone.COMPLIANT,
                        variant = RailVariant.INLINE,
                        thresholds = THRESHOLDS,
                        modifier = Modifier.fillMaxWidth().padding(Spacing.space20),
                    )
                }
            }
        }
    }
}
