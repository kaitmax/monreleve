package ch.monreleve.app.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.account.accountTagOf
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.settings.SharedPrefsSettingsStore

// DEBUG-ONLY (R284). The walkthrough instrument that stands in for typing an email at sign-in.
// Reached by naming the component - never a launcher entry, never an intent-filter, and declared
// ONLY in src/debug/AndroidManifest.xml so it is absent from every release build:
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.debug.SessionInjectionActivity \
//     --es accessToken <jwt> --es refreshToken <opaque> \
//     --es accessExpiresAt <iso> --es refreshExpiresAt <iso> \
//     [--es canton GE --es employmentRate 100 --es denominatorKind SIMPLIFIED240 --es granularity DAY]
//
// The session is a REAL pair the host obtained from /api/v1/auth/callback the way AN5b's AC2 run did,
// so every screen downstream talks to the real server. Storage is synchronous (KeystoreTokenStore and
// SharedPrefsSettingsStore both commit()), so the walkthrough may force-stop immediately after this
// activity finishes and MainActivity re-reads a durable session on its next launch.
//
// The status line reports SUCCESS or the REFUSED FIELD - never a token value (R198). Compose/token
// discipline is not fenced in src/debug, but the outcome text stays a bare status so a screenshot of
// this screen can never leak a credential.
class SessionInjectionActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val outcome =
            when (val result = SessionInjection.parse { key -> intent?.getStringExtra(key) }) {
                is InjectionResult.Valid -> {
                    KeystoreTokenStore(applicationContext).save(result.session)
                    result.settings?.let { SharedPrefsSettingsStore(applicationContext).save(it) }
                    // AN-FIX F4 / R303: the real callback sets the account from the link's address; this
                    // instrument stands in for that, taking an `email` extra and setting the same opaque tag,
                    // so an injected session is scoped the way a real sign-in is (the cross-account repro).
                    val tag = intent?.getStringExtra("email")?.let { accountTagOf(it) }
                    tag?.let { SharedPrefsAccountStore(applicationContext).setCurrent(it) }
                    val base = if (result.settings != null) "SESSION INJECTED + SETTINGS" else "SESSION INJECTED"
                    if (tag != null) "$base + ACCOUNT" else base
                }
                is InjectionResult.Refused -> "INJECTION REFUSED: ${result.field}"
            }
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Text(text = outcome, modifier = Modifier.padding(Spacing.space20))
                }
            }
        }
    }
}
