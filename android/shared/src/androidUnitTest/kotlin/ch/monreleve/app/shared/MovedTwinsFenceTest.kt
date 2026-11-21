package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-MOVE-TWINS R1242 (PARK-IF4 closed). THE THREE TWINS HAVE ONE HOME, IN commonMain, AND NO COPY COMES BACK.
 *
 * Until this task, account/DeviceLocalStore.kt, detection/EveningNotificationDecision.kt and
 * detection/ThresholdAlertDecision.kt lived twice: in :app, and byte-identical in :shared's iosMain (IOS-2f R889/R892),
 * held equal by IosAndroidTwinsTest. They moved ONCE to commonMain under the same packages and both copies went. This
 * fence replaces IosAndroidTwinsTest, because the danger has changed shape: the copies no longer need to be EQUAL, they
 * must not EXIST - and the two places a copy could come back are the two the Windows gate's compiler does not catch:
 *
 *   - :app (any source set). :app is another module, so a class at the same package and name there is not a
 *     redeclaration error: it SHADOWS the commonMain one for :app's code and tests, which then exercise the copy.
 *   - iosMain. There a copy IS a redeclaration error - but only in the iOS compilation, which runs on macOS (R573),
 *     never in :app:gate (kotlin.native.enableKlibsCrossCompilation=false).
 *
 * DISCOVERY IS BY NAME, NOT BY A TYPED PATH LIST (R246). The names guarded are DERIVED from the three commonMain files'
 * own top-level declarations (so a declaration added to one of them is guarded the day it is written), and every
 * Kotlin file under both roots is read - a copy cannot escape by sitting at another path or under another file name.
 * A file of one of the three NAMES anywhere under either root also fails, whatever it declares.
 *
 * And the general form of IosAndroidTwinsTest is kept, asserted EMPTY: no iosMain file shares its path relative to the
 * kotlin root with a :app main file, so a fourth twin of any other file is refused here too (R206: one text, one home).
 *
 * Every root is asserted found and pinned (R460), and the subject files are asserted present in commonMain, so a
 * fence pointed at nothing fails rather than passing over nothing (R154, R169). The extractor is exercised on known
 * strings in both directions, so a pattern that stopped matching fails rather than reporting perfect compliance.
 */
class MovedTwinsFenceTest {
    private val commonMain = File("src/commonMain/kotlin")
    private val iosMain = File("src/iosMain/kotlin")
    private val appSrc = File("../app/src")
    private val appMain = File("../app/src/main/kotlin")

    // The subject: the three files that moved (R1240). Asserted present, so a later move fails here by name.
    private val moved =
        listOf(
            "ch/monreleve/app/account/DeviceLocalStore.kt",
            "ch/monreleve/app/detection/EveningNotificationDecision.kt",
            "ch/monreleve/app/detection/ThresholdAlertDecision.kt",
        )

    private fun movedFiles(): List<File> = moved.map { File(commonMain, it) }

    /** Every top-level, non-private name the three commonMain files declare - the names a copy would redeclare. */
    private fun guardedNames(): Set<String> =
        movedFiles().flatMap { declaredNames(it.readText(), publicOnly = true) }.toSet()

    private fun ktFiles(root: File): List<File> =
        root.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    private fun copiesUnder(root: File): List<String> {
        val names = guardedNames()
        val fileNames = movedFiles().map { it.name }.toSet()
        return ktFiles(root).flatMap { file ->
            val where = file.relativeTo(root).invariantSeparatorsPath
            val byFileName = if (file.name in fileNames) listOf("$where: a file named ${file.name}") else emptyList()
            val byDeclaration =
                declaredNames(file.readText(), publicOnly = false)
                    .filter { it in names }
                    .map { "$where: declares $it" }
            byFileName + byDeclaration
        }
    }

