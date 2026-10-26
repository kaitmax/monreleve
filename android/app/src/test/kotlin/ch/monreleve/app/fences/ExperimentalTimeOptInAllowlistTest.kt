package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * KMP-DT R590. THE EXPERIMENTAL-TIME OPT-IN IS AN EXCEPTION, AND THIS IS WHAT KEEPS IT ONE.
 *
 * kotlinx-datetime 0.7 replaced its own Instant and Clock with kotlin.time.Instant and kotlin.time.Clock, which
 * Kotlin 2.2.21 marks @ExperimentalTime (RequiresOptIn level ERROR). They are stable, unchanged, from Kotlin 2.3.0
 * (@WasExperimental). The operator ruled the opt-in allowed for THESE sites only, on three conditions; this test
 * enforces the first two, and PARK-Z3 holds the third (delete every opt-in below, and this test, at Kotlin 2.3):
 *
 *   1. THE EXACT FILES - and, stricter than the ruling asks, the exact NUMBER per file, so a second opt-in cannot
 *      slip into a file already on the list. A new one anywhere fails here until somebody argues for it.
 *   2. THE NARROWEST SCOPE - a function, a property, a parameter or an expression. Never @file:OptIn, never a
 *      class (which would cover every member written into it later), never a propagated @ExperimentalTime, and
 *      never module-wide: no Gradle file may name ExperimentalTime outside a comment (languageSettings optIn,
 *      -opt-in, freeCompilerArgs), because a module-wide opt-in would silently cover every future use.
 *
 * Every root it walks is asserted found and pinned (R460), and it asserts the scan saw the opt-ins it expects, so
 * it cannot pass over nothing.
 */
class ExperimentalTimeOptInAllowlistTest {
    // IOS-1a R592: THE ALLOWLIST SEES EVERY SOURCE SET. The pinned roots below are the ones known to exist; on top
    // of them, every other src/<set>/kotlin directory of :app and :shared is DISCOVERED (androidMain, iosMain,
    // iosTest, a future set), so a new source set cannot hide an opt-in the way iosMain did before this ruling.
    private val pinnedRoots =
        listOf(
            FenceRoot(File("src/main/kotlin"), pin = "MainActivity.kt"),
            FenceRoot(File("src/debug/kotlin"), pin = "SessionInjection.kt"),
            FenceRoot(File("src/test/kotlin"), pin = "ExperimentalTimeOptInAllowlistTest.kt"),
            FenceRoot(File("src/testDebug/kotlin"), pin = "SessionInjectionTest.kt"),
            FenceRoot(File("src/androidTest/kotlin"), pin = "MonReleveMigrationTest.kt"),
            FenceRoot(File("../shared/src/commonMain/kotlin"), pin = "ParisDay.kt"),
            FenceRoot(File("../shared/src/commonTest/kotlin"), pin = "CalendarDayGoldenTest.kt"),
            FenceRoot(File("../shared/src/androidUnitTest/kotlin"), pin = "CommonMainFenceTest.kt"),
            FenceRoot(File("../shared/src/iosMain/kotlin"), pin = "IosInstantFormat.kt"),
            FenceRoot(File("../shared/src/iosTest/kotlin"), pin = "IosDatabaseTest.kt"),
            FenceRoot(File("../probe/src/main/kotlin"), pin = "ProbeActivity.kt"),
        )

    private val roots: List<FenceRoot> by lazy {
        val pinnedPaths = pinnedRoots.map { it.dir.canonicalFile }.toSet()
        val discovered =
            listOf(File("src"), File("../shared/src"))
                .flatMap { it.listFiles { f -> f.isDirectory }?.toList().orEmpty() }
                .map { File(it, "kotlin") }
                .filter { it.isDirectory && it.canonicalFile !in pinnedPaths }
                .map { dir ->
                    val pin = dir.walkTopDown().first { f -> f.isFile && f.extension == "kt" }.name
                    FenceRoot(dir, pin = pin)
                }
        pinnedRoots + discovered
    }

    /** Every Gradle file that could opt a whole module in. */
    private val buildFiles =
        listOf(
            File("../build.gradle.kts"),
            File("../settings.gradle.kts"),
            File("../gradle.properties"),
            File("../gradle/libs.versions.toml"),
            File("build.gradle.kts"),
            File("../shared/build.gradle.kts"),
            File("../probe/build.gradle.kts"),
        )

    /** File (relative to android/) -> how many @OptIn(ExperimentalTime::class) it may carry. Asserted EXACTLY. */
    private val allowlist =
        mapOf(
            "app/src/main/kotlin/ch/monreleve/app/aujourdhui/AujourdhuiController.kt" to 1,
            "app/src/main/kotlin/ch/monreleve/app/calendar/BulkConfirmation.kt" to 1,
            "app/src/main/kotlin/ch/monreleve/app/calendar/CalendarController.kt" to 1,
            "app/src/main/kotlin/ch/monreleve/app/calendar/CalendarModel.kt" to 1,
            "app/src/main/kotlin/ch/monreleve/app/data/local/JavaTimeCalendarDay.kt" to 3,
            "app/src/main/kotlin/ch/monreleve/app/data/repo/AndroidRecordSeams.kt" to 1,
            "app/src/test/kotlin/ch/monreleve/app/dossier/LatenessConformanceTest.kt" to 1,
            "shared/src/iosMain/kotlin/ch/monreleve/app/ios/IosInstantFormat.kt" to 3,
            "shared/src/commonMain/kotlin/ch/monreleve/app/data/local/CalendarDay.kt" to 2,
            "shared/src/commonMain/kotlin/ch/monreleve/app/data/repo/EntryRepository.kt" to 2,
            "shared/src/commonMain/kotlin/ch/monreleve/app/dossier/LatenessForecast.kt" to 1,
            "shared/src/commonMain/kotlin/ch/monreleve/app/dossier/ParisDay.kt" to 2,
            "shared/src/commonTest/kotlin/ch/monreleve/app/data/local/CalendarDayProbe.kt" to 3,
            "shared/src/commonTest/kotlin/ch/monreleve/app/data/repo/GranularityRuleTest.kt" to 2,
            "shared/src/commonTest/kotlin/ch/monreleve/app/data/sync/ServerInstantParseGoldenTest.kt" to 2,
            "shared/src/commonTest/kotlin/ch/monreleve/app/dossier/ParisDayDstTest.kt" to 1,
        )

