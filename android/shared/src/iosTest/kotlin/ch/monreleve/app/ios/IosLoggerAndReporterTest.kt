package ch.monreleve.app.ios

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// IOS-1a R571 / R568. THE LOGGER LOGS NO PERSON, and the canary asserts in debug and logs in release.
// The sink is captured, so what a line would have contained is read, not assumed.

class IosLoggerAndReporterTest {
    private val email = "zoe.muller@example.ch"
    private val token = "eyJhbGciOiJIUzI1NiJ9.dG9rZW4tYm9keQ.c2lnbmF0dXJl"
    private val day = "2026-10-12"
    private val code = "481234"

    @Test
    fun anEmailATokenADayAndACodeNeverReachALogLine() {
        val lines = ArrayList<String>()
        val logger = IosLogger { lines.add(it) }
        logger.error("Sync", "user $email token $token recorded $day code $code failed")
        logger.info("Sync", "user $email and again $email")
        // R133 positive control: the line WAS logged, with its tag and its fixed words.
        assertEquals(2, lines.size)
        assertTrue(lines[0].startsWith("E/Sync: "), lines[0])
        assertTrue(lines[0].contains("failed"), lines[0])
        assertTrue(lines[1].startsWith("I/Sync: "), lines[1])
        for (line in lines) {
            assertFalse(line.contains("zoe"), line)
            assertFalse(line.contains("example.ch"), line)
            assertFalse(line.contains(token.substring(0, 12)), line)
            assertFalse(line.contains(day), line)
            assertFalse(line.contains(code), line)
        }
    }

    @Test
    fun scrubLeavesOrdinarySentencesAlone() {
        val sentence = "account tag unresolved while a session exists (R423/R425)"
        assertEquals(sentence, scrub(sentence))
    }

    @Test
    fun theCanaryCrashesADebugBuildByTypeAndLogsInRelease() {
        val lines = ArrayList<String>()
        val logger = IosLogger { lines.add(it) }
        val complaint = "account tag unresolved while a session exists"
        val thrown =
            assertFailsWith<IllegalStateException> { IosUnownedReporter(logger, isDebug = true).report(complaint) }
        assertEquals(complaint, thrown.message)
        assertTrue(lines.isEmpty(), "debug crashes INSTEAD of logging, as Android does")
        IosUnownedReporter(logger, isDebug = false).report(complaint)
        assertEquals(1, lines.size)
        assertTrue(lines[0].contains(complaint), lines[0])
        assertTrue(lines[0].startsWith("E/EntryRepository: "), lines[0])
    }
}
