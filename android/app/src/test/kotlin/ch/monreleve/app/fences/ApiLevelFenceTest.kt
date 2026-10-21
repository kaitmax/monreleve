package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * DEVICE-LOOP CRASH 1 (R269 - a scan ported to guard the code that comes next).
 *
 * The app crashed at launch of the signed-in shell on a physical API-29 phone
 * with java.lang.NoSuchMethodError on LocalDate.ofInstant(Instant, ZoneId):
 *   at ch.monreleve.app.data.local.CalendarDayKt.todayInParis(CalendarDay.kt:31)
 *   at ch.monreleve.app.aujourdhui.AujourdhuiController.<init>(AujourdhuiController.kt:178)
 * That overload was ADDED IN API 34 (Android 14). minSdk is 26 and
 * coreLibraryDesugaring is NOT enabled, so the method does not exist on this
 * device and the call throws the first time todayInParis runs. A JVM unit test
 * cannot reproduce it - the desktop JDK HAS ofInstant - so the device steps are
 * its runtime test (recorded in REPORT-DEVICE-LOOP.txt); THIS is the durable
 * static guard, in this project's established fence idiom (FencesTest.kt).
 *
 * WHY A RECEIVER-ANCHORED LIST, not a bare ".ofInstant(" ban: the ofInstant
 * factory exists on several java.time types at DIFFERENT API levels.
 * OffsetDateTime.ofInstant and ZonedDateTime.ofInstant are part of the original
 * java.time and are available since API 26 - a bare ".ofInstant(" ban would
 * false-positive on those. Only the date/time-WITHOUT-offset receivers got the
 * overload late (API 34), because only they need a zone to resolve an instant.
 *
 * KNOWN LIMIT (stated, per the fences idiom): this is a CURATED list, not a
 * derivation of the whole API database. A text scan cannot know every java.time
 * (or platform) member added after API 26; the comprehensive sweep is Android
 * Lint's NewApi check, which R308 (AN-STATE) wired into :app:gate PERMANENTLY -
 * scoped to NewApi only (lint{} in build.gradle.kts). DEVICE-LOOP ran it once as
 * a diagnostic; it is now a forever gate step beside this fence (two layers, not
 * duplication: this is the JVM-fast regression guard for the member that bit us,
 * lintDebug is the exhaustive partner). This fence is the cheap, forever guard for the class
 * that actually bit us; extend BANNED below when lint or the docs name another
 * member added after minSdk and not desugared - each verified, never recalled.
 *
 * Scans src/main AND src/debug: the debug and audit variants both run on this
 * phone, so a late-API call in either is a device crash just the same.
 *
 * ---------------------------------------------------------------------------
 * AN-FENCE-ROOTS (R461). IT READS :app ONLY, AND THAT IS CORRECT - the reason
 * written here so the next KMP task does not have to re-derive it.
 *
 * Every banned member is a java.time receiver, and java.time CANNOT appear in
 * :shared commonMain. Two independent mechanisms say so, neither of them this
 * one: CommonMainFenceTest rejects every `import java.` with an exemption list
 * of exactly two androidx packages (asserted, R206), and
 * compileCommonMainKotlinMetadata - a :app:gate step - resolves commonMain
 * against the COMMON stdlib, where java.time does not exist at all, so even a
 * fully-qualified java.time.LocalDate.ofInstant(...) with no import fails to
 * compile there. commonMain dates are kotlinx.datetime (R384's inventory),
 * whose LocalDate carries no ofInstant. A scan of commonMain for these members
 * could never fire, and a scan that can never fire reads as coverage.
 *
 * R460's assertion below is what makes leaving it alone safe: if src/main or
 * src/debug ever moves, this fence FAILS naming the root it could not find.
 */
private val scanRoots =
    listOf(
        FenceRoot(File("src/main/kotlin/ch/monreleve/app"), pin = "MainActivity.kt"),
        FenceRoot(File("src/debug/kotlin/ch/monreleve/app"), pin = "SessionInjection.kt"),
    )

/** receiver -> the java.time member banned on it, with the API level it arrived at and why it is unsafe. */
private val bannedMembers =
    listOf(
        Banned("LocalDate", "ofInstant", 34),
        Banned("LocalDateTime", "ofInstant", 34),
        Banned("LocalTime", "ofInstant", 34),
        Banned("OffsetTime", "ofInstant", 34),
    )

private data class Banned(val receiver: String, val method: String, val sinceApi: Int) {
    // \b before the receiver matches both `LocalDate.ofInstant(` and `java.time.LocalDate.ofInstant(`.
    val pattern: Regex = Regex("""\b$receiver\.$method\s*\(""")

    override fun toString(): String = "$receiver.$method() (added API $sinceApi; minSdk 26, no desugaring)"
}

private fun stripComments(text: String): String =
    text
        .replace(Regex("""/\*[\s\S]*?\*/"""), "")
        .replace(Regex("""//.*"""), "")

private fun scannedKtFiles(): List<File> {
    scanRoots.assertFound("API-level fence")
    return scanRoots.ktFiles()
}

class ApiLevelFenceTest {
    @Test
    fun noJavaTimeMemberAddedAfterMinSdkIsCalled() {
        val files = scannedKtFiles()
        // Vacuity guard (F7): an absence assertion over zero files passes silently - a renamed src tree
        // would go green on nothing. Assert the scan found files before asserting it found no offenders.
        assertTrue(
            "API-level fence scanned no files - src/main or src/debug renamed? (F7 vacuity guard)",
            files.isNotEmpty(),
        )

        val offenders = mutableListOf<String>()
        for (file in files) {
            val text = stripComments(file.readText())
            for (banned in bannedMembers) {
                if (banned.pattern.containsMatchIn(text)) {
                    offenders += "${file.path}: calls $banned"
                }
            }
        }
        assertTrue(
            "API-level fence violated - a java.time member unavailable on minSdk 26 is called, which " +
                "throws NoSuchMethodError on a device below the member's API level (DEVICE-LOOP CRASH 1):\n" +
                offenders.joinToString("\n") { "  - $it" },
            offenders.isEmpty(),
        )
    }
}
