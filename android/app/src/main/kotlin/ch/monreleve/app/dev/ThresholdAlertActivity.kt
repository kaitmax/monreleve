package ch.monreleve.app.dev

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.detection.maybeAlertThreshold
import kotlinx.coroutines.launch
import java.time.Clock

// DEBUG/AUDIT ONLY (declared in src/debug/AndroidManifest.xml; R8 strips it from release - no manifest root
// there - and checkReleaseNoDevComponent fails on any ch.monreleve.app.dev.* in the release APK). AN-ALERT
// device test: runs the REAL threshold-alert path (maybeAlertThreshold - the engine crossing, the decision, the
// same-day merge and the notifier) on demand against the seeded rhythm/record/settings and the system clock, so
// each WHEN case can be produced on the physical phone without waiting for a background wake. The WorkManager
// schedule that calls maybeAlertThreshold is the SamplingWorker's and already proven by the sampler; this
// exercises the new code. It records NOTHING (D16/R340) and reads no coordinate (D18) - it only posts (or not).
// Reached by: adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.ThresholdAlertActivity
// No string literal lands here (the dev/ fence).
class ThresholdAlertActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            maybeAlertThreshold(applicationContext, Clock.systemUTC())
            finish()
        }
    }
}
