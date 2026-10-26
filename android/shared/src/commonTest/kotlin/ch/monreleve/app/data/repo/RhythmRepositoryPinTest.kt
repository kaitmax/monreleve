package ch.monreleve.app.data.repo

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.data.local.RhythmKind
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.DayOfWeek
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * KMP-4 (R466). THE WEEKLY RHYTHM, PINNED ON THE CURRENT LocalRhythmRepository BEFORE IT MOVES.
 *
 * Nothing tested this repository before: RhythmMappingTest pins the weekday map and ForecastConformanceTest
 * the projection the shared forecast builds from it, but the store - which account a rhythm is saved under,
 * who sees it, what a sign-out does to the next save - had no test at all.
 *
 * AN-ACCOUNT-TAG (R423) changed this repository for the same reason it changed the entry repository: a
 * rhythm saved in the session the person signed in BY CODE was lost by the same captured value. Both
 * directions are pinned here, as AccountScopeTest pins them for the record (R196).
 *
 * WRITTEN TO CROSS UNEDITED. Every import is common Kotlin: kotlin.test, kotlinx.coroutines, and
 * kotlinx.datetime.DayOfWeek - a JVM TYPEALIAS of java.time.DayOfWeek in kotlinx-datetime 0.6.1, its own enum
 * since 0.7 (KMP-DT) - the very type WeeklyRhythm returns either way. The rhythm's kinds are compared by NAME, so the
 * EntryKind collapse (R465) cannot touch this file. It moves to :shared's commonTest by git mv with the
 * repository.
 */
class RhythmRepositoryPinTest {
    private val usual =
        WeeklyRhythm(
            monday = RhythmKind.SUISSE,
            tuesday = RhythmKind.DOMICILE,
            wednesday = RhythmKind.SUISSE,
            thursday = RhythmKind.DOMICILE,
            friday = RhythmKind.SUISSE,
        )

    @Test
    fun theRhythmProjectsEachWeekdayItCoversAndNothingElse() {
        assertEquals(
            mapOf(
                DayOfWeek.MONDAY to "CH",
                DayOfWeek.TUESDAY to "HOME",
                DayOfWeek.WEDNESDAY to "CH",
                DayOfWeek.THURSDAY to "HOME",
                DayOfWeek.FRIDAY to "CH",
            ),
            usual.toEntryKindMap().mapValues { it.value.name },
        )
        // A rhythm covering one day projects that day only; a weekday left unset is not a worked day.
        assertEquals(
            mapOf(DayOfWeek.WEDNESDAY to "HOME"),
            WeeklyRhythm(wednesday = RhythmKind.DOMICILE).toEntryKindMap().mapValues { it.value.name },
        )
    }

    @Test
    fun aRhythmSavedIsObservedBackUnderTheSameAccount() =
        runTest {
            val dao = FakeRhythmDao()
            val repository = LocalRhythmRepository(dao) { "acct-a" }

            repository.save(usual)

            assertEquals(usual, repository.observe().first())
            assertEquals("acct-a", dao.rows.values.single().accountTag, "stored under the account, nowhere else")
        }

    @Test
    fun anotherAccountSeesNoRhythmAndTheFirstIsKept() =
        runTest {
            val dao = FakeRhythmDao()
            LocalRhythmRepository(dao) { "acct-a" }.save(usual)

            val shownToB = LocalRhythmRepository(dao) { "acct-b" }.observe().first()

            assertTrue(shownToB.isEmpty, "B is never shown A's rhythm")
            assertEquals(usual, dao.forAccount("acct-a")?.toWeeklyRhythm(), "A's rhythm is kept, not dropped")
        }

    @Test
    fun aRhythmSavedAfterSigningInWithoutRestartLandsUnderThatAccount() =
        runTest {
            // Built while nobody is signed in - the cold start onto the sign-in screen - and kept.
            var signedInAs: String? = null
            val dao = FakeRhythmDao()
            val repository = LocalRhythmRepository(dao) { signedInAs }

            // A sign-in BY CODE sets the account in place: no activity restart.
            signedInAs = "acct-a"
            repository.save(usual)

            assertEquals(usual, dao.forAccount("acct-a")?.toWeeklyRhythm(), "saved under the account signed in now")
            assertNull(dao.forAccount(UNOWNED_ACCOUNT), "and never as UNOWNED")
        }

    @Test
    fun afterSigningOutASaveWritesNothingAndNothingIsShown() =
        runTest {
            var signedInAs: String? = "acct-a"
            val dao = FakeRhythmDao()
            val repository = LocalRhythmRepository(dao) { signedInAs }
            repository.save(usual)
            assertEquals(1, dao.rows.size, "positive control: the save made while signed in did write")

            signedInAs = null
            repository.save(WeeklyRhythm(monday = RhythmKind.DOMICILE))

            assertEquals(usual, dao.forAccount("acct-a")?.toWeeklyRhythm(), "the departed account's rhythm stands")
            assertNull(dao.forAccount(UNOWNED_ACCOUNT), "nothing is written UNOWNED (R303)")
            assertEquals(1, dao.rows.size)
            assertTrue(repository.observe().first().isEmpty, "with nobody signed in, nothing is shown")
        }

    @Test
    fun clearRemovesOnlyThisAccountsRhythm() =
        runTest {
            val dao = FakeRhythmDao()
            LocalRhythmRepository(dao) { "acct-a" }.save(usual)
            LocalRhythmRepository(dao) { "acct-b" }.save(WeeklyRhythm(friday = RhythmKind.DOMICILE))

            LocalRhythmRepository(dao) { null }.clear()
            assertEquals(2, dao.rows.size, "with nobody signed in, clear removes nothing")

            LocalRhythmRepository(dao) { "acct-a" }.clear()
            assertNull(dao.forAccount("acct-a"))
            assertEquals(WeeklyRhythm(friday = RhythmKind.DOMICILE), dao.forAccount("acct-b")?.toWeeklyRhythm())
        }
}
