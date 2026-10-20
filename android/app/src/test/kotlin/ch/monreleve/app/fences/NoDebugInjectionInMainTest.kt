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
 *
 * --------------------------------------------------------------------------------------------------------
 * AN-FENCE-ROOTS (R459). :shared commonMain IS A SHIPPED SOURCE SET, AND IT WAS NOT ONE WHEN THIS WAS WRITTEN.
 *
 * This fence's subject is not a file; it is a TERRITORY - "every source set that reaches a shipped build".
 * When R284 wrote it, that territory was src/main and src/release. :app now depends on :shared, so
 * shared/src/commonMain/kotlin is compiled into the debug AND release APKs: a SessionInjectionActivity
 * copied there would ship to the Play Store with every guard green, because the one guard that reads source
 * was reading a territory that had shrunk underneath it (R452).
 *
 * GUARD (b) WOULD NOT HAVE CAUGHT IT EITHER, which is why this matters rather than being belt-and-braces:
 * checkReleaseNoDebugInjection reads the merged release MANIFEST, and a class with no <activity> entry
 * appears in no manifest. The two guards have distinct subjects, exactly as the header says.
 *
 * src/release/kotlin HAS NEVER EXISTED (:app has no release-only Kotlin; src/release holds res/ only). It
 * stays declared, as an OPTIONAL root with its reason stated and asserted, rather than being dropped by a
 * silent `.filter { it.exists() }` - which is the pattern that made the old version scan ONE root while
 * declaring two, and would have dropped src/main on exactly the same terms.
 */
class NoDebugInjectionInMainTest {
    private val markers = listOf("SessionInjection", "DebugSeeder")

    private val scannedRoots =
        listOf(
            FenceRoot(File("src/main/kotlin"), pin = "MainActivity.kt"),
            FenceRoot(
                File("../shared/src/commonMain/kotlin"),
                pin = "SharedModule.kt",
            ),
            FenceRoot(
                File("src/release/kotlin"),
                pin = "nothing - this root has never held Kotlin",
                optionalBecause =
                    ":app has no release-only Kotlin; src/release holds res/ only. The root stays " +
                        "declared so that release-only code, the day somebody writes it, is scanned on " +
                        "the day it lands rather than on the day somebody remembers.",
            ),
        )

    @Test
    fun theScannedTerritoryIsTheOneTheMarkersCouldShipIn() {
        // R460. Each SHIPPED root on its own, pinned by a file only it holds - so this fence fails loudly
        // the next time its territory moves instead of reporting perfect compliance over what is left.
        scannedRoots.assertFound("R284 guard (a)")
    }

    @Test
    fun theDebugToolingExistsOnlyInTheDebugSourceSet() {
        scannedRoots.assertFound("R284 guard (a)")
        val offenders =
            scannedRoots
                .ktFiles()
                .flatMap { file -> markers.filter { file.readText().contains(it) }.map { "$it in ${file.path}" } }

        assertTrue(
            "R284 guard (a): debug-only tooling ($markers) must live only in src/debug, " +
                "but it was found in a shipped source set:\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }
}
