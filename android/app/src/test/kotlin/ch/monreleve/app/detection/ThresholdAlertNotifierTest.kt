package ch.monreleve.app.detection

import ch.monreleve.app.fences.subjectFile
import ch.monreleve.app.fr.NotificationCopy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-ALERT (section 2 / R323): the threshold alert shows NOTHING PRIVATE on the lock screen. A notification
// builder needs a Context, so this reads the notifier's SOURCE the way EveningNotifierLockScreenTest does (the
// `adb shell dumpsys notification` half is the device check), and asserts the public-version COPY directly.
//   - the private (unlocked) alert names the seuil; the PUBLIC (lock-screen) version names no threshold and no
//     figure - only that there is information about the year;
//   - the alert carries NO record buttons and opens the FORECAST;
//   - it posts on the SAME id as the evening reminder, so the two never coexist (never two a day).

// AN-FENCE-ROOTS (R461): :app only, and correct - the same NotificationCompat builder as
// EveningNotifierLockScreenTest reads, which commonMain may not import. R460: subjectFile() fails
// naming the file if it moves.
private const val NOTIFIER_PATH = "src/main/kotlin/ch/monreleve/app/detection/EveningNotifier.kt"

class ThresholdAlertNotifierTest {
    private val source: String = subjectFile("threshold-alert notifier fence", NOTIFIER_PATH).readText()

    @Test
    fun theSourceIsReadSoTheScanIsNotVacuous() {
        assertTrue("EveningNotifier.kt was not read (renamed/moved?)", source.length > 500)
    }

    @Test
    fun theLockScreenAlertNamesNoThresholdAndNoFigure() {
        val text = NotificationCopy.alertPublicLines().text
        assertFalse("the lock-screen alert must not name a seuil", text.contains("seuil"))
        assertFalse("the lock-screen alert must carry no figure", text.any { it.isDigit() })
        assertFalse("the lock-screen alert must carry no percentage", text.contains("%"))
    }

    @Test
    fun theUnlockedAlertNamesTheThresholdSoTheRedactionIsReal() {
        // The PRIVATE sentence DOES name the seuil, so the lock-screen test above proves a real redaction
        // rather than passing because the copy says nothing anywhere.
        assertTrue(NotificationCopy.alertTitle("FISCAL").contains("seuil"))
        assertTrue(NotificationCopy.alertTitle("SOCIAL").contains("seuil"))
    }

    @Test
    fun thePublicAlertVersionCarriesNoButtonsAndNoThresholdCopy() {
        val body = functionBody("alertPublicVersion")
        assertFalse("the public alert version must carry no actions", body.contains("addAction"))
        assertTrue("the public alert version must be VISIBILITY_PUBLIC", body.contains("VISIBILITY_PUBLIC"))
        assertTrue("the public alert version must use alertPublicLines", body.contains("alertPublicLines"))
        assertFalse("the public alert version must not use the threshold title", body.contains("alertTitle"))
    }

    @Test
    fun theAlertOpensTheForecastAndPostsOnTheSharedId() {
        val body = functionBody("postAlert")
        assertTrue("the alert tap opens the forecast", body.contains("openForecast"))
        assertFalse("the alert carries no record buttons", body.contains("addAction"))
        assertTrue("the alert posts on the shared id (never two a day)", body.contains("EVENING_NOTIFICATION_ID"))
    }

    // Extract a function's `{ ... }` body by brace depth (the EveningNotifierLockScreenTest technique).
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
