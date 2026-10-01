package ch.monreleve.app.data.repo

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.SyncEngine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * AN-FIX F4 / R303. ONE ACCOUNT'S DATA MUST NEVER DRAIN INTO, OR BE SHOWN UNDER, ANOTHER ON THE SAME
 * DEVICE. These are the three behaviours the fix must deliver, committed FAILING first (R20/FW31):
 *   - the sync worker sends ONLY the current account's rows;
 *   - the screens show ONLY the current account's rows;
 *   - a different account's pending days are SET ASIDE - kept, not sent, not shown - and sync under
 *     their own account when it signs back in.
 * Plus the UNOWNED behaviour (a row whose account cannot be resolved is excluded from BOTH, R303).
 *
 * WHY THESE FAIL BEFORE THE FIX. Increment 1 leaves SyncEngine draining dao.pending() (every account)
 * and the repository observing dao.observeAll() (every account); the fix (increment 2) gives both an
 * AccountStore and scopes them to the current account. The RED construction here drives the unscoped
 * code and asserts the scoped outcome, so each assertion is red until the scope exists.
 */
class AccountScopeTest {
    private val clock = Clock.fixed(Instant.parse("2027-06-20T10:00:00Z"), ZoneId.of("Europe/Paris"))

    private val accountA = "acct-a-tag"
    private val accountB = "acct-b-tag"

    private class CapturingPoster : AuthenticatedPoster {
        val bodies = mutableListOf<String>()

        override suspend fun authenticatedPost(
            path: String,
            body: String,
        ): PostOutcome {
            bodies += body
            return PostOutcome.Ok(status = 200, body = """{"status":"ok","written":0,"duplicates":0,"entries":[]}""")
        }
    }

    private fun entry(
        account: String,
        mutId: String,
        day: String,
        state: SyncState = SyncState.PENDING,
    ): EntryEntity =
        EntryEntity(
            clientMutationId = mutId,
            dayDate = day,
            portion = Portion.FULL,
            kind = EntryKind.CH,
            absenceReason = null,
            note = null,
            provenance = Provenance.MANUAL,
            detectedKind = null,
            detectedAt = null,
            clientClaimedAt = "${day}T12:00:00.000+02:00",
            serverId = null,
            firstRecordedAt = null,
            lastModifiedAt = null,
            syncState = state,
            accountTag = account,
        )

    private suspend fun daoWith(vararg entries: EntryEntity): FakeEntryDao {
        return FakeEntryDao().apply { entries.forEach { upsert(it) } }
    }

    private fun sent(poster: CapturingPoster): String = poster.bodies.joinToString("\n")

    // --- Behaviour 1: the sync worker sends ONLY the current account's rows. -------------------------
    @Test
    fun syncSendsOnlyTheCurrentAccountsRows() =
        runTest {
            // A has two pending days; B (the account signed in now) has one. B's sync must post B's only.
            val dao =
                daoWith(
                    entry(accountA, "mut-a1", "2027-06-18"),
                    entry(accountA, "mut-a2", "2027-06-19"),
                    entry(accountB, "mut-b1", "2027-06-20"),
                )
            val poster = CapturingPoster()

            SyncEngine(dao, poster, accountB).sync()

            val body = sent(poster)
            assertTrue("B's own row must be sent", body.contains("mut-b1"))
            assertFalse("A's offline days must NOT drain under B (F4)", body.contains("mut-a1"))
            assertFalse("A's offline days must NOT drain under B (F4)", body.contains("mut-a2"))
        }

    // --- Behaviour 2: the screens show ONLY the current account's rows. ------------------------------
    @Test
    fun theDisplayShowsOnlyTheCurrentAccountsRows() =
        runTest {
            val dao =
                daoWith(
                    entry(accountA, "mut-a1", "2027-06-18"),
                    entry(accountB, "mut-b1", "2027-06-20"),
                )
            val repo = LocalEntryRepository(dao, clock, accountB)

            val shown = repo.observeAll().first()

            assertEquals("B sees exactly its own row, never A's", listOf("mut-b1"), shown.map { it.clientMutationId })
        }

    // --- Behaviour 3: a different account's pending days are SET ASIDE. ------------------------------
    @Test
    fun aDifferentAccountsPendingDaysAreSetAside() =
        runTest {
            // A recorded two days offline; A's session expired; B signs in. A's days must be neither
            // sent under B nor shown to B - but they must still EXIST, kept until A signs back in.
            val dao =
                daoWith(
                    entry(accountA, "mut-a1", "2027-06-18"),
                    entry(accountA, "mut-a2", "2027-06-19"),
                )
            val poster = CapturingPoster()
            val repoAsB = LocalEntryRepository(dao, clock, accountB)

            SyncEngine(dao, poster, accountB).sync()
            val shownToB = repoAsB.observeAll().first()

            assertFalse("A's days are not sent under B", sent(poster).contains("mut-a1"))
            assertFalse("A's days are not sent under B", sent(poster).contains("mut-a2"))
            assertTrue("A's days are not shown to B", shownToB.isEmpty())
            assertEquals("A's days are KEPT, not deleted (R303: nothing is lost)", 2, dao.all().size)

            // ...and when A signs back in, A's set-aside days sync under A.
            val posterA = CapturingPoster()
            SyncEngine(dao, posterA, accountA).sync()
            val backToA = sent(posterA)
            assertTrue("A's day syncs under A on return", backToA.contains("mut-a1"))
            assertTrue("A's day syncs under A on return", backToA.contains("mut-a2"))
        }

    // --- UNOWNED is a behaviour, not a label: excluded from BOTH sync and display. -------------------
    @Test
    fun unownedRowsAreNeverSentOrShown() =
        runTest {
            val dao =
                daoWith(
                    entry(UNOWNED_ACCOUNT, "mut-unowned", "2027-06-17"),
                    entry(accountB, "mut-b1", "2027-06-20"),
                )
            val poster = CapturingPoster()
            val repoAsB = LocalEntryRepository(dao, clock, accountB)

            SyncEngine(dao, poster, accountB).sync()
            val shown = repoAsB.observeAll().first()

            assertFalse("an UNOWNED row is never sent", sent(poster).contains("mut-unowned"))
            assertTrue("B's own row is still sent", sent(poster).contains("mut-b1"))
            assertFalse("an UNOWNED row is never shown", shown.any { it.clientMutationId == "mut-unowned" })
        }
}
