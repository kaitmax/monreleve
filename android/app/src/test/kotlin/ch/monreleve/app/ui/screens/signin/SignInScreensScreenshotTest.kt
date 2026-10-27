package ch.monreleve.app.ui.screens.signin

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.auth.CodePhase
import ch.monreleve.app.auth.CodeState
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.SignInState
import ch.monreleve.app.design.FrontierTheme
import org.junit.Rule
import org.junit.Test

/**
 * AN-ONBOARD: baselines for the three sign-in screens (design/onboarding/Main, Connexion, Code), at the
 * default text size and at 200 percent (fontScale 2f) - the accessibility requirement as a cheap JVM
 * snapshot (R176's emulator drive is the parent's walkthrough). Device PIXEL_5 light, as the other baselines.
 */
class SignInScreensScreenshotTest {
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

    private fun large() = paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))

    @Composable
    private fun welcome() = WelcomeScreen(onStart = {})

    @Composable
    private fun connexion(
        state: SignInState,
        sessionClosedHeldDays: Int? = null,
    ) {
        RequestLinkScreen(
            state = state,
            sessionClosedHeldDays = sessionClosedHeldDays,
            actions =
                SignInActions(
                    onEmailChange = {},
                    onSubmit = {},
                    onRetry = {},
                    onBack = {},
                    onOpenCgu = {},
                    onOpenPrivacy = {},
                ),
        )
    }

    @Composable
    private fun code(state: CodeState) =
        CodeScreen(
            email = "camille.martin@exemple.ch",
            state = state,
            actions =
                CodeActions(
                    onCodeChange = {},
                    onSubmit = {},
                    onModify = {},
                    onResend = {},
                    onOpenMail = {},
                ),
        )

    @Test fun welcomeDefault() = paparazzi.snapshot { frame { welcome() } }

    @Test fun welcomeLarge() {
        large()
        paparazzi.snapshot { frame { welcome() } }
    }

    @Test fun connexionDefault() = paparazzi.snapshot { frame { connexion(SignInState()) } }

    @Test fun connexionLarge() {
        large()
        paparazzi.snapshot { frame { connexion(SignInState(email = "camille.martin@exemple.ch")) } }
    }

    // AN-FORCED-SIGNOUT (R520): the sign-in screen a sign-out nobody asked for lands on - the notice and its N, at
    // two days, at none (the sentence still says what happened), and at 200 percent. NEW baselines, no existing one
    // regenerated: a null N renders nothing, so connexionDefault/connexionLarge/connexionRateLimited are unchanged.
    @Test fun connexionSessionClosedTwoDays() =
        paparazzi.snapshot { frame { connexion(SignInState(), sessionClosedHeldDays = 2) } }

    // R528: the singular the operator accepted, photographed - one day, and the sentence's own agreement.
    @Test fun connexionSessionClosedOneDay() =
        paparazzi.snapshot { frame { connexion(SignInState(), sessionClosedHeldDays = 1) } }

    @Test fun connexionSessionClosedNoDays() =
        paparazzi.snapshot { frame { connexion(SignInState(), sessionClosedHeldDays = 0) } }

    @Test fun connexionSessionClosedLarge() {
        large()
        paparazzi.snapshot { frame { connexion(SignInState(), sessionClosedHeldDays = 2) } }
    }

    @Test fun connexionRateLimited() =
        paparazzi.snapshot {
            frame { connexion(SignInState(email = "x@y.ch", phase = SignInPhase.RATE_LIMITED)) }
        }

    @Test fun codeDefault() = paparazzi.snapshot { frame { code(CodeState(code = "481", resendSeconds = 42)) } }

    @Test fun codeLarge() {
        large()
        paparazzi.snapshot { frame { code(CodeState(code = "481", resendSeconds = 42)) } }
    }

    @Test fun codeFilled() = paparazzi.snapshot { frame { code(CodeState(code = "481234", resendSeconds = 0)) } }

    @Test fun codeWrong() =
        paparazzi.snapshot {
            frame {
                code(
                    CodeState(code = "481234", phase = CodePhase.WRONG_CODE, resendSeconds = 0),
                )
            }
        }
}
