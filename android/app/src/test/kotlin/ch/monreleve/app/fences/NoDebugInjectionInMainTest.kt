package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * GUARD (a) of R284. The debug-only tooling exists ONLY in the debug source set. This scans the main and
 * release Kotlin trees for each tooling marker and fails if any is found there - the source companion to
 * checkReleaseNoDebugInjection (guard b), which scans the merged release MANIFEST. The two are distinct
 * subjects: this catches the CODE leaking into a shipped source set; the Gradle task catches a DECLARATION
 * reaching the release manifest (from a stray main-manifest entry or a library).
 *
 * TWO MARKERS (AN-AUDIT increment 1). "SessionInjection" is the session-injection family; "DebugSeeder" is
 * the measurement dataset generator, which joined the family on the same terms - debug-only, guarded here
 * and in the merged-manifest task. A third debug tool adds its type name to this list.
 *
 * Proven with a plant per marker (REPORT-AN5c.txt for SessionInjection; REPORT-AN-AUDIT.txt for DebugSeeder):
 * a copy of the class placed in src/main turns this red, while the merged-manifest guard stays green (no
 * manifest names it) - so each guard has its own distinct failure.
 *
 * Each marker is a type name, unique to its tool and appearing in no legitimate main or release file. This
 * test lives in src/test, scanned by neither tree, so it does not self-trigger on its own mention of them.
 */
class NoDebugInjectionInMainTest {
    private val markers = listOf("SessionInjection", "DebugSeeder")

    private val scannedRoots =
        listOf(
            File("src/main/kotlin"),
            File("src/release/kotlin"),
        )

    @Test
    fun theDebugToolingExistsOnlyInTheDebugSourceSet() {
        val offenders =
            scannedRoots
                .filter { it.exists() }
                .flatMap { root -> root.walkTopDown().filter { it.isFile && it.extension == "kt" } }
                .flatMap { file -> markers.filter { file.readText().contains(it) }.map { "$it in ${file.path}" } }

        assertTrue(
            "R284 guard (a): debug-only tooling ($markers) must live only in src/debug, " +
                "but it was found in a shipped source set:\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }
}
