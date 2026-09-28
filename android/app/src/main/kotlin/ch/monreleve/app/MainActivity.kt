package ch.monreleve.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen
import kotlinx.coroutines.CoroutineScope
import java.time.Year
import java.time.ZoneId

/**
 * The single activity and composition root (SPEC 11). It may wire data/remote (fence 5 governs ui/,
 * not this file): it builds the AuthApi, the session, and the settings store, and routes to the one
 * screen the person needs.
 *
 * AN5b increment 1 adds the manual-onboarding step between sign-in and Aujourd'hui. The start
 * destination is decided once at launch from two facts - is there a session, and has onboarding been
 * completed on this device - and onboarding flips to Aujourd'hui when the settings save. The
 * four-destination bottom nav is a later task; this routes the linear first-run path (R282: no mode
 * chooser anywhere on it).
 */
private enum class Destination { SIGN_IN, ONBOARDING, AUJOURDHUI }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
        val tokenStore = KeystoreTokenStore(context)
        val session = SessionManager(api, tokenStore)
        val settingsStore: SettingsStore = SharedPrefsSettingsStore(context)
        val pending = SharedPrefsPendingSignInStore(context)
        // R28: the tax year is the Paris calendar year, not the device's. The composition root is
        // the one place a clock is allowed; the engine and the aggregation stay clock-free.
        val taxYear = Year.now(ZoneId.of("Europe/Paris")).value

        val start =
            when {
                !session.isSignedIn() -> Destination.SIGN_IN
                !settingsStore.isOnboarded() -> Destination.ONBOARDING
                else -> Destination.AUJOURDHUI
            }

        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    var destination by remember { mutableStateOf(start) }
                    when (destination) {
                        Destination.SIGN_IN -> SignInRoute(api, pending, lifecycleScope)
                        Destination.ONBOARDING ->
                            OnboardingRoute(session, settingsStore, taxYear, lifecycleScope) {
                                destination = Destination.AUJOURDHUI
                            }
                        Destination.AUJOURDHUI -> AujourdhuiScreen()
                    }
                }
            }
        }
    }
}

@Composable
private fun SignInRoute(
    api: AuthApi,
    pending: SharedPrefsPendingSignInStore,
    scope: CoroutineScope,
) {
    val controller = remember { SignInController(api, pending, scope) }
    val state by controller.state.collectAsState()
    RequestLinkScreen(
        state = state,
        onEmailChange = controller::onEmailChange,
        onSubmit = controller::submit,
        onRetry = controller::retry,
    )
}

@Composable
private fun OnboardingRoute(
    session: SessionManager,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    onDone: () -> Unit,
) {
    val controller = remember { OnboardingController(SessionSettingsSaver(session), store, taxYear, scope) }
    val state by controller.state.collectAsState()
    LaunchedEffect(state.phase) {
        if (state.phase == OnboardingPhase.SAVED) onDone()
    }
    OnboardingScreen(
        state = state,
        actions =
            OnboardingActions(
                onCantonChange = controller::onCantonChange,
                onEmploymentRateChange = controller::onEmploymentRateChange,
                onDenominatorChange = controller::onDenominatorChange,
                onExactTotalChange = controller::onExactTotalChange,
                onGranularityChange = controller::onGranularityChange,
                onActivityStartDateChange = controller::onActivityStartDateChange,
                onSubmit = controller::submit,
            ),
    )
}
