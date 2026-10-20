package ch.monreleve.app.detection

import ch.monreleve.app.fences.subjectFile
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-AUTO increment 6 (R317). DO NOT ASK FOR A BATTERY-OPTIMISATION EXEMPTION. The permission that requests it
// (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) is itself restricted on Play, and SPEC does not let the app change a
// system setting on the person's behalf. This asserts the merged source manifests declare no battery permission;
// the honest alternative - a help-text note that Samsung's battery management may stop sampling - lives in
// ParametresCopy.AUTO_BATTERY_NOTE and is rendered on Parametres.

// AN-FENCE-ROOTS (R461). THIS FENCE READS :app ONLY, AND THAT IS CORRECT: a manifest is an Android
// artefact and :shared commonMain has none. R460: the two manifests are named individually rather
// than filtered for existence, so a renamed one FAILS here instead of shrinking the scan in silence -
// `MANIFESTS.filter { it.exists() }` plus a combined isNotEmpty() would have passed on the debug
// manifest alone, with the one that ships unread.
private val MANIFEST_PATHS =
    listOf(
        "src/main/AndroidManifest.xml",
        "src/debug/AndroidManifest.xml",
    )

class BatteryOptimisationTest {
    @Test
    fun noManifestAsksForABatteryOptimisationExemption() {
        val present = MANIFEST_PATHS.map { subjectFile("battery-exemption fence", it) }
        assertTrue("expected the main manifest to scan, found none", present.isNotEmpty())
        for (manifest in present) {
            val text = manifest.readText()
            assertFalse(
                "R317: ${manifest.path} must not request a battery-optimisation exemption",
                text.contains("BATTERY_OPTIMIZATION", ignoreCase = true) ||
                    text.contains("REQUEST_IGNORE_BATTERY", ignoreCase = true),
            )
        }
    }
}
