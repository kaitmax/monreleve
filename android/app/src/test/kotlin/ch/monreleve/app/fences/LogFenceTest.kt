package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN4 increment 2. The log fence (AC3): no token, refresh token or email address
 * reaches a log line. The project's source-scanning idiom (FencesTest.kt), not a
 * new detekt module - same reasoning (no new dependency, runs under `test`).
 *
 * Proven adversarially (R7/R178): the app logs NOTHING today, so this passes on
 * real code without a live instance - a planted `Log.d(TAG, "access=$accessToken")`
 * is what shows it CAN fire, verified before the increment closed and recorded in
 * REPORT-AN4.txt.
 *
 * KNOWN LIMIT: line-based. A log call split so the sink is on one line and the
 * credential three lines down evades this - but TokenPair.toString()'s redaction
 * (TokenPairTest) is the second defence for exactly the case a generic serialiser
 * would produce, and a hand-written multi-line log of a raw token is not the
 * realistic leak.
 *
 * ----------------------------------------------------------------------------
 * AN-FENCE-ROOTS (R459). TWO TREES, BECAUSE THE CREDENTIALS MOVED.
 *
 * This fence was written when every file that touches a token was in :app. KMP-1
 * and KMP-3 moved the credential-bearing code into :shared commonMain -
 * auth/TokenPair.kt, auth/TokenStore.kt, auth/SessionManager.kt,
 * data/remote/AuthApi.kt and data/sync/SyncEngine.kt - and a fence still walking
 * one tree would have gone on passing over a shrinking fraction of exactly the
 * code it exists to guard, with nothing saying so (R452).
 *
 * IT IS NOT AN ANDROID-ONLY RULE, which is what makes the widening necessary
 * rather than tidy. `Log.d` cannot appear in commonMain (no android.*), but
 * `println` is in the COMMON stdlib: `println("refresh=$refreshToken")` inside
 * SessionManager.kt compiles for every target, ships in the release APK, and is
 * exactly the leak LOG_SINK's `println` alternative was written for.
 *
 * The second root is relative to :app's project directory, the way the first is.
 * noRawTokenReachesTheUiLayer stays :app-only: ui/ is Compose, and there is no
 * ui/ in commonMain for it to miss.
 */
private val logFenceSrcRoot = File("src/main/kotlin/ch/monreleve/app")

private val logFenceRoots =
    listOf(
        FenceRoot(logFenceSrcRoot, pin = "MainActivity.kt"),
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app"), pin = "SessionManager.kt"),
    )

private fun logFenceStripComments(text: String): String =
    text
        .replace(Regex("""/\*[\s\S]*?\*/"""), "")
        .replace(Regex("""//.*"""), "")

private val LOG_SINK = Regex("""\b(Log\.[dewiv]|println|print|System\.(out|err)|Timber\.\w+)\b""")
private val CREDENTIAL = Regex("""(?i)(token|refresh|email|password|secret|bearer)""")

class LogFenceTest {
    @Test
    fun theWalkReachesBothTreesEachNamedByAFileOnlyItCanHold() {
        // R460. Each root on its own, pinned by a file only it holds. A COMBINED count stays
        // comfortably over any threshold with one root missing entirely, which is how a fence
        // quietly stops covering half of what it claims (R452).
        logFenceRoots.assertFound("log fence")
    }

    @Test
    fun noCredentialShareALineWithALogSink() {
        logFenceRoots.assertFound("log fence")
        val scanned = logFenceRoots.ktFiles()
        // R133: the scan is not vacuous - it has real files to read.
        assertTrue("log fence found no source files to scan", scanned.isNotEmpty())

        val offenders = mutableListOf<String>()
        for (file in scanned) {
            logFenceStripComments(file.readText()).lineSequence().forEachIndexed { index, line ->
                if (LOG_SINK.containsMatchIn(line) && CREDENTIAL.containsMatchIn(line)) {
                    offenders += "${file.path}:${index + 1}: a log/print sink on the same line as a credential word"
                }
            }
        }
        assertTrue(
            "log fence violated - a credential must never reach a log line:\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }

    @Test
    fun noRawTokenReachesTheUiLayer() {
        // The FLAG_SECURE rationale, made testable. No screen renders a token or
        // the sign-in link, so there is nothing on screen to hide from the recents
        // thumbnail - which is why FLAG_SECURE is recorded-not-sprinkled (a black
        // recents on the callback screen would also defeat AC2's own screenshots).
        // This asserts the premise so it stays true as screens are added: ui/ never
        // holds a raw token value.
        // F7 (AN-FIX, R267 - the second site named by the audit): this absence assertion over an EMPTY ui/
        // would pass vacuously if ui/ were renamed. AN-FENCE-ROOTS (R460) replaces the
        // `if (uiDir.exists()) ... else emptyList()` that produced that empty set with an assertion that
        // names what it could not find and where it looked - ui/ is :app-only and is NOT optional.
        val uiRoot =
            listOf(
                // IOS-MOVE-CORE R1303: AppBottomBar moved to :shared commonMain's ui/ (read by the shared root
                // here); :app's ui/ keeps the two start-date pickers, so the root stays, pinned by one of them (R460).
                FenceRoot(File(logFenceSrcRoot, "ui"), pin = "OnboardingStartDatePicker.kt"),
                // IOS-1b-A R604: Aujourd'hui's screen moved to :shared commonMain.
                FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/ui"), pin = "AujourdhuiScreen.kt"),
            )
        uiRoot.assertFound("noRawToken fence")
        val scanned = uiRoot.ktFiles()
        assertTrue("noRawToken fence scanned no ui/ files - ui/ renamed? (F7 vacuity guard)", scanned.isNotEmpty())

        val offenders = mutableListOf<String>()
        for (file in scanned) {
            if (Regex("""\b(accessToken|refreshToken)\b""").containsMatchIn(logFenceStripComments(file.readText()))) {
                offenders += "${file.path}: references a raw token value in the ui/ layer"
            }
        }
        assertTrue(
            "a raw token reached the ui/ layer - a screen would render or leak it:\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }
}
