package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-PLAY-PACK (R1124). THE MANUAL-ONLY OVERLAY REMOVES EXACTLY THE LOCATION PERMISSIONS THE MAIN MANIFEST DECLARES.
 *
 * The fallback if Play refuses background location is one build property away: -PmanualOnly=true adds
 * src/manualOnly/AndroidManifest.xml to every variant, and that overlay only REMOVES permissions. The BUILT APK and
 * .aab are checked for each variant's exact set (checkReleaseLocationPermissions / checkReleaseBundle, both
 * directions), but only when that build is made - which the gate does not do. This keeps the overlay in step with
 * src/main on every gate: a location permission added to src/main tomorrow (COARSE, say) with no matching removal
 * would ship in the "manual-only" release, and this fails the day it is written instead (R246's discovery shape:
 * the set is READ from src/main, never typed here).
 *
 * Both directions (R196): every ACCESS_*LOCATION src/main declares is removed, and the overlay removes nothing
 * else and adds nothing - an overlay that also removed INTERNET would be a broken build, not a fallback.
 */
class ManualOnlyOverlayTest {
    private val appDir = File(".").canonicalFile
    private val mainManifest = File(appDir, "src/main/AndroidManifest.xml")
    private val overlay = File(appDir, "src/manualOnly/AndroidManifest.xml")

    private fun withoutComments(text: String) = text.replace(Regex("""(?s)<!--.*?-->"""), "")

    private val usesPermission = Regex("""<uses-permission\b[^>]*>""")
    private val permissionName = Regex("""android:name="([^"]+)"""")

    private fun names(elements: List<String>) =
        elements.mapNotNull { permissionName.find(it)?.groupValues?.get(1) }.toSortedSet()

    @Test
    fun theOverlayRemovesExactlyTheLocationPermissionsSrcMainDeclares() {
        assertTrue("src/main manifest not found at $mainManifest", mainManifest.isFile)
        assertTrue("the manual-only overlay is missing at $overlay (R1124)", overlay.isFile)

        val declared =
            names(usesPermission.findAll(withoutComments(mainManifest.readText())).map { it.value }.toList())
                .filter { it.matches(Regex("""android\.permission\.ACCESS_[A-Z_]*LOCATION""")) }
                .toSortedSet()
        // R133: the scan must find the two it exists to find, or it proves nothing about an empty match.
        assertTrue(
            "no location permission found in src/main - the scan is pointed at nothing: $declared",
            declared.size >= 2,
        )

        val overlayText = withoutComments(overlay.readText())
        val overlayElements = usesPermission.findAll(overlayText).map { it.value }.toList()
        val removed = names(overlayElements.filter { it.contains("""tools:node="remove"""") })
        assertEquals("the overlay must remove exactly src/main's location permissions", declared, removed)
        assertEquals(
            "every <uses-permission> in the overlay must be a removal (it may add nothing)",
            overlayElements.size,
            removed.size,
        )

        val otherElements =
            Regex("""<([a-zA-Z][\w-]*)\b""").findAll(overlayText).map { it.groupValues[1] }
                .filter { it != "manifest" && it != "uses-permission" && it != "?xml" }
                .toList()
        assertEquals("the overlay declares nothing but removals: $otherElements", emptyList<String>(), otherElements)
    }
}
