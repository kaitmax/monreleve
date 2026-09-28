package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.OnboardingState
import org.junit.Rule
import org.junit.Test

/**
 * AN5b increment 1: baselines for the manual-onboarding screen (AC1's shape, a regression guard, not
 * the proof of correctness - that is increment 6's emulator walkthrough, R176/R177/R135). Captured
 * at the DEFAULT text size and at 200 percent (fontScale 2f), which is AC1's accessibility
 * requirement made a cheap, repeatable JVM snapshot rather than an emulator drive per increment.
 *
 * Two states: an empty form, and a filled EXACT-method form (so the canton consequence line and the
 * exact-total field both render). Device pinned to PIXEL_5 light, as the Aujourd'hui baseline is.
 */
class OnboardingScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val emptyState = OnboardingState()

    private val filledExact =
        OnboardingState(
            canton = Canton.GE,
            employmentRate = "80",
            denominator = DenominatorChoice.EXACT,
            exactTotalWorkDays = "220",
            granularity = GranularityChoice.HALF_DAY,
            activityStartDate = "2026-03-01",
        )

    @Composable
    private fun host(state: OnboardingState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                OnboardingScreen(
                    state = state,
                    actions =
                        OnboardingActions(
                            onCantonChange = {},
                            onEmploymentRateChange = {},
                            onDenominatorChange = {},
                            onExactTotalChange = {},
                            onGranularityChange = {},
                            onActivityStartDateChange = {},
                            onSubmit = {},
                        ),
                )
            }
        }
    }

    @Test
    fun onboardingEmpty() {
        paparazzi.snapshot { host(emptyState) }
    }

    @Test
    fun onboardingEmptyLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(emptyState) }
    }

    @Test
    fun onboardingFilledExact() {
        paparazzi.snapshot { host(filledExact) }
    }

    @Test
    fun onboardingFilledExactLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(filledExact) }
    }
}
