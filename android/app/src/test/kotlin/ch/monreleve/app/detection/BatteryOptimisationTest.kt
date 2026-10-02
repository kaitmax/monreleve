package ch.monreleve.app.detection

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN-AUTO increment 6 (R317). DO NOT ASK FOR A BATTERY-OPTIMISATION EXEMPTION. The permission that requests it
// (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) is itself restricted on Play, and SPEC does not let the app change a
// system setting on the person's behalf. This asserts the merged source manifests declare no battery permission;
// the honest alternative - a help-text note that Samsung's battery management may stop sampling - lives in
// ParametresCopy.AUTO_BATTERY_NOTE and is rendered on Parametres.

private val MANIFESTS =
    listOf(
        File("src/main/AndroidManifest.xml"),
        File("src/debug/AndroidManifest.xml"),
    )

class BatteryOptimisationTest {
    @Test
    fun noManifestAsksForABatteryOptimisationExemption() {
        val present = MANIFESTS.filter { it.exists() }
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
