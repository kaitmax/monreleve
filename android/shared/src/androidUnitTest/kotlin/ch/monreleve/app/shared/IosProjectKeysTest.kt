package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-AUDIT R1354 / R1350. THE iOS APP DECLARES NO KEY IT DOES NOT USE, AND NONE THAT IS THE OPERATOR'S TO SET.
 *
 * ios/project.yml is the one home of every Info.plist key and entitlement (R206 - the plist is generated from it),
 * so the key set is read HERE, on every :app:gate, rather than only on a macOS run:
 *   - NO LOCATION KEY. iOS v1 is manual-only (iOS Ruling 2): an NSLocation*UsageDescription would be a permission the
 *     app never asks for, and App Review reads it as one it might.
 *   - NO ATS EXCEPTION and NO LOCAL-NETWORKING key: the Release build talks to https://monreleve.ch only (R1353
 *     inspects the built Release Info.plist for the same keys).
 *   - NO BACKGROUND KEY: BGTaskSchedulerPermittedIdentifiers and UIBackgroundModes were the host probe's (R1350);
 *     the real background sync is PARK-IF1's and declares its own.
 *   - NO ITSAppUsesNonExemptEncryption: the export-compliance answer is the OPERATOR's (docs/ios-release.md 5).
 * PRESENCE FIRST (R169): the keys the app DOES declare are asserted found, so a reader that matched nothing - a moved
 * file, a renamed key - fails rather than reporting every absence as compliance. Comment lines are not read: the file
 * names several of these keys in its own prose.
 */
class IosProjectKeysTest {
    private val project = File("../../ios/project.yml")

    private fun keyLines(): List<String> {
        assertTrue("$TEST: ios/project.yml not found at ${project.absolutePath}", project.isFile)
        return project.readLines().map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("#") }
    }

    private fun declared(key: String): Boolean = keyLines().any { it.startsWith("$key:") }

    @Test
    fun theKeysTheAppDeclaresAreFound() {
        for (key in PRESENT) {
            assertTrue("$TEST: the presence control - $key not found in ios/project.yml", declared(key))
        }
    }

    @Test
    fun noLocationAtsBackgroundOrExportComplianceKeyIsDeclared() {
        val found = keyLines().filter { line -> FORBIDDEN.any { line.startsWith(it) } }
        assertEquals("$TEST: keys iOS v1 must not declare (R1354): $found", emptyList<String>(), found)
    }

    @Test
    fun theReleaseBaseUrlIsTheSiteOverHttps() {
        val release = keyLines().dropWhile { it != "Release:" }.drop(1).firstOrNull { it.startsWith(BASE_URL_SETTING) }
        assertEquals("$TEST: R1353's Release base URL", "$BASE_URL_SETTING: \"https://monreleve.ch\"", release)
    }

    @Test
    fun theReaderSeesAPlantedKey() {
        val planted = listOf("NSLocationWhenInUseUsageDescription: \"x\"", "UIBackgroundModes:")
        assertEquals(planted, planted.filter { line -> FORBIDDEN.any { line.startsWith(it) } })
    }

    private companion object {
        const val TEST = "IosProjectKeysTest (R1354)"
        const val BASE_URL_SETTING = "MONRELEVE_API_BASE_URL"
        val PRESENT =
            listOf(
                "MonReleveApiBaseUrl",
                "CFBundleShortVersionString",
                "CFBundleVersion",
                "LSApplicationQueriesSchemes",
            )
        val FORBIDDEN =
            listOf(
                "NSLocation",
                "NSAppTransportSecurity",
                "NSAllowsArbitraryLoads",
                "NSAllowsLocalNetworking",
                "NSLocalNetworkUsageDescription",
                "NSBonjourServices",
                "BGTaskSchedulerPermittedIdentifiers",
                "UIBackgroundModes",
                "ITSAppUsesNonExemptEncryption",
            )
    }
}
