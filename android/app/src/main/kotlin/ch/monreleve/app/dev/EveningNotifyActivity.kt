package ch.monreleve.app.dev

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.detection.maybeNotifyEvening
import kotlinx.coroutines.launch
import java.time.Clock

// DEBUG/AUDIT ONLY (declared in src/debug/AndroidManifest.xml; R8 strips it from release - no manifest root
// there - and checkReleaseNoDevComponent fails on any ch.monreleve.app.dev.* in the release APK). AN-NEXT incr 3
// device test: runs the REAL evening-notification path (maybeNotifyEvening - the decision, the state-gathering
// and the notifier) on demand against the seeded state and the system clock, so the notification can be seen on
// the physical phone without the WorkManager periodic wake and a real weekday evening. The WorkManager schedule
// that would call maybeNotifyEvening is standard and already proven by the sampler; this exercises the new code.
// Reached by: adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.EveningNotifyActivity
// It records nothing (D18/D16) - it only posts the notification. No string literal lands here (the dev/ fence).
class EveningNotifyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            maybeNotifyEvening(applicationContext, Clock.systemUTC())
            finish()
        }
    }
}
