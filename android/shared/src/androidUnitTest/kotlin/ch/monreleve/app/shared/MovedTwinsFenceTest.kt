package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-MOVE-TWINS R1242 (PARK-IF4 closed). THE THREE TWINS HAVE ONE HOME, IN commonMain, AND NO COPY COMES BACK.
 * IOS-MOVE-ME R1273 added the /me codec (settings/MeWire.kt), moved from :app the same way; iOS Ruling 7 Q3: every
 * later (c) move adds its files to [moved]. IOS-MOVE-SEAM R1283 added the session-end seam's pure part
 * (auth/SessionEndSeam.kt, the contract and the wrapper; auth/SessionEnds.kt, whole). :app kept the Android body of the
 * seam under a file name of its own (auth/DeviceSessionEndSeam.kt), which is why a moved FILE NAME in :app fails here.
 * IOS-MOVE-REMINDER R1293 added the 19:00 fallback's pure part (reminder/FallbackReminder.kt, ported to
 * kotlinx-datetime), the iOS reminder plan beside it (reminder/EveningReminderPlan.kt, new) and the copy they use
 * (fr/NotificationCopy.kt). The java.time overloads that keep :app's runtime and pin unedited share three of the
 * moved names by design; they live in :shared androidMain (reminder/JavaTimeFallbackReminder.kt), which is not a
 * place this fence reads.
 *
 * Until this task, account/DeviceLocalStore.kt, detection/EveningNotificationDecision.kt and
 * detection/ThresholdAlertDecision.kt lived twice: in :app, and byte-identical in :shared's iosMain (IOS-2f R889/R892),
 * held equal by IosAndroidTwinsTest. They moved ONCE to commonMain under the same packages and both copies went. This
 * fence replaces IosAndroidTwinsTest, because the danger has changed shape: the copies no longer need to be EQUAL, they
 * must not EXIST, in either of the two places a copy could come back:
 *
 *   - :app (any source set). :app is another module, so a declaration at the same package and name there is a
 *     SECOND HOME for it, compiled against :shared's. What the compiler then does with it is not what this fence
 *     relies on: it finds the copy by name and refuses it, whatever the compiler would have made of it. (M1 wrote
 *     "it SHADOWS the commonMain one", which was argued, never measured - iOS Ruling 7; REPORT-IOS-MOVE-ME records
 *     what one planted :app copy actually did to the :app compilation.)
 *   - iosMain. There a copy IS a redeclaration error - but only in the iOS compilation, which runs on macOS (R573),
 *     never in :app:gate (kotlin.native.enableKlibsCrossCompilation=false).
 *
 * DISCOVERY IS BY NAME, NOT BY A TYPED PATH LIST (R246). The names guarded are DERIVED from the moved commonMain files'
 * own top-level declarations (so a declaration added to one of them is guarded the day it is written; an extension is
 * guarded by its own name, not its receiver's), and every Kotlin file under both roots is read - a copy cannot escape
 * by sitting at another path or under another file name. A file of one of the moved NAMES anywhere under either root
 * also fails, whatever it declares.
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

    // The subject: the files that moved - the three twins (R1240), the /me codec (IOS-MOVE-ME R1270, iOS Ruling 7
    // Q3: every later (c) move adds its files here) and the session-end seam's pure part (IOS-MOVE-SEAM R1280/R1283).
    // Asserted present, so a later move fails here by name.
    private val moved =
        listOf(
            "ch/monreleve/app/account/DeviceLocalStore.kt",
            "ch/monreleve/app/detection/EveningNotificationDecision.kt",
            "ch/monreleve/app/detection/ThresholdAlertDecision.kt",
            "ch/monreleve/app/settings/MeWire.kt",
            "ch/monreleve/app/auth/SessionEndSeam.kt",
            "ch/monreleve/app/auth/SessionEnds.kt",
            // IOS-MOVE-REMINDER R1293.
            "ch/monreleve/app/reminder/FallbackReminder.kt",
            "ch/monreleve/app/reminder/EveningReminderPlan.kt",
            "ch/monreleve/app/fr/NotificationCopy.kt",
            // IOS-MOVE-CORE R1300/R1303: the shell's platform-free files, moved whole (git mv, blobs unchanged).
            "ch/monreleve/app/ui/shell/AppRoot.kt",
            "ch/monreleve/app/ui/shell/AppTab.kt",
            "ch/monreleve/app/ui/shell/ResolvingScreen.kt",
            "ch/monreleve/app/detection/LoggingModeRestore.kt",
            "ch/monreleve/app/onboarding/ManualOnlyOnboarding.kt",
            "ch/monreleve/app/startup/StartupDecider.kt",
            // IOS-MOVE-CORE R1300: the one-change files - the bar on Glyph, Site on the split-off host - and the two
            // contracts split from :app files that keep their Android halves under their own names.
            "ch/monreleve/app/ui/shell/AppBottomBar.kt",
            "ch/monreleve/app/parametres/Site.kt",
            "ch/monreleve/app/auth/CallbackLinkHost.kt",
            "ch/monreleve/app/settings/EmployerFigureStore.kt",
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
        assertTrue(
            guardedNames().containsAll(
                setOf(
                    "DeviceLocalStore", "ThresholdAlertDecision", "eveningDecision", "mePatchBody", "isMeAnswer",
                    // IOS-MOVE-SEAM R1283: a fun interface, an enum class, a class, a top-level val and a fun.
                    "SessionEndSeam", "SessionEndPath", "SessionEndingStore", "processSessionEnds", "heldDays",
                    // IOS-MOVE-REMINDER R1293: a val, annotated funs, a suspend fun, an enum, a const, data
                    // classes and an object.
                    "FALLBACK_REMINDER_TIME", "nextFallbackAt", "fallbackWake", "FallbackWake",
                    "restoredEveningOptIn", "EVENING_REMINDER_HORIZON", "EveningReminderPlan",
                    "eveningReminderPlan", "NotificationCopy", "NotificationLines",
                    // IOS-MOVE-CORE R1303: composables, an enum, plain and extension funs, sealed interfaces.
                    "AppRoot", "AppTab", "ResolvingScreen", "phoneLoggingMode", "applyServerLoggingMode",
                    "onboardingSeedFor", "StartDecision", "UnresolvedCause", "MeFetch", "Resolution", "resolveStart",
                    "decideStartAfterSignIn", "meFetchOf",
                    // IOS-MOVE-CORE R1300: the one-change files and the two split-off contracts.
                    "AppBottomBar", "Site", "CallbackLinkHost", "EmployerFigureStore",
                ),
            ),
        )
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
            |fun Settings.extensionFun(a: Int): String = ""
            |fun <T> List<T>.genericExtension() = Unit
            |val Plain.extensionVal: Int get() = 1
            |fun interface FunInterface {
            |enum class Enumerated {
            |@OptIn(Marker::class) // a comment after an annotation
            |fun annotatedFun(
            |const val TOP_CONST: Int = 7
            """.trimMargin()
        assertEquals(
            setOf(
                "Plain", "Sealed", "Data", "topFun", "topSuspend", "topVal", "alsoADeclaration",
                // IOS-MOVE-ME R1273: an extension is guarded by ITS name, never its receiver's (mePatchBody,
                // not Settings).
                "extensionFun", "genericExtension", "extensionVal",
                // IOS-MOVE-SEAM R1283: the two declaration shapes this move brings (SessionEndSeam, SessionEndPath).
                "FunInterface", "Enumerated",
                // IOS-MOVE-REMINDER R1293: a declaration under its annotation line, and a const val.
                "annotatedFun", "TOP_CONST",
            ),
            declaredNames(text, publicOnly = true),
        )
        assertTrue("hidden" in declaredNames(text, publicOnly = false))
    }

    @Test
    fun noCopyOfAMovedFileIsInApp() {
        val found = copiesUnder(appSrc)
        assertTrue(
            "R1242/R1273/R1283/R1293: :app declares a name (or holds a file name) of a file moved to :shared " +
                "commonMain - a second home for it. Delete it; the one home is :shared commonMain.\n" +
                found.joinToString("\n"),
            found.isEmpty(),
        )
    }

    @Test
    fun noCopyOfAMovedFileIsInIosMain() {
        val found = copiesUnder(iosMain)
        assertTrue(
            "R1242/R1273/R1283/R1293: iosMain declares a name (or holds a file name) of a file moved to :shared " +
                "commonMain - a redeclaration only the macOS compilation sees. Delete it; the one home is :shared " +
                "commonMain.\n" +
                found.joinToString("\n"),
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
                    // IOS-MOVE-ME R1273: an extension's receiver (`Settings.`, `List<T>.`) is skipped, so the name
                    // captured is the declaration's own - before, `fun Settings.mePatchBody` yielded "Settings".
                    """(?:[A-Za-z_][\w<>?, ]*\.)?([A-Za-z_]\w*)""",
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
