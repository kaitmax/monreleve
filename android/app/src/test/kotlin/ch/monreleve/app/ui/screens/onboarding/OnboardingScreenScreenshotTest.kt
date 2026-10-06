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
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingState
import ch.monreleve.app.onboarding.OnboardingStep
import ch.monreleve.app.onboarding.RateChoice
import ch.monreleve.app.settings.Settings
import org.junit.Rule
import org.junit.Test

/**
 * AN-ONBOARD: baselines for the onboarding wizard and "Tout est prêt", at the default text size and at 200
 * percent (fontScale 2f) - the accessibility requirement as a cheap JVM snapshot. The emulator drive is the
 * parent's walkthrough (R176). Device PIXEL_5 light, as the other baselines.
 *
 * AN-ONBOARD-2 (R336): the wizard is now EIGHT steps - a granularity step (whole days / half-days) after Méthode
 * - so every step reads "Étape N sur 8" with an eight-segment bar, and `granularite`/`granulariteLarge` are new.
 * The step state carries the full step list by default (OnboardingState.steps = DEFAULT_STEPS), so each card's
 * number and total are computed the way the live wizard computes them.
 */
class OnboardingScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val noop =
        OnboardingActions(
            onNameChange = {},
            onCantonChange = {},
            onRateChoiceChange = {},
            onCustomRateChange = {},
            onDenominatorChange = {},
            onExactTotalChange = {},
            onGranularityChange = {},
            onAllYearChange = {},
            onActivityStartDateChange = {},
            onChooseManual = {},
            onChooseAuto = {},
            onReminderYes = {},
            onReminderNo = {},
            onNext = {},
            onBack = {},
        )

    private val base =
        OnboardingState(name = "Camille Martin", canton = Canton.GE, rateChoice = RateChoice.R100)

    private val tauxOtherState =
        base.copy(step = OnboardingStep.TAUX, rateChoice = RateChoice.OTHER, customRate = "75")
    private val methodeExactState =
        base.copy(
            step = OnboardingStep.METHODE,
            denominator = DenominatorChoice.EXACT,
            exactTotalWorkDays = "220",
        )
    private val periodePartialState =
        base.copy(step = OnboardingStep.PERIODE, allYear = false, activityStartDate = "2026-07-01")
    private val modeAutoState =
        base.copy(step = OnboardingStep.MODE, mode = ModeChoice.AUTO_DETECT)

    @Composable
    private fun step(state: OnboardingState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                OnboardingScreen(state = state, actions = noop)
            }
        }
    }

    @Composable
    private fun pret() {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                PretScreen(
                    settings =
                        Settings(
                            canton = "GE",
                            employmentRate = 100,
                            denominatorKind = "SIMPLIFIED240",
                            exactTotalWorkDays = null,
                            granularity = "DAY",
                            activityStartDate = "2026-07-01",
                            name = "Camille Martin",
                        ),
                    taxYear = 2026,
                    onContinue = {},
                )
            }
        }
    }

    private fun large() = paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))

    @Test fun nom() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.NOM)) }

    @Test fun nomLarge() {
        large()
        paparazzi.snapshot { step(base.copy(step = OnboardingStep.NOM)) }
    }

    @Test fun canton() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.CANTON)) }

    @Test fun taux() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.TAUX)) }

    @Test fun tauxOther() = paparazzi.snapshot { step(tauxOtherState) }

    @Test fun methode() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.METHODE)) }

    @Test fun methodeExact() = paparazzi.snapshot { step(methodeExactState) }

    @Test fun granularite() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.GRANULARITY)) }

    @Test fun granulariteLarge() {
        large()
        paparazzi.snapshot { step(base.copy(step = OnboardingStep.GRANULARITY)) }
    }

    @Test fun periode() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.PERIODE)) }

    @Test fun periodePartial() = paparazzi.snapshot { step(periodePartialState) }

    @Test fun mode() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.MODE)) }

    @Test fun modeAuto() = paparazzi.snapshot { step(modeAutoState) }

    @Test fun rappel() = paparazzi.snapshot { step(base.copy(step = OnboardingStep.RAPPEL)) }

    @Test fun pretDefault() = paparazzi.snapshot { pret() }

    @Test fun pretLarge() {
        large()
        paparazzi.snapshot { pret() }
    }
}
