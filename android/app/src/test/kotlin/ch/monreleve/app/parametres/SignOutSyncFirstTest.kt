package ch.monreleve.app.parametres

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-POLISH (R440). SIGN-OUT SENDS WHAT IT CAN BEFORE IT DISCARDS ANYTHING.
//
// KMP-2b found that signing out erases days not yet sent, with a warning and nothing else offered. A real
// user on a bad connection could lose a week of declarations with one tap, having been told so. Sign-out now
// attempts ONE bounded drain of this account's pending days first; what the dialog then says is what is LEFT.
//
// WHERE THE LOCAL TOKEN WIPE IS GUARANTEED, and why nothing here weakens it: the send runs inside
// requestSignOut's own coroutine, BEFORE the confirmation exists and long before confirmSignOut is reached.
// confirmSignOut is UNCHANGED - its revoke sits in a try whose finally wipes the store inside NonCancellable
// (KMP-1b/R387, and SignOutNotCancellableTest is that clause's own test). So a cancellation during the send
// cancels a coroutine that has revoked nothing and cleared nothing: there is no partial sign-out to leave
// behind, and the clause that makes the wipe uncancellable is untouched. cancelSignOut is unchanged too - it
// still only nulls the prompt.
//
// THE SESSION USED IS THE CURRENT ONE, BEFORE ANY REVOKE, because the drain happens first by construction.

private const val TAX_YEAR = 2026
private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "HALF_DAY", null)

private class FixedSettingsStore(private var current: Settings? = SETTINGS) : SettingsStore {
    override fun load(): Settings? = current

    override fun save(settings: Settings) {
        current = settings
    }

    override fun clear() {
        current = null
    }
}

private class SignOutNoopSaver : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
}

private class SpyStore : LocalStore {
    var signOutCleared = false

    override suspend fun clearForSignOut() {
        signOutCleared = true
    }

    override suspend fun clearForDeletion() = Unit
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignOutSyncFirstTest : FunSpec({

    /** A drain that settles the queue, the way a reachable server does: every PENDING row becomes SYNCED. */
    suspend fun settle(dao: FakeEntryDao) {
        dao.all().filter { it.syncState == SyncState.PENDING }.forEach {
            dao.upsert(it.copy(syncState = SyncState.SYNCED, serverId = "srv-${it.dayDate}-${it.portion}"))
        }
    }

    test("R440: sign-out sends the pending days first, and what reached the server is not in the warning") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            repo.record(RecordCommand(dayDate = "2026-03-02", kind = EntryKind.CH))
            var sends = 0
            val store = SpyStore()
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    localStore = store,
                    syncNow = {
                        sends += 1
                        settle(dao)
                    },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()

            // THE SEND HAPPENED, and happened ONCE. Before R440 this was zero: sign-out warned and wiped.
            sends shouldBe 1
            // ...so the confirmation has nothing to warn about, and is the plain one PARKAN-27 shipped.
            controller.state.value.signOutPrompt shouldBe SignOutPrompt(pendingDates = emptyList())
            controller.state.value.signOutSending.shouldBeFalse()

            controller.confirmSignOut()
            advanceUntilIdle()
            store.signOutCleared shouldBe true
        }
    }

    test("R440: offline, the warning names the days that could not be sent") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-02", kind = EntryKind.CH))
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            var sends = 0
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    // Offline THROWS rather than returning - an unresolved host is an exception, not a
                    // verdict - and a thrown send must still produce a dialog rather than an unhandled
                    // failure on the way out of the app.
                    syncNow = {
                        sends += 1
                        throw IOException("offline")
                    },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()

            sends shouldBe 1
            val prompt = controller.state.value.signOutPrompt
            // BOTH DATES, ASCENDING, and the count derived from them - never a count beside a list that can
            // disagree with it (R206). They were recorded out of order on purpose.
            prompt shouldBe SignOutPrompt(pendingDates = listOf("2026-03-01", "2026-03-02"))
            prompt?.unsyncedDays shouldBe 2
        }
    }

    test("R440: half-day writes two rows for one date, and the warning says ONE day and one date") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME, portion = Portion.AM))
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.CH, portion = Portion.PM))
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    syncNow = { throw IOException("offline") },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()

            // TWO PENDING ROWS, ONE DATE. Counting rows would have said « 2 journées » above a list holding
            // one date - a dialog contradicting itself in one breath, which is what naming the dates exposes.
            controller.state.value.signOutPrompt shouldBe SignOutPrompt(pendingDates = listOf("2026-03-01"))
            controller.state.value.signOutPrompt?.unsyncedDays shouldBe 1
        }
    }

    test("R440: cancelling after the warning changes nothing - nothing deleted, still signed in") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            var revoked = false
            val store = SpyStore()
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    revokeServer = { revoked = true },
                    localStore = store,
                    syncNow = { throw IOException("offline") },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()
            controller.state.value.signOutPrompt?.unsyncedDays shouldBe 1

            controller.cancelSignOut()
            advanceUntilIdle()

            controller.state.value.signOutPrompt shouldBe null
            revoked.shouldBeFalse()
            store.signOutCleared.shouldBeFalse()
            // The day is still on the phone, which is the whole point of cancelling.
            dao.all().single().syncState shouldBe SyncState.PENDING
        }
    }

    test("R440: a coroutine cancelled during the send leaves NO partial sign-out") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            val entered = CompletableDeferred<Unit>()
            val never = CompletableDeferred<Unit>()
            var revoked = false
            val store = SpyStore()
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    revokeServer = { revoked = true },
                    localStore = store,
                    syncNow = {
                        entered.complete(Unit)
                        never.await()
                    },
                )
            advanceUntilIdle()

            val job = launch { controller.requestSignOut() }
            entered.await()
            job.cancel()
            advanceUntilIdle()

            // The send is the FIRST thing sign-out does, so a cancellation during it cancels a coroutine
            // that has revoked nothing and cleared nothing. There is no half-done sign-out to leave behind,
            // and the uncancellable wipe in confirmSignOut (KMP-1b) was never reached.
            revoked.shouldBeFalse()
            store.signOutCleared.shouldBeFalse()
            dao.all().single().syncState shouldBe SyncState.PENDING
        }
    }

    test("R440: Réessayer sends again, and a send that succeeds clears the warning") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            var sends = 0
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    syncNow = {
                        sends += 1
                        if (sends == 1) throw IOException("offline") else settle(dao)
                    },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()
            controller.state.value.signOutPrompt?.unsyncedDays shouldBe 1

            controller.retrySignOutSync()
            advanceUntilIdle()

            sends shouldBe 2
            controller.state.value.signOutPrompt shouldBe SignOutPrompt(pendingDates = emptyList())
        }
    }

    test("R440: a day already on the server raises the plain confirmation and sends nothing") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-01", kind = EntryKind.HOME))
            settle(dao)
            var sends = 0
            val controller =
                ParametresController(
                    SignOutNoopSaver(),
                    FixedSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    syncNow = { sends += 1 },
                )
            advanceUntilIdle()

            controller.requestSignOut()
            advanceUntilIdle()

            // Nothing to send, so nothing is sent: a person with a settled record is not made to wait for a
            // round trip that has no work in it.
            sends shouldBe 0
            controller.state.value.signOutPrompt shouldBe SignOutPrompt(pendingDates = emptyList())
        }
    }
})
