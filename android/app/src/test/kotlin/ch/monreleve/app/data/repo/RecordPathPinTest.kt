package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/**
 * KMP-4 (R466). WHAT A TAP WRITES, PINNED ON THE CURRENT LocalEntryRepository BEFORE IT MOVES.
 *
 * The census of R466's behaviours found most of them ALREADY PINNED - the coalescing edit that keeps the
 * server's columns (EntryRepositoryTest), the final tap's claim on a coalesced edit (EntryRepositoryTest),
 * the account read at write time after a sign-in without restart and after a sign-out (AccountScopeTest),
 * R425's canary (AccountScopeTest), and Annuler writing nothing (CalendarBulkWriteTest,
 * CalendarSelectionTest). This file pins the GAPS: a full day with every column, each half as its own row,
 * every kind, an absence with its reason and note, a back-dated day, and an edit to one half.
 *
 * EVERY ASSERTION READS THE ROW THAT REACHED THE DAO, not only the object record() returned (R133): a
 * repository that computed the right row and stored another would pass on the return value alone.
 *
 * THE DEVICE IS IN CASABLANCA, not Paris, so the claim's +01:00 is the device's own offset and cannot be
 * mistaken for the Paris day's. In June Casablanca is +01:00 (its 2026 Ramadan shift ends on 22 March).
 *
 * After the move these run UNEDITED against the shared repository, built through :app's construction site.
 */
class RecordPathPinTest {
    private val account = "acct-pin-tag"

    // One counter per test (JUnit makes a fresh instance for each), shared by every repository the test
    // builds, so two repositories in one test can never mint the same id by accident.
    private var minted = 0

    private fun deviceIn(
        instant: String,
        zone: String = "Africa/Casablanca",
    ): Clock = Clock.fixed(Instant.parse(instant), ZoneId.of(zone))

    private fun repositoryAt(
        dao: FakeEntryDao,
        clock: Clock,
    ): LocalEntryRepository =
        LocalEntryRepository(dao, clock, currentAccount = { account }, newMutationId = { "mut-${++minted}" })

    private suspend fun stored(
        dao: FakeEntryDao,
        day: String,
        portion: Portion,
    ): EntryEntity? = dao.byAccountDayPortion(account, day, portion)

    @Test
    fun aFullDayIsOneRowCarryingEveryColumnTheTapWrites() =
        runTest {
            val dao = FakeEntryDao()
            val repository = repositoryAt(dao, deviceIn("2026-06-15T10:00:00Z"))

            val returned = repository.record(RecordCommand(dayDate = "2026-06-15", kind = EntryKind.CH))

            val expected =
                EntryEntity(
                    clientMutationId = "mut-1",
                    dayDate = "2026-06-15",
                    portion = Portion.FULL,
                    kind = EntryKind.CH,
                    absenceReason = null,
                    note = null,
                    provenance = Provenance.MANUAL,
                    detectedKind = null,
                    detectedAt = null,
                    clientClaimedAt = "2026-06-15T11:00:00.000+01:00",
                    serverId = null,
                    firstRecordedAt = null,
                    lastModifiedAt = null,
                    syncState = SyncState.PENDING,
                    accountTag = account,
                )
            assertEquals(expected, stored(dao, "2026-06-15", Portion.FULL), "the row that reached the dao")
            assertEquals(expected, returned, "and the row record() returned")
            assertEquals(1, dao.rows.size, "one tap, one row")
        }

