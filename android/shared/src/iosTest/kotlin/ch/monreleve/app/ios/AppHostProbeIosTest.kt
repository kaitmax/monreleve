package ch.monreleve.app.ios

import platform.Foundation.NSBundle
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-2f R888. THE ONE PROBE: WHAT KIND OF PROCESS THE SIMULATOR TESTS RUN IN.
//
// R888's map labels a missing part "needs an app host" either MEASURED or ARGUED. This measures the premise the
// ARGUED rows rest on - that the test binary has no app bundle: no bundle identifier (UNUserNotificationCenter's
// authorization is per bundle identifier) and no BGTaskSchedulerPermittedIdentifiers (BGTaskScheduler refuses an
// identifier the app's Info.plist does not list). It reads NSBundle only and calls NO host API: a host API raising an
// Objective-C exception in a bundle-less process would end the whole paid run. The line is printed for the report
// (R895 quotes it from the run's results); the one assertion is the positive control that the probe read something.

class AppHostProbeIosTest {
    @Test
    fun theTestProcessIsReadAndItsBundleRecorded() {
        val bundle = NSBundle.mainBundle
        val identifier = bundle.bundleIdentifier
        val permitted = bundle.objectForInfoDictionaryKey("BGTaskSchedulerPermittedIdentifiers")
        println(
            "APP HOST PROBE: bundleIdentifier=$identifier bundlePath=${bundle.bundlePath} " +
                "BGTaskSchedulerPermittedIdentifiers=$permitted",
        )
        assertTrue(bundle.bundlePath.isNotEmpty(), "positive control: the probe read the main bundle's path")
    }
}
