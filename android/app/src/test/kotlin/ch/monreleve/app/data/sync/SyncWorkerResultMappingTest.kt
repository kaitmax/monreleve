package ch.monreleve.app.data.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// KMP-3 (R450). THE DRAIN RESULT THE WORKER MAPS TO SUCCESS/RETRY IS THE SAME FOR EACH CASE.
//
// WHAT WAS ALREADY PINNED AND WHAT WAS NOT. SyncEngineTest pins which SyncOutcome each
// situation produces - Settled for a drained queue, Retryable for a network fault, Settled
// again for a client defect held FAILED, Unauthenticated for no session. What NOTHING pinned
// is the other half of the sentence: what SyncWorker DOES with each of them. And that half is
// where the cost lives, because the three outcomes do not map onto two results in the obvious
// way:
//
//   Settled        -> success   the queue drained, defects included: a payload the server
//                               refused can never succeed, so retrying it is a queue that
//                               never empties (R198).
//   Retryable      -> retry     the only case WorkManager's exponential backoff should see.
//   Unauthenticated-> success   NOT retry. Rows stay PENDING and a fresh sign-in enqueues
//                               another drain; retrying now backs off forever against a
//                               session that is not coming back on its own.
//
// Map Unauthenticated to retry by accident and the symptom is a phone quietly backing off for
// hours. Map Retryable to success and a queued day is simply never sent again. Neither shows
// up in any suite that stops at the engine.
//
// WHY THIS IS A SOURCE FENCE RATHER THAN A CALL. doWork() is a CoroutineWorker method and a
// CoroutineWorker needs a Context and a WorkerParameters, which a JVM unit test has not got -
// which is exactly why this mapping went unguarded while every branch around it was tested.
// KMP-3 does not change the worker (the hard boundary keeps WorkManager in :app) but it DOES
// move SyncOutcome into :shared, so the type the worker switches on is about to live in
// another module. A fence on the shape of the `when` is the guard that crosses that move.
//
// It is the AccountCaptureFenceTest pattern, for the same reason that one exists: a behavioural
// test can only cover the branches somebody thought to write one for, and this catches the next
// edit of a file no unit test can construct.
class SyncWorkerResultMappingTest {
    private val source = File("src/main/kotlin/ch/monreleve/app/data/sync/SyncWorker.kt")

    /** The body of doWork's `when`, comments stripped - comments describe the rule, they are not the rule. */
    private fun mappingLines(): List<String> =
        source
            .readLines()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("//") && !it.startsWith("*") }
            .filter { it.contains("SyncOutcome") && it.contains("->") }

    @Test
    fun `the fence found the worker at all`() {
        // R133: a fence reading a path that moved reports perfect compliance over nothing.
        assertTrue("SyncWorker.kt was not found at ${source.path} - the fence read nothing", source.isFile)
        assertTrue("SyncWorker.kt no longer maps a drain outcome to a Result", mappingLines().isNotEmpty())
    }

    @Test
    fun `every drain outcome maps to the result the backoff policy depends on`() {
        val actual =
            mappingLines().associate { line ->
                val outcome = OUTCOME.find(line)?.groupValues?.get(1).orEmpty()
                val result = RESULT.find(line)?.groupValues?.get(1).orEmpty()
                outcome to result
            }

        assertEquals(
            "SyncWorker's outcome -> Result mapping changed. Unauthenticated must stay success " +
                "(rows wait for a sign-in, they do not back off), Settled must stay success " +
                "(a refused payload is never retried, R198), and Retryable is the ONLY case " +
                "WorkManager's exponential backoff is allowed to see.",
            mapOf(
                "Settled" to "success",
                "Retryable" to "retry",
                "Unauthenticated" to "success",
            ),
            actual,
        )
    }

    @Test
    fun `the when is exhaustive over the sealed outcome, so a fourth case cannot be forgotten`() {
        // The engine's own file is the source of truth for how many outcomes exist (R181):
        // adding a fifth SyncOutcome and forgetting the worker fails HERE, not on a phone.
        val engine = File("src/main/kotlin/ch/monreleve/app/data/sync/SyncEngine.kt")
        val moved = File("../shared/src/commonMain/kotlin/ch/monreleve/app/data/sync/SyncEngine.kt")
        val declaring = if (engine.isFile) engine else moved

        assertTrue(
            "SyncEngine.kt is in neither :app nor :shared commonMain - the outcome count cannot be derived",
            declaring.isFile,
        )

        // ONLY the sealed SyncOutcome's own block. SyncEngine.kt also declares a private
        // sealed BatchResult whose case names overlap (Retryable, Unauthenticated), and a
        // regex over the whole file would silently fold the two together - the guard
        // measuring something other than what it claims.
        val text = declaring.readText()
        val start = text.indexOf("sealed interface SyncOutcome {")
        assertTrue("SyncOutcome's declaration was not found in ${declaring.path}", start >= 0)
        val end = text.indexOf("\n}", start)
        assertTrue("SyncOutcome's declaration is unterminated", end > start)

        val declared =
            DECLARED_OUTCOME
                .findAll(text.substring(start, end))
                .map { it.groupValues[1] }
                .toSet()

        assertEquals(
            "the sealed SyncOutcome and SyncWorker's `when` no longer agree on the set of cases",
            declared,
            mappingLines().mapNotNull { OUTCOME.find(it)?.groupValues?.get(1) }.toSet(),
        )
    }

    private companion object {
        /** `is SyncOutcome.Settled ->` / `SyncOutcome.Retryable ->` */
        val OUTCOME = Regex("""SyncOutcome\.(\w+)""")

        /** `Result.success()` / `Result.retry()` */
        val RESULT = Regex("""Result\.(\w+)\(\)""")

        /** `data class Settled(` / `data object Retryable :` inside the sealed interface. */
        val DECLARED_OUTCOME = Regex("""data\s+(?:class|object)\s+(\w+)[\s(:]""")
    }
}
