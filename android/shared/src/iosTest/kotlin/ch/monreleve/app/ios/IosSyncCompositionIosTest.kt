package ch.monreleve.app.ios

import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.contracts.MemoryAccountStore
import ch.monreleve.app.contracts.MemoryDossierBacking
import ch.monreleve.app.contracts.MemoryDossierCache
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.SyncOutcome
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2f R890. THE COMPOSED DRAIN AND THE FOLLOW-UP DECISION, on the simulator, over the REAL iOS database and the
// shared SyncEngine: the account is read when the drain RUNS (R303 - a drain built while A was signed in and run
// after B signed in sends B's queue, never A's); no account sends nothing; syncNow (the drain called directly) is
// cancelled by its caller's bound and leaves the day PENDING (Parametres' R440 send); and the follow-up is SyncWorker's
// mapping.

private const val R890_ACCOUNT_A = "a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0"
private const val R890_ACCOUNT_B = "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0"

/** Records every body it is handed and answers with [answer] - or never answers, when [hang]. */
private class R890Poster(
    private val answer: PostOutcome = PostOutcome.NetworkError,
    private val hang: Boolean = false,
) : AuthenticatedPoster {
    val bodies = mutableListOf<String>()
    val reached = CompletableDeferred<Unit>()
    var cancelled = false

    override suspend fun authenticatedPost(
        path: String,
        body: String,
    ): PostOutcome {
        bodies += body
        reached.complete(Unit)
        if (hang) {
            try {
                awaitCancellation()
            } finally {
                cancelled = true
            }
        }
        return answer
    }
}

class IosSyncCompositionIosTest {
    @Test
    fun theDrainSendsTheQueueOfTheAccountSignedInWhenItRunsNotWhenItWasBuilt() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            val dao = database.entryDao()
            dao.upsert(ios2fEntry("r890-a1", "2026-10-12", R890_ACCOUNT_A))
            dao.upsert(ios2fEntry("r890-b1", "2026-10-12", R890_ACCOUNT_B))
            val accounts = MemoryAccountStore(arrayOf<String?>(R890_ACCOUNT_A))
            val poster = R890Poster()
            val drain = iosSyncDrain(dao, poster, accounts, MemoryDossierCache(MemoryDossierBacking()))

            accounts.setCurrent(R890_ACCOUNT_B) // A signed out, B signed in - after the drain was built
            val outcome = ios2fBounded("one drain") { drain() }

            assertEquals(1, poster.bodies.size, "positive control: the shared engine posted, once")
            assertTrue("r890-b1" in poster.bodies.single(), "B's day goes up under B's session")
            assertFalse("r890-a1" in poster.bodies.single(), "R303: A's day never goes up under B's session")
            assertEquals(SyncOutcome.Retryable, outcome)
            assertEquals(SyncState.PENDING, dao.pendingForAccount(R890_ACCOUNT_B).single().syncState)
            database.close()
            removeDirectory(directory)
        }

    @Test
    fun noAccountSignedInSendsNothing() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            database.entryDao().upsert(ios2fEntry("r890-n1", "2026-10-12", R890_ACCOUNT_A))
            val accounts = MemoryAccountStore(arrayOf<String?>(R890_ACCOUNT_A))
            val poster = R890Poster()
            val drain = iosSyncDrain(database.entryDao(), poster, accounts, MemoryDossierCache(MemoryDossierBacking()))

            accounts.clear() // signed out after the drain was built
            val outcome = ios2fBounded("one drain") { drain() }

            assertEquals(SyncOutcome.Unauthenticated, outcome)
            assertTrue(poster.bodies.isEmpty(), "R303: no account, nothing sent")
            database.close()
            removeDirectory(directory)
        }

    @Test
    fun syncNowIsCancelledByItsCallersBoundAndLeavesTheDayPending() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            database.entryDao().upsert(ios2fEntry("r890-s1", "2026-10-12", R890_ACCOUNT_A))
            val poster = R890Poster(hang = true)
            val syncNow =
                iosSyncDrain(
                    database.entryDao(),
                    poster,
                    MemoryAccountStore(arrayOf<String?>(R890_ACCOUNT_A)),
                    MemoryDossierCache(MemoryDossierBacking()),
                )

            // ParametresController's shape: withTimeoutOrNull(SIGN_OUT_SYNC_TIMEOUT_MS) { syncNow() }, shortened.
            val sent = withTimeoutOrNull(300) { syncNow() }

            assertNull(sent, "the bound expired")
            assertTrue(poster.reached.isCompleted, "positive control: the send was under way")
            assertTrue(poster.cancelled, "the caller's bound cancelled the send itself")
            val stillPending = database.entryDao().pendingForAccount(R890_ACCOUNT_A).map { it.clientMutationId }
            assertEquals(listOf("r890-s1"), stillPending, "the day is still PENDING")
            database.close()
            removeDirectory(directory)
        }

    @Test
    fun theFollowUpIsSyncWorkersMapping() {
        assertEquals(SyncFollowUp.DONE, syncFollowUp(SyncOutcome.Settled(written = 3, defects = 1)))
        assertEquals(SyncFollowUp.RETRY_LATER, syncFollowUp(SyncOutcome.Retryable))
        assertEquals(SyncFollowUp.DONE, syncFollowUp(SyncOutcome.Unauthenticated), "never a retry without a session")
    }
}

class IosSyncTriggerCancelIosTest {
    @Test
    fun cancelStopsTheRunningDrainDropsTheCoalescedOneAndLeavesTheTriggerUsable() =
        runBlocking {
            val scope = CoroutineScope(Job())
            try {
                var drains = 0
                val started = CompletableDeferred<Unit>()
                var firstCancelled = false
                val trigger =
                    IosSyncTrigger(scope) {
                        drains++
                        if (drains == 1) {
                            started.complete(Unit)
                            try {
                                awaitCancellation()
                            } finally {
                                firstCancelled = true
                            }
                        }
                        SyncOutcome.Settled(0, 0)
                    }
                val first = trigger.afterWrite()
                ios2fBounded("the first drain starting") { started.await() }
                trigger.afterWrite() // coalesced behind the running drain

                trigger.cancel()

                ios2fBounded("the cancelled drain stopping") { first.join() }
                assertTrue(firstCancelled, "the running drain was cancelled")
                assertEquals(1, drains, "the coalesced request was dropped, not run after the cancel")
                assertNull(trigger.lastOutcome, "a cancelled drain records no outcome")

                ios2fBounded("a fresh drain after the cancel") { trigger.afterWrite().join() }
                assertEquals(2, drains, "the trigger is still usable: the next request starts a fresh drain")
                assertEquals(SyncOutcome.Settled(0, 0), trigger.lastOutcome)
            } finally {
                scope.cancel()
            }
        }
}
