package ch.monreleve.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen

/**
 * The single activity (SPEC 11). This is the COMPOSITION ROOT - it may wire
 * data/remote (fence 5 governs ui/, not this file), so it builds the AuthApi on
 * the platform transport and the per-build-type base URL here and hands the
 * screens a controller.
 *
 * AN4 launches to the sign-in request screen. The session check that routes a
 * signed-in user to Aujourd'hui instead is increment 5's (SessionManager); until
 * then the app always opens at sign-in, which is the honest state - no session
 * exists yet.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
        val pending = SharedPrefsPendingSignInStore(applicationContext)
        setContent {
            FrontierTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    val controller = remember { SignInController(api, pending, lifecycleScope) }
                    val state by controller.state.collectAsState()
                    RequestLinkScreen(
                        state = state,
                        onEmailChange = controller::onEmailChange,
                        onSubmit = controller::submit,
                        onRetry = controller::retry,
                    )
                }
            }
        }
    }
}
