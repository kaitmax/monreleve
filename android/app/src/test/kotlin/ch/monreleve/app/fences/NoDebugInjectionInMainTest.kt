package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * GUARD (a) of R284. The session-injection code exists ONLY in the debug source set. This scans the
 * main and release Kotlin trees for the injection marker and fails if it is found there - the source
 * companion to checkReleaseNoDebugInjection (guard b), which scans the merged release MANIFEST. The
 * two are distinct subjects: this catches the CODE leaking into a shipped source set; the Gradle task
 * catches a DECLARATION reaching the release manifest (from a stray main-manifest entry or a library).
 *
 * Proven with a plant (REPORT-AN5c.txt): a copy of SessionInjection.kt placed in src/main turns this
 * red, while the merged-manifest guard stays green (no manifest names it) - so each guard has its own
 * distinct failure.
 *
 * The marker is the type name, which is unique to the injection and appears in no legitimate main or
 * release file. This test lives in src/test, which is scanned by neither tree, so it does not
 * self-trigger on its own mention of the marker.
 */
class NoDebugInjectionInMainTest {
    private val marker = "SessionInjection"

    private val scannedRoots =
        listOf(
            File("src/main/kotlin"),
            File("src/release/kotlin"),
        )

    @Test
    fun theInjectionExistsOnlyInTheDebugSourceSet() {
        val offenders =
            scannedRoots
                .filter { it.exists() }
                .flatMap { root -> root.walkTopDown().filter { it.isFile && it.extension == "kt" } }
                .filter { it.readText().contains(marker) }
                .map { it.path }

        assertTrue(
            "R284 guard (a): the debug session injection ('$marker') must live only in src/debug, " +
                "but it was found in a shipped source set:\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }
}
