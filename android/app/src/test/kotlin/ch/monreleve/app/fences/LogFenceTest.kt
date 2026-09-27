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
 */
private val logFenceSrcRoot = File("src/main/kotlin/ch/monreleve/app")

private fun logFenceStripComments(text: String): String =
    text
        .replace(Regex("""/\*[\s\S]*?\*/"""), "")
        .replace(Regex("""//.*"""), "")

private fun logFenceMainKt(): List<File> {
    return logFenceSrcRoot.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
}

private val LOG_SINK = Regex("""\b(Log\.[dewiv]|println|print|System\.(out|err)|Timber\.\w+)\b""")
private val CREDENTIAL = Regex("""(?i)(token|refresh|email|password|secret|bearer)""")

class LogFenceTest {
    @Test
    fun noCredentialShareALineWithALogSink() {
        val scanned = logFenceMainKt()
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
        val uiDir = File(logFenceSrcRoot, "ui")
        val scanned =
            if (uiDir.exists()) {
                uiDir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
            } else {
                emptyList()
            }

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
