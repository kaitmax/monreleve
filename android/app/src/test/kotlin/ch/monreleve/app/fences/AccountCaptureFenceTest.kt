package ch.monreleve.app.fences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-ACCOUNT-TAG (R424). THE ACCOUNT IS NEVER CAPTURED WHEN A SCREEN IS BUILT.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that happened rather than as a principle.
 * MainActivity composed the record repository with `accountStore.current()` - a String read ONCE -
 * and MainActivity is also what hosts the sign-in screen, so the value it read was null. Signing in
 * BY CODE sets the account without restarting the activity (the magic LINK does restart it, which
 * is why this survived), so every day recorded in that session was tagged UNOWNED: held forever,
 * never shown, never sent, gone at the next launch. Two rows for the same day on the S9, differing
 * only in whether the app had been restarted, are what proved it.
 *
 * EVERY COMPONENT DOWNSTREAM WAS INNOCENT, which is why nothing caught it. R303 says an unresolved
 * row is HELD - never sent, never shown - and EntryDao, SyncEngine and SyncWorker all honoured that
 * exactly. The defect was upstream of them, in what the row was tagged with.
 *
 * SO THE FENCE IS ON THE SHAPE OF THE CALL, NOT ON THE BEHAVIOUR. A behavioural test can only catch
 * the sites somebody thought to write one for; this catches the next site before it is written,
 * which is the half that was missing.
 *
 * WHAT IS ALLOWED. `{ accountStore.current() }` - a lambda, resolved when the row is written. That
 * is what SharedPrefsEmployerFigureStore already did three lines above the defect, with a comment
 * saying "the tag is read live from accountStore". The correct pattern was in the same file.
 *
 * WHAT IS REFUSED. `accountStore.current()` passed as a VALUE into a constructor - the shape that
 * freezes the answer at composition.
 */
class AccountCaptureFenceTest {
    private val sources: List<File> =
        File("src/main/kotlin")
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .toList()

    @Test
    fun `the walk found the source tree at all`() {
        // R63/R133: a fence that scanned nothing would report perfect compliance. "All of nothing is
        // compliant" is the vacuous pass every guard in this directory exists to refuse.
        assertTrue("no Kotlin sources found under src/main/kotlin", sources.size > 50)
        assertTrue(
            "the walk must reach MainActivity, which is where the defect was",
            sources.any { it.name == "MainActivity.kt" },
        )
    }

    @Test
    fun `no account is captured as a value at construction`() {
        val offences = mutableListOf<String>()

        for (file in sources) {
            file.readLines().forEachIndexed { index, rawLine ->
                val line = rawLine.trim()

                // Comments describe the rule; they are not the rule.
                if (line.startsWith("//") || line.startsWith("*")) return@forEachIndexed

                // The shape that froze the answer: `.current()` handed over as an argument, with no
                // brace making it a lambda. `currentAccount = { ... }` and `{ accountStore.current() }`
                // both carry a brace before the call and are the point of the fix.
                val callsCurrent = ACCOUNT_READ.containsMatchIn(line)
                if (!callsCurrent) return@forEachIndexed

                val insideLambda = line.contains("{") && line.indexOf("{") < line.indexOf(".current()")
                val isTheStoreItself = file.name == "AccountStore.kt"
                val isAssignment = ASSIGNMENT.containsMatchIn(line)

                if (!insideLambda && !isTheStoreItself && !isAssignment) {
                    offences += "${file.name}:${index + 1}  ${line.take(100)}"
                }
            }
        }

        assertEquals(
            "an account read as a VALUE into a constructor freezes it at composition, and signing in " +
                "is exactly the event that changes the answer. Pass a provider instead - " +
                "`currentAccount = { accountStore.current() }` - so the tag is resolved when the row " +
                "is written (R423).",
            emptyList<String>(),
            offences,
        )
    }

    private companion object {
        /** A read of the current account. */
        val ACCOUNT_READ = Regex("""accountStore\.current\(\)|AccountStore\([^)]*\)\.current\(\)""")

        /**
         * `val tag = accountStore.current()` inside a function body is a LOCAL read, used and
         * discarded - not a capture handed to something that outlives the call. The defect was
         * specifically a value passed INTO a constructor.
         */
        val ASSIGNMENT = Regex("""^(val|var)\s+\w+\s*(:\s*[\w?<>. ]+)?\s*=""")
    }
}
