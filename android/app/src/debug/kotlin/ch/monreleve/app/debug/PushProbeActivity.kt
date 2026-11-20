package ch.monreleve.app.debug

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.push.PushAvailability
import ch.monreleve.app.push.PushConditions
import ch.monreleve.app.push.PushSync
import ch.monreleve.app.push.PushTokens
import ch.monreleve.app.push.SessionPushServer
import ch.monreleve.app.push.SharedPrefsPushRecordStore
import ch.monreleve.app.push.notificationsPermitted
import ch.monreleve.app.push.playServicesPresent
import ch.monreleve.app.push.pushConfigOf
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// DEBUG-ONLY (AN-FCM-CLIENT R1154). ONE REGISTRATION PASS WITH A FAKE TOKEN, AGAINST WHATEVER SERVER THIS BUILD
// NAMES - the emulator proof that the app's real pass (PushSync, over the process's real session and the real
// SharedPreferences record) reaches POST /api/v1/devices and PATCH /api/v1/me on a local server, when no Firebase
// project exists to hand out a real token. Declared ONLY in src/debug/AndroidManifest.xml, so no release build has it.
//
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.debug.PushProbeActivity
//
// WHAT IS FAKE, AND ONLY THAT: the token source (a fixed string, visibly not a registration) and the configuration
// (four values that say "probe", so the pass runs; Firebase is never built from them - the fake token source never
// touches Firebase). Play services, the notification permission, the opt-in, the account and the session are the
// phone's own. The screen and the log show the pass's PushStatus and the "push available" state - never a token.
class PushProbeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = mutableStateOf("PUSH PROBE...")
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Text(text = status.value, modifier = Modifier.padding(Spacing.space20))
                }
            }
        }
        lifecycleScope.launch {
            val app = applicationContext
            val session = processSession(app)
            val result =
                withContext(Dispatchers.IO) {
                    val pass =
                        PushSync(
                            PushConditions(
                                config = pushConfigOf("probe", "probe", "probe", "probe"),
                                signedIn = { session.isSignedIn() },
                                account = { SharedPrefsAccountStore(app).current() },
                                playServices = { playServicesPresent(app) },
                                permission = { notificationsPermitted(app) },
                                optedIn = { SharedPrefsEveningNotificationStore(app).isEnabled() },
                            ),
                            ProbeTokens,
                            SessionPushServer(session),
                            SharedPrefsPushRecordStore(app),
                            BuildConfig.VERSION_NAME,
                        ).sync()
                    // The real named state reads the real build config, which is unconfigured here - so it is
                    // reported beside the pass, to show the two answers side by side.
                    "PUSH PROBE pass=${pass.name} pushAvailable=${PushAvailability.isPushAvailable(app)}"
                }
            Log.i("MonRelevePush", result)
            status.value = result
        }
    }

    private object ProbeTokens : PushTokens {
        override suspend fun current(): String? = "fake-fcm-token-emulator-probe-not-a-registration"

        override fun discard() = Unit
    }
}
