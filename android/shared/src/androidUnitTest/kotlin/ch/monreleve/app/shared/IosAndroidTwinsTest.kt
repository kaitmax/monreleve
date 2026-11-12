package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-2f R889/R892. AN iOS COPY OF AN ANDROID FILE IS BYTE-IDENTICAL TO IT, OR THE BUILD IS RED.
 *
 * iOS needs three pure :app files that cannot move to commonMain while 0 files under android/app may change:
 * account/DeviceLocalStore.kt (the three erasure scopes), detection/EveningNotificationDecision.kt and
 * detection/ThresholdAlertDecision.kt (what the evening reminder and the threshold alert say). Each is copied into
 * :shared's iosMain at the SAME package and file name, so iOS calls exactly the declarations Android calls. A copy is a
 * second home (R206), so this test is the mechanism that keeps the two one text:
 *
 *   1. THE TWINS ARE DERIVED, not listed: every iosMain file whose path relative to its kotlin root also exists under
 *      :app's src/main/kotlin is a twin. A copy cannot hide from the check by not being registered.
 *   2. EACH TWIN IS BYTE-IDENTICAL to its :app file - comments, blank lines and the final newline included (line
 *      endings are pinned LF by .gitattributes, so a byte comparison is exact on every checkout). The failure names the
 *      first line that differs.
 *   3. THE SET IS ASSERTED EXACTLY. A fourth copy fails here until it is argued for and added; removing one (the move
 *      to commonMain, PARKED) fails here until its line goes. A copy is a debt, so the list only changes on purpose
 *      (R206's corollary: asserted exactly beats merely listed).
 *
 * Both roots are asserted found and pinned (R460): a check pointed at a missing directory finds no twin and would pass
 * over nothing. The end of the copies is the move: once :app's files live in commonMain, iOS compilation fails with a
 * redeclaration until the iosMain copy is deleted - and then this test's set must lose that line.
 */
class IosAndroidTwinsTest {
    private val iosMain = File("src/iosMain/kotlin")
    private val appMain = File("../app/src/main/kotlin")

    private val expectedTwins =
        setOf(
            "ch/monreleve/app/account/DeviceLocalStore.kt",
            "ch/monreleve/app/detection/EveningNotificationDecision.kt",
            "ch/monreleve/app/detection/ThresholdAlertDecision.kt",
        )

    private fun twins(): Map<String, Pair<File, File>> =
        iosMain
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .mapNotNull { ios ->
                val relative = ios.relativeTo(iosMain).invariantSeparatorsPath
                val app = File(appMain, relative)
                if (app.isFile) relative to (ios to app) else null
            }.toMap()

    @Test
    fun bothRootsAreTheRealSourceRoots() {
        assertTrue("iosMain root not found at ${iosMain.absolutePath}", File(iosMain, PIN_IOS).isFile)
        assertTrue(":app main root not found at ${appMain.absolutePath}", File(appMain, PIN_APP).isFile)
    }

    @Test
    fun theTwinsAreExactlyTheThreeArguedFor() = assertEquals(expectedTwins, twins().keys)

    @Test
    fun everyTwinIsByteIdenticalToItsAndroidFile() {
        val found = twins()
        assertTrue("no twin found: the check would pass over nothing", found.isNotEmpty())
        found.forEach { (relative, files) ->
            val (ios, app) = files
            val iosBytes = ios.readBytes()
            val appBytes = app.readBytes()
            if (!iosBytes.contentEquals(appBytes)) {
                val iosLines = iosBytes.decodeToString().lines()
                val appLines = appBytes.decodeToString().lines()
                val first = iosLines.indices.firstOrNull { it >= appLines.size || iosLines[it] != appLines[it] }
                throw AssertionError(
                    "$relative: the iosMain copy differs from :app's file at line ${(first ?: appLines.size) + 1}. " +
                        "Copy :app's file over it byte for byte; the copy is never edited on its own.",
                )
            }
        }
    }

    private companion object {
        const val PIN_IOS = "ch/monreleve/app/ios/IosSyncTrigger.kt"
        const val PIN_APP = "ch/monreleve/app/MainActivity.kt"
    }
}
