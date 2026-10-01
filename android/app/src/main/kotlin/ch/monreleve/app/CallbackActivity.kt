package ch.monreleve.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.CallbackController
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.ui.screens.signin.CallbackScreen

/**
 * The App Link callback target (SPEC 10, R195). This is the ONE activity the OS
 * opens from the sign-in link, so it is necessarily exported; every other
 * component stays unexported except the LAUNCHER (MainActivity) and the dev-only
 * GalleryActivity.
 *
 * android-intent-security (AN0): the incoming intent's data is UNTRUSTED.
 * CallbackController.handle validates the URI (host, scheme, path) before anything
 * acts on it, binds it to the pending sign-in address (login-CSRF), and never
 * forwards the intent to another component (no intent redirection). onNewIntent
 * applies the SAME validation as onCreate and setIntent()s before processing - a
 * singleTop warm delivery must not be trusted more than a cold one.
 */
class CallbackActivity : ComponentActivity() {
    private lateinit var controller: CallbackController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        controller =
            CallbackController(
                api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL),
                tokenStore = KeystoreTokenStore(context),
                pending = SharedPrefsPendingSignInStore(context),
                scope = lifecycleScope,
                accountStore = SharedPrefsAccountStore(context),
            )
        controller.handle(intent?.data?.toString())
        setContent {
            FrontierTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    val state by controller.state.collectAsState()
                    CallbackScreen(state = state, onBackToSignIn = ::goToSignIn)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        controller.handle(intent.data?.toString())
    }

    private fun goToSignIn() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        finish()
    }
}
