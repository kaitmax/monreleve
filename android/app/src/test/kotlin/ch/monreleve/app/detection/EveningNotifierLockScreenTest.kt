package ch.monreleve.app.detection

import ch.monreleve.app.fences.subjectFile
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-NOTIF (R339), section 3/5 "asserted from the code". The lock-screen protections, verified against the
// notifier's SOURCE (the `adb shell dumpsys notification` half is the device check, parked for the phone-work
// pass - PARKAN). A notification builder needs a Context, so a plain JVM test cannot build and inspect the real
// Notification; this reads the source the same way FencesTest reads src/main/kotlin as text (R283 declares that
// tree a test input). The three facts the prompt names:
//   - every recording action requires the device UNLOCKED (setAuthenticationRequired, Android 12+/API 31+);
//   - the PUBLIC (lock-screen) version carries NO buttons, so someone picking up a locked phone cannot write to
//     the owner's tax record;
//   - recording buttons fire IMMUTABLE BROADCAST PendingIntents (a receiver, not an activity - Android 12+ forbids
//     a receiver that a notification launched from starting one; immutable so nothing outside the app can alter it).

// AN-FENCE-ROOTS (R461). THIS FENCE READS :app ONLY, AND THAT IS CORRECT: its subject is a
// NotificationCompat builder with PendingIntents and setAuthenticationRequired - android.app and
// androidx.core, which commonMain may not import (CommonMainFenceTest). R460: subjectFile() fails
// NAMING the file and where it looked if EveningNotifier.kt ever moves.
private const val NOTIFIER_PATH = "src/main/kotlin/ch/monreleve/app/detection/EveningNotifier.kt"

class EveningNotifierLockScreenTest {
    private val source: String = subjectFile("evening-notifier lock-screen fence", NOTIFIER_PATH).readText()

    @Test
    fun theSourceIsReadSoTheScanIsNotVacuous() {
        assertTrue("EveningNotifier.kt was not read (renamed/moved?)", source.length > 500)
    }

    @Test
    fun everyRecordingActionRequiresTheDeviceUnlocked() {
        assertTrue(
            "recording actions must setAuthenticationRequired(true) (the API 31+ unlock gate, section 3)",
            source.contains("setAuthenticationRequired(true)"),
        )
    }

    @Test
    fun thePublicLockScreenVersionCarriesNoButtons() {
        val body = functionBody("publicVersion")
        assertFalse(
            "the public (lock-screen) version must carry no actions - it must not addAction",
            body.contains("addAction"),
        )
        assertTrue("the public version must be VISIBILITY_PUBLIC", body.contains("VISIBILITY_PUBLIC"))
    }

    @Test
    fun recordingButtonsAreImmutableBroadcasts() {
        assertTrue(
            "recording buttons must use broadcast PendingIntents (a receiver, not an activity)",
            source.contains("PendingIntent.getBroadcast"),
        )
        assertTrue("recording PendingIntents must be immutable", source.contains("FLAG_IMMUTABLE"))
    }

    // Extract a function's `{ ... }` body by brace depth (the CopyReachabilityTest.objectBodySpan technique), so
    // the "no buttons" assertion is scoped to the public version and not fooled by addAction elsewhere in the file.
    private fun functionBody(name: String): String {
        val start = source.indexOf("fun $name")
        require(start != -1) { "function $name not found in EveningNotifier.kt" }
        val open = source.indexOf('{', start)
        require(open != -1) { "no body brace for $name" }
        var depth = 1
        var index = open + 1
        while (index < source.length && depth > 0) {
            when (source[index]) {
                '{' -> depth++
                '}' -> depth--
            }
            index++
        }
        return source.substring(open, index)
    }
}