    @Test
    fun eachHalfIsItsOwnRowAndNeitherReplacesTheOther() =
        runTest {
            val dao = FakeEntryDao()
            val repository = repositoryAt(dao, deviceIn("2026-06-16T16:00:00Z"))

            repository.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.CH, portion = Portion.AM))
            repository.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.HOME, portion = Portion.PM))

            assertEquals(2, dao.rows.size, "a morning and an afternoon are two rows")
            assertEquals(EntryKind.CH, stored(dao, "2026-06-16", Portion.AM)?.kind)
            assertEquals(EntryKind.HOME, stored(dao, "2026-06-16", Portion.PM)?.kind)
            assertEquals("mut-1", stored(dao, "2026-06-16", Portion.AM)?.clientMutationId)
            assertEquals("mut-2", stored(dao, "2026-06-16", Portion.PM)?.clientMutationId)
            assertEquals(null, stored(dao, "2026-06-16", Portion.FULL), "two halves never become a FULL row")
        }

    @Test
    fun everyKindIsStoredAsItself() =
        runTest {
            val dao = FakeEntryDao()
            val repository = repositoryAt(dao, deviceIn("2026-06-22T10:00:00Z"))

            repository.record(RecordCommand(dayDate = "2026-06-15", kind = EntryKind.CH))
            repository.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.HOME))
            repository.record(RecordCommand(dayDate = "2026-06-17", kind = EntryKind.MISSION_FR))
            repository.record(RecordCommand(dayDate = "2026-06-18", kind = EntryKind.MISSION_THIRD))
            repository.record(
                RecordCommand(dayDate = "2026-06-19", kind = EntryKind.ABSENT, absenceReason = AbsenceReason.MALADIE),
            )

            assertEquals(EntryKind.CH, stored(dao, "2026-06-15", Portion.FULL)?.kind)
            assertEquals(EntryKind.HOME, stored(dao, "2026-06-16", Portion.FULL)?.kind)
            assertEquals(EntryKind.MISSION_FR, stored(dao, "2026-06-17", Portion.FULL)?.kind)
            assertEquals(EntryKind.MISSION_THIRD, stored(dao, "2026-06-18", Portion.FULL)?.kind)
            assertEquals(EntryKind.ABSENT, stored(dao, "2026-06-19", Portion.FULL)?.kind)
            assertEquals(5, dao.rows.size)
        }

    @Test
    fun anAbsenceKeepsItsReasonAndItsNoteVerbatim() =
        runTest {
            val dao = FakeEntryDao()
            val repository = repositoryAt(dao, deviceIn("2026-06-19T08:00:00Z"))
            val note = "Congé posé à l’avance - retour lundi"

            repository.record(
                RecordCommand(
                    dayDate = "2026-06-19",
                    kind = EntryKind.ABSENT,
                    absenceReason = AbsenceReason.CONGE,
                    note = note,
                ),
            )

            val row = stored(dao, "2026-06-19", Portion.FULL)
            assertEquals(AbsenceReason.CONGE, row?.absenceReason)
            assertEquals(note, row?.note, "the note is stored as typed, accents and apostrophe included")
            assertEquals(SyncState.PENDING, row?.syncState)
        }

    @Test
    fun aLateEntryKeepsItsOwnDayAndTheTapsClaim() =
        runTest {
            // Recorded on 24 June for 15 June: nine days on. The DAY is the one the person names; the CLAIM is
            // when the tap happened. The client computes no lateness - the server judges it from its own
            // firstRecordedAt (R216) - so there is nothing else for the row to carry.
            val dao = FakeEntryDao()
            val repository = repositoryAt(dao, deviceIn("2026-06-24T10:00:00Z"))

            repository.record(RecordCommand(dayDate = "2026-06-15", kind = EntryKind.HOME))

            val row = stored(dao, "2026-06-15", Portion.FULL)
            assertEquals("2026-06-15", row?.dayDate)
            assertEquals("2026-06-24T11:00:00.000+01:00", row?.clientClaimedAt)
            assertEquals(null, row?.firstRecordedAt, "the evidence moment is the server's to set")
            assertEquals(SyncState.PENDING, row?.syncState)
        }

    @Test
    fun modifyingOneHalfLeavesTheOtherHalfUntouched() =
        runTest {
            val dao = FakeEntryDao()
            val morning = repositoryAt(dao, deviceIn("2026-06-16T07:00:00Z"))
            morning.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.CH, portion = Portion.AM))
            morning.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.HOME, portion = Portion.PM))
            val morningBefore = stored(dao, "2026-06-16", Portion.AM)
            val afternoonBefore = stored(dao, "2026-06-16", Portion.PM)

            // That evening the morning is corrected to a mission in France.
            val evening = repositoryAt(dao, deviceIn("2026-06-16T18:00:00Z"))
            evening.record(RecordCommand(dayDate = "2026-06-16", kind = EntryKind.MISSION_FR, portion = Portion.AM))

            val morningAfter = stored(dao, "2026-06-16", Portion.AM)
            assertEquals(EntryKind.MISSION_FR, morningAfter?.kind)
            assertEquals("2026-06-16T19:00:00.000+01:00", morningAfter?.clientClaimedAt, "the correcting tap's time")
            assertNotEquals(morningBefore?.clientMutationId, morningAfter?.clientMutationId, "a new mutation")
            assertEquals(afternoonBefore, stored(dao, "2026-06-16", Portion.PM), "the afternoon is byte-identical")
            assertEquals(2, dao.rows.size)
        }
}
