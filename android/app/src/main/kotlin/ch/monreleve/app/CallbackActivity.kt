package ch.monreleve.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.CallbackController
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.handle
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.data.sync.buildSyncEngine
import ch.monreleve.app.ui.screens.signin.CallbackScreen
import ch.monreleve.app.ui.screens.update.UpdateRequiredScreen
import ch.monreleve.app.ui.shell.AppRoot
import ch.monreleve.app.update.openPlayListingFrom
import ch.monreleve.app.update.processUpdateGate
import kotlinx.coroutines.launch

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
                // AN-TOKEN-RACE (R509): the link's sign-in sends the account's held days, through the worker's drain.
                syncNow = { buildSyncEngine(context).sync() },
            )
        controller.handle(intent?.data?.toString())
        // AN-FORCE-UPDATE (R1111, R267): the second shipped window gets the same gate as MainActivity - asked on every
        // start, starting open. The link's exchange above still runs (the API never breaks an old client), but what
        // this window shows is the update screen when the process's gate says so, and nothing else.
        lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_START) lifecycleScope.launch { processUpdateGate.check() }
            },
        )
        setContent {
            // AN-EDGE-INSETS (R1170): the same root as MainActivity's - this is a second window, so it needs its own.
            AppRoot {
                val updateRequired by processUpdateGate.required.collectAsState()
                if (updateRequired) {
                    val activity = LocalContext.current
                    UpdateRequiredScreen(onUpdate = { openPlayListingFrom(activity) })
                } else {
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
