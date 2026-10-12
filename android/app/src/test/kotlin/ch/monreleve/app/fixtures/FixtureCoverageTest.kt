package ch.monreleve.app.fixtures

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

// ENGINE-PARITY (R348). Every top-level section (a case array) of every shared fixture under fixtures/
// must be consumed by every engine whose test suite reads that fixture file. REG-APPLY corrected the
// mission cap and updated fixtures/denominator-cases.json's missionCapCases, and :app:gate went red ONLY
// because the Kotlin suite happened to read that section; had it read the file but not that section, the
// web fixture and the Kotlin engine would have diverged with BOTH builds green. This census makes that
// impossible to repeat.
//
// R327's shape: the LOGIC lives in ONE place, web/scripts/fixture-coverage.mjs, which gate:clone (the
// PUSH gate) runs too; this test INVOKES it rather than re-implementing it, so :app:gate enforces the
// same check. A second implementation in Kotlin beside the Node one would drift (R206). node is on PATH
// in every environment that runs :app:gate (this machine and the Android CI job, where it is
// preinstalled); a missing node fails LOUDLY here (R133), never a silent pass.
//
// R283/R246: fixtures/, web/tests, the Android test tree AND this script are declared task inputs
// (app/build.gradle.kts), so adding a fixture section, or changing which test reads one, re-runs this
// test rather than leaving it UP-TO-DATE. The file set, the sections and the consumers are all derived
// from what is on disk - never a hand-kept list.
class FixtureCoverageTest {
    private val root: File = repoRoot()

    @Test
    fun everyFixtureSectionIsConsumedByEveryEngineThatReadsItsFile() {
        val script = File(root, "web/scripts/fixture-coverage.mjs")
        check(script.exists()) {
            "fixture-coverage.mjs not found at ${script.absolutePath} - the one definition this test " +
                "and gate:clone share (R348/R327) is missing"
        }

        val process =
            ProcessBuilder("node", script.absolutePath, root.absolutePath)
                .directory(root)
                .redirectErrorStream(true)
                .start()

        val output = process.inputStream.bufferedReader().use { it.readText() }
        val exit = process.waitFor()

        if (exit != 0) {
            fail(
                "R348: fixture-coverage.mjs reported a problem (exit $exit).\n" +
                    "The single definition is web/scripts/fixture-coverage.mjs; gate:clone runs the same " +
                    "script.\n$output",
            )
        }
    }
}
