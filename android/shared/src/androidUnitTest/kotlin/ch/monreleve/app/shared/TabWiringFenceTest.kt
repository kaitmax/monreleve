package ch.monreleve.app.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * IOS-AUDIT R1351 (iOS Ruling 14 Q1). THE FOUR-TAB WIRING HAS ONE HOME, AND A RENAMED COPY OF IT FAILS.
 *
 * IOS-MOVE-TABS R1360 moved the `when (tab)` over the four tabs into commonMain MainTabs.kt, which both shells call,
 * and MovedTwinsFenceTest refuses a copy that keeps a moved NAME. A copy under ANOTHER name - IosMainShell's old
 * `when (tab)` pasted into a new composable, an Android helper that grows its own branch - would pass that fence. So
 * this one is on the SHAPE rather than the name: an `AppTab.<X> ->` branch is the wiring, wherever it sits, and only
 * the two files that own the tabs may hold one:
 *   - MainTabs.kt (commonMain): the four branches;
 *   - AppBottomBar.kt (commonMain): the bar, which compares and selects tabs (and holds no branch today).
 * A branch on an entry IMPORTED by name (`import ...AppTab.RELEVE`, then `RELEVE ->`) is the same copy with the prefix
 * dropped, so such an import is refused outside those two files as well.
 *
 * WHERE IT LOOKS: every tree the two apps' MAIN code lives in - :app main (and debug, which a debug APK runs), :shared
 * commonMain, androidMain and iosMain - each root asserted present and pinned by a file only it holds (R460's rule,
 * MovedTwinsFenceTest's shape). Test sources are not scanned: a test may well branch on a tab.
 *
 * PRESENCE FIRST (R169's corollary, R154): MainTabs.kt must hold one branch for EVERY AppTab entry - the entries read
 * from AppTab.kt itself, so a fifth tab is expected the day it is declared - or this fence is a regex that matches
 * nothing and passes over everything. The pattern is exercised on known strings in both directions.
 */
class TabWiringFenceTest {
    private val commonMain = File("src/commonMain/kotlin")
    private val roots =
        listOf(
            Root(File("../app/src/main/kotlin"), pin = "MainActivity.kt"),
            Root(File("../app/src/debug/kotlin"), pin = "SessionInjectionActivity.kt"),
            Root(commonMain, pin = "MainTabs.kt"),
            Root(File("src/androidMain/kotlin"), pin = "AccountTag.android.kt"),
            Root(File("src/iosMain/kotlin"), pin = "IosShellUi.kt"),
        )

    private class Root(
        val dir: File,
        val pin: String,
    ) {
        fun files(): List<File> = dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    }

    private val appTabFile = File(commonMain, "ch/monreleve/app/ui/shell/AppTab.kt")
    private val mainTabsFile = File(commonMain, "ch/monreleve/app/MainTabs.kt")

    @Test
    fun everyRootIsTheRealOneAndHoldsItsPin() {
        for (root in roots) {
            val files = root.files()
            assertTrue(
                "$FENCE: root ${root.dir.path} not found (looked in ${root.dir.absolutePath})",
                root.dir.isDirectory,
            )
            assertTrue(
                "$FENCE: root ${root.dir.path} does not hold ${root.pin} - it resolves to someone else's sources",
                files.any { it.name == root.pin },
            )
        }
    }

    @Test
    fun mainTabsHoldsOneBranchForEveryTab() {
        val entries = tabEntries()
        assertEquals("$FENCE: AppTab.kt declares the four tabs (read, not typed: ${appTabFile.path})", 4, entries.size)
        val branched = branches(stripComments(mainTabsFile.readText())).sorted()
        assertEquals(
            "$FENCE: MainTabs.kt must branch once on every AppTab entry - the presence that makes an absence mean " +
                "something (R169)",
            entries.sorted(),
            branched,
        )
    }

    @Test
    fun noTabBranchOrEntryImportOutsideTheTwoHomes() {
        val offenders = mutableListOf<String>()
        for (root in roots) {
            for (file in root.files()) {
                if (file.name in HOMES) continue
                val text = stripComments(file.readText())
                branches(text).forEach { offenders += "${file.path}: branch AppTab.$it ->" }
                ENTRY_IMPORT.findAll(text).forEach { offenders += "${file.path}: ${it.value.trim()}" }
            }
        }
        assertTrue(
            "$FENCE: the four-tab wiring has ONE home, MainTabs.kt (R1360); a branch on a tab anywhere else is a " +
                "second copy of it, renamed or not. Call MainTabs. Found:\n" + offenders.joinToString("\n"),
            offenders.isEmpty(),
        )
    }

    @Test
    fun thePatternsFireOnTheShapesAndOnNothingElse() {
        val code =
            """
            |when (tab) {
            |    AppTab.AUJOURDHUI -> a()
            |    AppTab . RELEVE->{ b() }
            |    AppTab.CALENDRIER,
            |    AppTab.PARAMETRES -> c()
            |}
            |val same = tab == AppTab.RELEVE
            |onSelect(AppTab.PARAMETRES)
            |val f = { t: AppTab -> t }
            """.trimMargin()
        assertEquals(listOf("AUJOURDHUI", "RELEVE", "CALENDRIER", "PARAMETRES"), branches(code))
        assertTrue(ENTRY_IMPORT.containsMatchIn("import ch.monreleve.app.ui.shell.AppTab.RELEVE"))
        assertTrue(ENTRY_IMPORT.containsMatchIn("import ch.monreleve.app.ui.shell.AppTab.*"))
        assertTrue(!ENTRY_IMPORT.containsMatchIn("import ch.monreleve.app.ui.shell.AppTab"))
        assertTrue(!ENTRY_IMPORT.containsMatchIn("import ch.monreleve.app.ui.shell.AppTabBar"))
        assertEquals(emptyList<String>(), branches(stripComments("// AppTab.RELEVE -> in prose\n/* AppTab.X -> */")))
    }

    private fun tabEntries(): List<String> {
        val body =
            Regex("""enum\s+class\s+AppTab\s*\{([^}]*)\}""").find(stripComments(appTabFile.readText()))
                ?.groupValues
                ?.get(1)
        return checkNotNull(body) { "$FENCE: no `enum class AppTab { ... }` in ${appTabFile.path}" }
            .split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    }

    private fun branches(text: String): List<String> {
        // A branch may list several conditions (`AppTab.A,\n AppTab.B -> x`): the LAST condition carries the arrow, so
        // the pattern reads every `AppTab.<X>` that is followed - through commas, more conditions and whitespace - by
        // `->`. The lambda parameter `t: AppTab ->` names the type, not an entry, and is not matched.
        val branchGroups = Regex("""((?:AppTab\s*\.\s*[A-Z_]+\s*,\s*)*AppTab\s*\.\s*[A-Z_]+)\s*->""")
        return branchGroups.findAll(text).flatMap { group ->
            Regex("""AppTab\s*\.\s*([A-Z_]+)""").findAll(group.groupValues[1]).map { it.groupValues[1] }
        }.toList()
    }

    private companion object {
        const val FENCE = "TabWiringFenceTest (R1351)"
        val HOMES = setOf("MainTabs.kt", "AppBottomBar.kt")
        val ENTRY_IMPORT = Regex("""import\s+ch\.monreleve\.app\.ui\.shell\.AppTab\.(?:[A-Z_]+|\*)""")

        fun stripComments(text: String): String =
            text
                .replace(Regex("""/\*[\s\S]*?\*/"""), "")
                .replace(Regex("""//.*"""), "")
    }
}
