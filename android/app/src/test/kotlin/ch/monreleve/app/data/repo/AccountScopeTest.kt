package ch.monreleve.app.data.repo

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MemoryDossierCache
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

            SyncEngine(dao, poster, accountB, MemoryDossierCache()).sync()

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
            val repo = LocalEntryRepository(dao, clock, currentAccount = { accountB })

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
            val repoAsB = LocalEntryRepository(dao, clock, currentAccount = { accountB })

            SyncEngine(dao, poster, accountB, MemoryDossierCache()).sync()
            val shownToB = repoAsB.observeAll().first()

            assertFalse("A's days are not sent under B", sent(poster).contains("mut-a1"))
            assertFalse("A's days are not sent under B", sent(poster).contains("mut-a2"))
            assertTrue("A's days are not shown to B", shownToB.isEmpty())
            assertEquals("A's days are KEPT, not deleted (R303: nothing is lost)", 2, dao.all().size)

            // ...and when A signs back in, A's set-aside days sync under A.
            val posterA = CapturingPoster()
            SyncEngine(dao, posterA, accountA, MemoryDossierCache()).sync()
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
            val repoAsB = LocalEntryRepository(dao, clock, currentAccount = { accountB })

            SyncEngine(dao, poster, accountB, MemoryDossierCache()).sync()
            val shown = repoAsB.observeAll().first()

            assertFalse("an UNOWNED row is never sent", sent(poster).contains("mut-unowned"))
            assertTrue("B's own row is still sent", sent(poster).contains("mut-b1"))
            assertFalse("an UNOWNED row is never shown", shown.any { it.clientMutationId == "mut-unowned" })
        }

    // ==============================================================================================
    // AN-ACCOUNT-TAG (R423). THE TAG IS READ WHEN THE ROW IS WRITTEN, NOT WHEN THE SCREEN IS BUILT.
    // ==============================================================================================
    //
    // KMP-2b found days silently lost. Sign in BY CODE, record today, relaunch: the day is gone and
    // never reached the server. Two rows for the same day, read off the S9's own database, differ
    // only in WHEN they were recorded:
    //
    //   2026-10-20 AM HOME PENDING UNOWNED                        <- recorded in the sign-in session
    //   2026-10-20 AM HOME SYNCED  f476664646ba633c0c8323398f...  <- recorded after a relaunch
    //
    // THE MECHANISM. MainActivity composes the repository with accountStore.current() - a String read
    // ONCE - and MainActivity is also what hosts the sign-in screen, so at that moment it is null.
    // CodeController sets the account correctly when the code is accepted, but the repository already
    // holds the stale null and every write in that session falls back to UNOWNED.
    //
    // EVERY COMPONENT DOWNSTREAM IS INNOCENT, which is why the loss is silent: R303 says an
    // unresolved row is HELD - never sent, never shown - and EntryDao, SyncEngine and SyncWorker all
    // honour that exactly. The defect is upstream of them, in what the row was tagged with.
    //
    // THE LINE'S OWN COMMENT IS THE DEFECT'S JUSTIFICATION, and it is true of only one sign-in path:
    //   "A new account signs in through CallbackActivity, which restarts this activity, so onCreate
    //    re-reads the current tag"
    // That holds for the magic LINK, which does restart the activity. Signing in by CODE does not.
    //
    // SIGNING IN IS EXACTLY THE EVENT THAT CHANGES THE ANSWER, so the same question asked twice in
    // one app session must be allowed to give two answers. That is what these assert.

    @Test
    fun `a day recorded after signing in carries the account, not UNOWNED`() =
        runTest {
            // Nobody is signed in when the screen is built - the ordinary cold start onto the
            // sign-in screen.
            var signedInAs: String? = null
            val dao = FakeEntryDao()
            val repository = LocalEntryRepository(dao, clock, currentAccount = { signedInAs })

            // The user signs in BY CODE. CodeController sets the account; no activity restart.
            signedInAs = accountA

            val row = repository.record(RecordCommand(dayDate = "2027-06-20", kind = EntryKind.HOME)).written()

            assertEquals(
                "a day recorded after a code sign-in must carry that account, not UNOWNED - an " +
                    "UNOWNED row is held forever: never shown, never sent, and lost at the next launch",
                accountA,
                row.accountTag,
            )
        }

    @Test
    fun `the row reaching the dao carries it too, not only the returned object`() =
        runTest {
            // R133: asserting the RETURN VALUE alone would pass on a repository that computed the
            // right tag and stored the wrong one. What matters is the row that lands in the table,
            // because that is what the drain and the screens read.
            var signedInAs: String? = null
            val dao = FakeEntryDao()
            val repository = LocalEntryRepository(dao, clock, currentAccount = { signedInAs })

            signedInAs = accountA
            repository.record(RecordCommand(dayDate = "2027-06-20", kind = EntryKind.HOME))

            val stored = dao.observeAllForAccount(accountA).first()

            assertEquals("the stored row must be visible under the account that recorded it", 1, stored.size)
            assertEquals(accountA, stored.single().accountTag)
        }

    @Test
    fun `signing out mid-session stops tagging new rows with the old account`() =
        runTest {
            // THE OTHER DIRECTION, and it is the half that keeps R303 honest (R196). A provider that
            // only ever went null -> tag would pass the two above while still handing the previous
            // person's tag to a row recorded after they signed out.
            var signedInAs: String? = accountA
            val dao = FakeEntryDao()
            val repository = LocalEntryRepository(dao, clock, currentAccount = { signedInAs })

            signedInAs = null

            val row = repository.record(RecordCommand(dayDate = "2027-06-20", kind = EntryKind.HOME)).written()

            assertEquals(
                "after a sign-out the fail-closed tag is correct - R303 is untouched by this fix",
                UNOWNED_ACCOUNT,
                row.accountTag,
            )
        }

    @Test
    fun `an unresolved tag while a session exists is refused, not written quietly (R425)`() =
        runTest {
            // THE CANARY. A provider frozen at composition (the defect) alongside a store that says
            // somebody IS signed in - exactly the disagreement that lost days. Unit tests run with
            // BuildConfig.DEBUG true, so this must CRASH rather than return a row.
            val dao = FakeEntryDao()
            val repository =
                LocalEntryRepository(
                    dao,
                    clock,
                    currentAccount = { null },
                    isSignedIn = { true },
                )

            var threw = false
            try {
                repository.record(RecordCommand(dayDate = "2027-06-20", kind = EntryKind.HOME))
            } catch (expected: IllegalStateException) {
                threw = true
            }

            assertTrue("an unresolved tag while signed in must fail loudly, not write UNOWNED", threw)
            assertTrue("and nothing may be stored", dao.observeAllForAccount(UNOWNED_ACCOUNT).first().isEmpty())
        }

    @Test
    fun `R303 is untouched when genuinely nobody is signed in`() =
        runTest {
            // The case R303 exists for: no session at all. Silent, fail-closed, UNOWNED - unchanged.
            val dao = FakeEntryDao()
            val repository = LocalEntryRepository(dao, clock, currentAccount = { null }, isSignedIn = { false })

            val row = repository.record(RecordCommand(dayDate = "2027-06-20", kind = EntryKind.HOME)).written()

            assertEquals(UNOWNED_ACCOUNT, row.accountTag)
        }
}
