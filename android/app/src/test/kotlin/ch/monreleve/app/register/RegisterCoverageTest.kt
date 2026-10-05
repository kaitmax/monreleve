package ch.monreleve.app.register

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

// AN10b increment 1 (R294), REWIRED by R327. The reports and the register (parking.md) describe the
// same decisions from two sides, and until this check nothing asserted the space between them (R175):
// a report could cite a PARK-<n> / PARKAN-<n> the register never contained, so a reader following the
// citation up hit nothing. That is precisely what happened - REPORT-AN5b/AN5c cited PARKAN-16/17/18
// that were never written (the 4 -> 19 gap), and AN-NEXT-2 cited PARKAN-37/38 with no headings and
// RED main between tasks.
//
// R327: THE LOGIC NOW LIVES IN ONE PLACE, web/scripts/register-coverage.mjs, and this test INVOKES it
// rather than re-implementing it. This check is a REPOSITORY-WIDE DOCUMENT check (parking.md and the
// repo-root reports), so it must run in BOTH :app:gate (here) AND gate:clone, the PUSH gate - a report
// commit used to red :app:gate invisibly because gate:clone did not run the Android suite. A second
// implementation in Node beside a Kotlin one would drift (R206), so there is exactly one definition and
// both gates shell out to it. node is on PATH in every environment that runs :app:gate (this machine and
// the ubuntu-latest Android CI job, where it is preinstalled); a missing node fails LOUDLY here (R133),
// never a silent pass.
//
// R283: parking.md, the repo-root reports AND the script are declared task inputs (app/build.gradle.kts),
// so an edit to any of them re-runs this rather than leaving it UP-TO-DATE. A report enters the scan the
// moment it is written, so this test is re-run after the report and before the final commit (R182: a
// check runs after the thing it checks for can exist). The derivation of the scan scope from the reports
// on disk, and the PARK4-<n> / published-P<n> exclusions, live in the script's own header.
class RegisterCoverageTest {
    private val root: File = repoRoot()

    @Test
    fun everyCitedRegisterEntryHasARealEntry() {
        val script = File(root, "web/scripts/register-coverage.mjs")
        check(script.exists()) {
            "register-coverage.mjs not found at ${script.absolutePath} - the one definition this test " +
                "and gate:clone share (R327) is missing"
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
                "R294/R327: register-coverage.mjs reported a problem (exit $exit).\n" +
                    "The single definition is web/scripts/register-coverage.mjs; gate:clone runs the same " +
                    "script.\n$output",
            )
        }
    }
}
