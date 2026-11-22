package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-2c-FIX R808. NO RAW WAIT IN iosTest BUT THE ONE THAT ENDS.
 *
 * In CMP 1.7.3 the iOS test harness's waitUntil builds its timeout message and never throws it (IOS-2c-PROBE R800,
 * read in ui-test-uikitsimarm64-1.7.3-sources.jar: ComposeUiTest.skikoMain.kt 289-304), so a condition that stays
 * false is polled until the CI job's own timeout and reads as a hang - which is how run 42142576248's "hang" was
 * finally explained. The one wait in iosTest that ENDS is waitBounded in pilot/BoundedWait.kt (R807), with its
 * positive control on the simulator (BoundedWaitIosTest). This keeps every other raw call out of
 * android/shared/src/iosTest, in ExperimentalTimeOptInAllowlistTest's shape:
 *
 *   1. THE EXACT FILES, AT THEIR EXACT COUNTS. A new file fails; a higher count fails; a LOWER count fails too, so the
 *      allowlist only ever shrinks by being EDITED - converting a file means deleting its line here, on purpose.
 *   2. THE HELPER'S ONE CALL IS IN THE HELPER'S OWN BODY, so its file's count of one cannot be spent elsewhere.
 *
 * THE PATTERN COUNTS THE FAMILY, not only the bare name: the library's waitUntilNodeCount, waitUntilAtLeastOneExists,
 * waitUntilExactlyOneExists and waitUntilDoesNotExist go through the same never-throwing loop (commonMain
 * ComposeUiTest.kt 205-290), so allowing them would let an unbounded wait back in under another name. None is used in
 * iosTest today, so the counts below are exactly what R808 measured.
 *
 * Comment lines are not code (ExperimentalTimeOptInAllowlistTest's rule), so a comment may name the call it forbids.
 * The root is asserted found and pinned on the helper's own file (R460): a fence pointed at nothing passes over it.
 */
class IosTestRawWaitUntilFenceTest {
    private val root = FenceRoot(File("../shared/src/iosTest/kotlin"), pin = "BoundedWait.kt")

    private val helper = "shared/src/iosTest/kotlin/ch/monreleve/app/pilot/BoundedWait.kt"

    /** File (relative to android/) -> how many raw waits it may carry. Asserted EXACTLY. */
    private val allowlist =
        mapOf(
            // R807: the helper's own body - the one wait in iosTest that ends.
            helper to 1,
            // R808, measured on 7b0df23 and unchanged by IOS-2c-FIX: their conversion is a later task's (PARKED), so
            // the sign-in and onboarding pilots' timing is not coupled to this change with no second run to see it.
            "shared/src/iosTest/kotlin/ch/monreleve/app/pilot/OnboardingScreensIosTest.kt" to 16,
            // IOS-SHELL-1 R1328: SignInScreensIosTest's six raw waits went with its hand-written route reduction; the
            // file now drives the real extracted routes through waitBounded, so its line is deleted (R808's shrink).
        )

    private val rawWait = Regex("""\bwaitUntil\w*\s*\(""")

    /** A source line with its comment removed, or null when the whole line is comment. */
    private fun code(line: String): String? {
        val t = line.trim()
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return null
        return line.substringBefore(" //").substringBefore("\t//")
    }

    private fun relative(file: File): String =
        file.canonicalFile
            .relativeTo(File("..").canonicalFile)
            .invariantSeparatorsPath

    private fun rawWaits(file: File): Int = file.readLines().mapNotNull(::code).sumOf { rawWait.findAll(it).count() }

    @Test
    fun aRawWaitAppearsOnlyInTheHelperAndTheAllowlistedFilesAtTheirExactCounts() {
        val roots = listOf(root)
        roots.assertFound("IosTestRawWaitUntilFenceTest")
        val found =
            roots
                .ktFiles()
                .associate { relative(it) to rawWaits(it) }
                .filterValues { it > 0 }
        // Positive control: the scan reaches the waits it expects, so it is not passing over nothing.
        assertTrue("the scan found no raw wait in iosTest at all - it is not looking", found.isNotEmpty())
        assertEquals(
            "a raw waitUntil-family call in android/shared/src/iosTest outside its allowlist, or a count that moved " +
                "(IOS-2c-FIX R808). In CMP 1.7.3 it never times out: use waitBounded (pilot/BoundedWait.kt). A " +
                "LOWER count is an edit to this map, not a pass.",
            allowlist.toSortedMap(),
            found.toSortedMap(),
        )
    }

    @Test
    fun theHelpersOneRawWaitIsInsideTheHelpersOwnBody() {
        val lines = subjectFile("IosTestRawWaitUntilFenceTest", "../$helper").readLines()
        val start = lines.indexOfFirst { code(it)?.contains("fun ComposeUiTest.waitBounded(") == true }
        assertTrue("the helper's declaration, fun ComposeUiTest.waitBounded(, is not in $helper", start >= 0)
        // A top-level function ends at the first line after it that is a lone closing brace in column 0.
        val end = (start + 1 until lines.size).firstOrNull { lines[it] == "}" } ?: -1
        assertTrue("the helper's body has no closing brace in column 0 in $helper", end > start)
        val hits = lines.indices.filter { i -> code(lines[i])?.let { rawWait.containsMatchIn(it) } == true }
        assertEquals("the helper's file holds exactly one raw wait (lines ${hits.map { it + 1 }})", 1, hits.size)
        assertTrue(
            "the helper's file's raw wait, line ${hits.single() + 1}, is outside waitBounded's body " +
                "(lines ${start + 1}..${end + 1})",
            hits.single() in start..end,
        )
    }
}
