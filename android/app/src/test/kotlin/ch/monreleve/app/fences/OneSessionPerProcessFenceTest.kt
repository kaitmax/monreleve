package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN-TOKEN-RACE (R507). ONE SessionManager PER PROCESS - A SECOND CONSTRUCTION SITE IS REFUSED.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that happened. SessionManager's single-flight refresh is a Mutex
 * PER INSTANCE. MainActivity built one and SyncWorker built another on every drain, both over the same Keystore
 * prefs file, so a screen and the worker meeting an expired access token together each sent the same refresh token;
 * the server answered the second as a replay and ended the whole session (R210). TokenRaceTest's hazard control
 * reproduces it. The cure is ONE instance, held by auth/SessionHolder.kt - and the cure lasts only as long as
 * nobody writes `SessionManager(...)` somewhere else, which no behavioural test can see until the race is lost.
 *
 * SO THE FENCE IS ON THE SHAPE: every construction of SessionManager - and of the SessionHolder that holds it -
 * in the sources a process runs, and the list must be EXACTLY the holder's file. Not "at most one": a list that
 * comes back EMPTY means the construction moved somewhere this fence cannot see, which is R452's failure, not a pass.
 *
 * THREE ROOTS, each found and pinned on its own (R460, FenceRoot):
 *   src/main/kotlin                    where the three sites were (MainActivity, SyncWorker, dev/SignInProbeActivity)
 *   ../shared/src/commonMain/kotlin    where SessionManager itself lives - an iOS-shaped second site would land here
 *   src/debug/kotlin                   R507 names main sources; debug is scanned TOO, because a debug-only second
 *                                      instance races on exactly the builds every device walkthrough runs.
 * Test sources are not scanned: a test builds its sessions over fakes, and a test is not the app.
 */
class OneSessionPerProcessFenceTest {
    private val roots =
        listOf(
            FenceRoot(File("src/main/kotlin"), pin = "MainActivity.kt"),
            FenceRoot(File("../shared/src/commonMain/kotlin"), pin = "SessionManager.kt"),
            FenceRoot(File("src/debug/kotlin"), pin = "SessionInjectionActivity.kt"),
        )

    @Test
    fun theFenceFoundEveryTreeAProcessRuns() {
        roots.assertFound(FENCE)
    }

    @Test
    fun theProcessBuildsItsSessionManagerInExactlyOnePlace() {
        roots.assertFound(FENCE)
        val sites = constructionSites(SESSION_MANAGER)

        assertEquals(
            "$FENCE: SessionManager must be constructed in exactly ONE place - $HOLDER_FILE, the process's holder. " +
                "Its refresh is single-flight PER INSTANCE, so a second instance over the same token store sends a " +
                "refresh token the first has already rotated, and the server ends the whole session (R210). Ask " +
                "for processSession(context) instead. Sites found:\n${sites.joinToString("\n")}",
            listOf(HOLDER_FILE),
            sites.map { it.substringBefore(':') },
        )
    }

    @Test
    fun theProcessHoldsExactlyOneHolder() {
        roots.assertFound(FENCE)
        val sites = constructionSites(SESSION_HOLDER)

        assertEquals(
            "$FENCE: a second SessionHolder is a second SessionManager by another name. Sites found:\n" +
                sites.joinToString("\n"),
            listOf(HOLDER_FILE),
            sites.map { it.substringBefore(':') },
        )
    }

    /** "File.kt:line  text" for every construction of [call] outside comments and outside its own declaration. */
    private fun constructionSites(call: Regex): List<String> =
        roots.ktFiles().flatMap { file ->
            file.readLines().mapIndexedNotNull { index, raw ->
                val line = raw.trim()
                val isComment = line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")
                val isDeclaration = DECLARATION.containsMatchIn(line)
                if (!isComment && !isDeclaration && call.containsMatchIn(line)) {
                    "${file.name}:${index + 1}  ${line.take(LINE_SHOWN)}"
                } else {
                    null
                }
            }
        }

    private companion object {
        const val FENCE = "R507 one session per process"
        const val HOLDER_FILE = "SessionHolder.kt"
        const val LINE_SHOWN = 100
        val SESSION_MANAGER = Regex("""\bSessionManager\s*\(""")
        val SESSION_HOLDER = Regex("""\bSessionHolder\s*\(""")

        /** `class SessionManager(` and `class SessionHolder(` declare; they do not construct. */
        val DECLARATION = Regex("""\bclass\s+Session(Manager|Holder)\b""")
    }
}
