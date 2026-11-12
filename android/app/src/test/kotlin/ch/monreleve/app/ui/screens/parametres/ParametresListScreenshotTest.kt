package ch.monreleve.app.ui.screens.parametres

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresPhase
import org.junit.Rule
import org.junit.Test

// AN-PARAM-BASELINES (R871, IOS-2e UNNUMBERED-3). The Parametres LIST - the screen as it opens - through the
// product's own entry point (ParametresHost: :app's public ParametresScreen). No baseline showed it before: the
// screen moved into :shared at IOS-2e and its Android pixels rested on files being byte-identical.
//
// THE WHOLE LIST, NOT ITS FIRST SCREENFUL. The column scrolls and Paparazzi cannot, so the device is TALL (the
// Comparison/Releve precedent) and « Mes données » and « À propos » are photographed too. AT DEVICE RESOLUTION:
// Paparazzi scales every image to 1 000 px on its longest side, so a 5 800 px list would be ~190 px wide - a
// baseline nobody could read (R873). The states are the code's own branches (R871's list, in the report).

private const val TALL = 5800
private const val TALLER = 12000

class ParametresListScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = TALL),
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
            useDeviceResolution = true,
        )

    // Detection off: no evening row. « Toute l'année », « 100 % », the 240-day method, whole days.
    @Test
    fun parametresList() {
        paparazzi.snapshot { ParametresHost(defaultParametresState) }
    }

    // Every list branch flipped: detection on (so the evening row exists), all three switches on, the real-days
    // method, half days, a start date (dd.MM.yyyy) and a rate other than 100.
    @Test
    fun parametresListFilled() {
        paparazzi.snapshot {
            ParametresHost(
                defaultParametresState.copy(
                    employmentRate = "80",
                    denominator = DenominatorChoice.EXACT,
                    exactTotalWorkDays = "200",
                    granularity = GranularityChoice.HALF_DAY,
                    activityStartDate = "2026-03-02",
                    autoDetectionEnabled = true,
                    eveningNotificationEnabled = true,
                    thresholdAlertEnabled = true,
                ),
            )
        }
    }

    // No canton (the placeholder) and an empty rate (rateValue's non-integer branch shows the raw string).
    @Test
    fun parametresListEmpty() {
        paparazzi.snapshot {
            ParametresHost(defaultParametresState.copy(canton = null, employmentRate = ""))
        }
    }

    // A save in flight: the three switches are disabled (SaisieSection's `enabled`). Detection on, so all three show.
    @Test
    fun parametresListSaving() {
        paparazzi.snapshot {
            ParametresHost(defaultParametresState.copy(autoDetectionEnabled = true, phase = ParametresPhase.SAVING))
        }
    }

    @Test
    fun parametresListLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(screenHeight = TALLER, fontScale = 2f))
        paparazzi.snapshot { ParametresHost(defaultParametresState) }
    }
}
