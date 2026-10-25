package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * AN5 increment 2. The mutation queue's contract:
 *   - the clientMutationId is a UUID minted at the tap, different every time;
 *   - clientClaimedAt is the device's clock at the tap, in a format the server accepts;
 *   - the mutation is persisted PENDING before record() returns (there is no network);
 *   - a re-record of a day coalesces onto one row, mints a NEW id, and keeps the
 *     server-assigned columns that only the server can set.
 */
class EntryRepositoryTest {
    private val parisNoon = Clock.fixed(Instant.parse("2027-06-18T10:00:00Z"), ZoneId.of("Europe/Paris"))

    @Test
    fun eachTapMintsADistinctUuid() =
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, parisNoon)

            val first = repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME)).written()
            val second = repo.record(RecordCommand(dayDate = "2027-06-19", kind = EntryKind.CH)).written()

            // Each parses as a UUID, and the two differ - an id reused across taps would
            // let the server dedup a genuine second day away (D30).
            UUID.fromString(first.clientMutationId)
            UUID.fromString(second.clientMutationId)
            assertNotEquals(first.clientMutationId, second.clientMutationId)
        }

    @Test
    fun clientClaimedAtIsTheDeviceClockAtTheTap() =
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, parisNoon)

            val entry = repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME)).written()

            // 10:00 UTC is 12:00 in Paris in June (+02:00), stamped verbatim with an offset.
            assertEquals("2027-06-18T12:00:00.000+02:00", entry.clientClaimedAt)
        }

    @Test
    fun clientClaimedAtIsInTheFormatTheServerAccepts() =
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, parisNoon)

            val entry = repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME)).written()

            // zod .datetime({ offset: true }): seconds are required and an offset (Z or
            // +-HH:MM) must be present. The claim carries both, always.
            val offsetInstant = Regex("""^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}([+-]\d{2}:\d{2}|Z)$""")
            assertTrue(
                "clientClaimedAt '${entry.clientClaimedAt}' must be an ISO instant with offset",
                offsetInstant.matches(entry.clientClaimedAt!!),
            )
        }

    @Test
    fun aRecordIsPersistedPendingWithNoServerColumns() =
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, parisNoon)

            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME))

            val stored = dao.byDayPortion("2027-06-18", Portion.FULL)!!
            assertEquals(SyncState.PENDING, stored.syncState)
            assertNull("the server has not assigned an id yet", stored.serverId)
            assertNull("firstRecordedAt is the server's to set", stored.firstRecordedAt)
            assertNull(stored.lastModifiedAt)
        }

    @Test
    fun editingASyncedDayCoalescesKeepsFirstRecordedAtAndMintsANewId() =
        runTest {
            val dao = FakeEntryDao()
            var counter = 0
            val repo = LocalEntryRepository(dao, parisNoon, newMutationId = { "mut-${counter++}" })

            // A day already synced: the server assigned its id and immutable firstRecordedAt.
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME))
            val synced =
                dao.byDayPortion("2027-06-18", Portion.FULL)!!.copy(
                    serverId = "srv-1",
                    firstRecordedAt = "2027-06-18T12:00:05.000Z",
                    syncState = SyncState.SYNCED,
                )
            dao.upsert(synced)

            // The reader corrects the day that evening.
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.CH))

            val edited = dao.byDayPortion("2027-06-18", Portion.FULL)!!
            assertEquals("one row per (dayDate, portion) - coalesced, not duplicated", 1, dao.rows.size)
            assertEquals("the edit's new value", EntryKind.CH, edited.kind)
            assertNotEquals("an edit is a new mutation", "mut-0", edited.clientMutationId)
            assertEquals(
                "the immutable evidence moment survives the edit",
                "2027-06-18T12:00:05.000Z",
                edited.firstRecordedAt,
            )
            assertEquals("the server id survives the edit", "srv-1", edited.serverId)
            assertEquals("the edit is pending again, to be drained", SyncState.PENDING, edited.syncState)
        }

    @Test
    fun aCoalescedEditCarriesTheFinalTapsClaimTime() =
        runTest {
            val dao = FakeEntryDao()
            val morning = Clock.fixed(Instant.parse("2027-06-18T07:00:00Z"), ZoneId.of("Europe/Paris"))
            val evening = Clock.fixed(Instant.parse("2027-06-18T15:00:00Z"), ZoneId.of("Europe/Paris"))

            // Recorded HOME in the morning, corrected to CH that evening - both offline, so
            // they coalesce onto one (dayDate, portion) row (R275).
            LocalEntryRepository(dao, morning).record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME))
            LocalEntryRepository(dao, evening).record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.CH))

            val row = dao.byDayPortion("2027-06-18", Portion.FULL)!!
            assertEquals("the coalesced row holds the edit's value", EntryKind.CH, row.kind)
            // R275: clientClaimedAt describes the value it is attached to. The coalesced
            // mutation carries the EVENING tap (when CH was chosen, Paris +02:00 = 17:00),
            // never the morning one - claiming CH was recorded at 09:00 when it was HOME
            // then would be a false claim the evidence model refuses.
            assertEquals("2027-06-18T17:00:00.000+02:00", row.clientClaimedAt)
            assertNotEquals(
                "the original tap's time must not carry forward",
                "2027-06-18T09:00:00.000+02:00",
                row.clientClaimedAt,
            )
        }
}