    @Test
    fun theRootsAndTheSubjectAreTheRealOnes() {
        assertTrue("iosMain root not found at ${iosMain.absolutePath}", File(iosMain, PIN_IOS).isFile)
        assertTrue(":app source root not found at ${appSrc.absolutePath}", File(appSrc, PIN_APP).isFile)
        movedFiles().forEach { file ->
            assertTrue("moved file not in commonMain (moved again?): ${file.path}", file.isFile)
            assertTrue(
                "${file.name} yields no top-level declaration - the extractor reads nothing",
                declaredNames(file.readText(), publicOnly = true).isNotEmpty(),
            )
        }
        // Proof the derivation reaches the classes the files are named after.
        assertTrue(guardedNames().containsAll(setOf("DeviceLocalStore", "ThresholdAlertDecision", "eveningDecision")))
    }

    @Test
    fun theExtractorMatchesDeclarationsAndNothingElse() {
        val text =
            """
            |package x
            |// class InAComment
            |/* data class InABlock( */
            |@Suppress("X")
            |class Plain(
            |sealed interface Sealed {
            |    data object Nested : Sealed
            |}
            |data class Data(val a: Int)
            |fun topFun(): Int = 1
            |suspend fun topSuspend() = Unit
            |internal val topVal = 1
            |private val hidden = 1
            |val alsoADeclaration = Plain()
            """.trimMargin()
        assertEquals(
            setOf("Plain", "Sealed", "Data", "topFun", "topSuspend", "topVal", "alsoADeclaration"),
            declaredNames(text, publicOnly = true),
        )
        assertTrue("hidden" in declaredNames(text, publicOnly = false))
    }

    @Test
    fun noCopyOfAMovedFileIsInApp() {
        val found = copiesUnder(appSrc)
        assertTrue(
            "R1242: a moved twin reappeared in :app - it would SHADOW the commonMain declaration there. " +
                "Delete it; the one home is :shared commonMain.\n${found.joinToString("\n")}",
            found.isEmpty(),
        )
    }

    @Test
    fun noCopyOfAMovedFileIsInIosMain() {
        val found = copiesUnder(iosMain)
        assertTrue(
            "R1242: a moved twin reappeared in iosMain - a redeclaration only the macOS compilation sees. Delete it; " +
                "the one home is :shared commonMain.\n${found.joinToString("\n")}",
            found.isEmpty(),
        )
    }

    @Test
    fun noIosMainFileSharesAPathWithAnAppFile() {
        assertTrue(":app main root not found at ${appMain.absolutePath}", File(appMain, PIN_APP_MAIN).isFile)
        val twins =
            ktFiles(iosMain)
                .map { it.relativeTo(iosMain).invariantSeparatorsPath }
                .filter { File(appMain, it).isFile }
        assertEquals(
            "R206: an iosMain copy of a :app file is a second home; move it to commonMain",
            emptyList<String>(),
            twins,
        )
    }

    private companion object {
        const val PIN_IOS = "ch/monreleve/app/ios/IosSyncTrigger.kt"
        const val PIN_APP = "main/kotlin/ch/monreleve/app/MainActivity.kt"
        const val PIN_APP_MAIN = "ch/monreleve/app/MainActivity.kt"

        private val DECLARATION =
            Regex(
                """^((?:(?:public|internal|private|sealed|data|enum|abstract|open|inline|value|annotation|suspend|""" +
                    """const|fun)\s+)*)(?:class|interface|object|fun|val|var|typealias)\s+(?:<[^>]*>\s*)?""" +
                    """([A-Za-z_]\w*)""",
            )

        private fun stripComments(text: String): String =
            text
                .replace(Regex("""/\*[\s\S]*?\*/"""), "")
                .replace(Regex("""//.*"""), "")

        /** Top-level declarations only: a declaration at column 0, comments stripped first. */
        fun declaredNames(
            text: String,
            publicOnly: Boolean,
        ): Set<String> =
            stripComments(text)
                .lines()
                .mapNotNull { DECLARATION.find(it) }
                .filterNot { publicOnly && "private" in it.groupValues[1] }
                .map { it.groupValues[2] }
                .toSet()
    }
}