    private val optIn = Regex("""OptIn\(\s*(kotlin\.time\.)?ExperimentalTime::class\s*\)""")
    private val classLike =
        Regex(
            """^((public|private|internal|protected|abstract|open|sealed|data|enum|annotation|inner|value|""" +
                """expect|actual)\s+)*(class|object|interface)\b""",
        )

    /** A source line with its comment removed, or null when the whole line is comment. */
    private fun code(line: String): String? {
        val t = line.trim()
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return null
        return line.substringBefore(" //").substringBefore("\t//")
    }

    private fun relative(file: File): String =
        file.canonicalFile
            .relativeTo(File("..").canonicalFile)
            .invariantSeparatorsPath

    private fun sources(): List<File> {
        roots.assertFound("ExperimentalTimeOptInAllowlistTest")
        // This file is skipped by name, and only this file: its patterns are string literals spelling the very
        // annotations it forbids, so scanning it would report the guard as its own first offence.
        return roots
            .flatMap { it.dir.walkTopDown().filter { f -> f.isFile && f.extension == "kt" }.toList() }
            .filterNot { it.name == "ExperimentalTimeOptInAllowlistTest.kt" }
    }

    @Test
    fun theOptInAppearsInExactlyTheAllowlistedFilesAndCounts() {
        val found =
            sources()
                .associate { relative(it) to it.readLines().mapNotNull(::code).count { l -> optIn.containsMatchIn(l) } }
                .filterValues { it > 0 }
        // Positive control: the scan reaches the opt-ins it expects, so it is not passing over nothing.
        assertTrue("the scan found no ExperimentalTime opt-in at all - it is not looking", found.isNotEmpty())
        assertEquals(
            "@OptIn(ExperimentalTime::class) outside its allowlist, or a count that moved (KMP-DT R590). A new " +
                "site is an argument for the operator, not an edit to this map.",
            allowlist.toSortedMap(),
            found.toSortedMap(),
        )
    }

    @Test
    fun everyOptInIsOnAFunctionPropertyParameterOrExpressionNeverAFileOrAClass() {
        val offences = mutableListOf<String>()
        var seen = 0
        for (file in sources()) {
            val lines = file.readLines()
            lines.forEachIndexed { index, raw ->
                val line = code(raw) ?: return@forEachIndexed
                if (line.contains("ExperimentalTime") && !optIn.containsMatchIn(line) && line.contains("@")) {
                    if (Regex("""@(kotlin\.time\.)?ExperimentalTime\b""").containsMatchIn(line)) {
                        offences += "${relative(file)}:${index + 1} propagates @ExperimentalTime instead of opting in"
                    }
                }
                val hit = optIn.find(line) ?: return@forEachIndexed
                seen += 1
                if (line.contains("@file:")) {
                    offences += "${relative(file)}:${index + 1} is a FILE-level opt-in"
                    return@forEachIndexed
                }
                val sameLine = line.substring(hit.range.last + 1).trim()
                val target =
                    if (sameLine.isNotEmpty()) {
                        sameLine
                    } else {
                        lines
                            .drop(index + 1)
                            .mapNotNull(::code)
                            .map { it.trim() }
                            .firstOrNull { it.isNotEmpty() && !it.startsWith("@") }
                            .orEmpty()
                    }
                if (classLike.containsMatchIn(target)) {
                    offences += "${relative(file)}:${index + 1} opts in a whole declaration: $target"
                }
            }
        }
        assertTrue("the scope check saw no opt-in at all - it is not looking", seen > 0)
        assertTrue(
            "ExperimentalTime opt-ins at the wrong scope (KMP-DT R590):\n" + offences.joinToString("\n"),
            offences.isEmpty(),
        )
    }

    @Test
    fun noGradleFileOptsAModuleIn() {
        val offences = mutableListOf<String>()
        for (file in buildFiles) {
            assertTrue("the build file ${file.path} is missing (looked in ${file.absolutePath})", file.isFile)
            file.readLines().forEachIndexed { index, raw ->
                val t = raw.trim()
                val comment = t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*")
                if (!comment && raw.substringBefore("//").contains("ExperimentalTime")) {
                    offences += "${file.path}:${index + 1} $t"
                }
            }
        }
        assertTrue(
            "a module-wide ExperimentalTime opt-in (KMP-DT R590):\n" + offences.joinToString("\n"),
            offences.isEmpty(),
        )
    }
}
