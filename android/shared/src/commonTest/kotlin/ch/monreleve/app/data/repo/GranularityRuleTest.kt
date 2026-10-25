package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.ACCOUNT_A
import ch.monreleve.app.data.sync.ACCOUNT_B
import ch.monreleve.app.data.sync.InMemoryEntryDao
import ch.monreleve.app.data.sync.localRow
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// AN-GRANULARITY (R490, R492, R494). THE RULE, IN THE RECORD PATH, IN commonTest - iOS inherits it the day it builds.
//
// Two halves. The PURE RULE (DayGranularity.kt) the screens read to decide what to offer; and the REPOSITORY'S
// REFUSAL, driven through the real LocalEntryRepository over the commonTest in-memory DAO (DownloadRig.kt's - PARK-Y1's
// second fake, reused rather than a third). Every refusal asserts that NOTHING was written (the DAO's write counter)
// AND that the same repository still writes the legitimate edit - so a repository that refused everything would fail.

private const val DAY = "2026-06-10"

private val FIXED: Clock =
    object : Clock {
        override fun now(): Instant = Instant.parse("2026-06-15T10:00:00Z")
    }

private fun repositoryOver(dao: InMemoryEntryDao): LocalEntryRepository {
    var minted = 0
    return LocalEntryRepository(
        dao = dao,
        clock = FIXED,
        deviceZone = TimeZone.of("Europe/Paris"),
        currentAccount = { ACCOUNT_A },
        reportUnownedWhileSignedIn = { complaint -> error(complaint) },
        newMutationId = { "granularity-${++minted}" },
    )
}

private fun held(vararg portions: Portion): InMemoryEntryDao =
    InMemoryEntryDao().apply {
        seed(*portions.map { localRow(DAY, it, EntryKind.HOME, SyncState.SYNCED) }.toTypedArray())
    }

private fun write(
    portion: Portion,
    kind: EntryKind = EntryKind.CH,
) = RecordCommand(dayDate = DAY, kind = kind, portion = portion)

private val WHOLE = DayGranularity.WHOLE_DAY
private val HALVES = DayGranularity.HALF_DAYS
private val FULL = Portion.FULL
private val AM = Portion.AM
private val PM = Portion.PM

class GranularityRuleTest {
    // ---------------------------------------------------------------------------------------------------------------
    // The pure rule the screens read (R490).
    // ---------------------------------------------------------------------------------------------------------------

    @Test
    fun theSettingIsReadOnceAsADayGranularity() {
        fun settings(granularity: String) = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)
        assertEquals(HALVES, dayGranularityOf(settings("HALF_DAY")))
        assertEquals(WHOLE, dayGranularityOf(settings("DAY")))
        // No settings yet (before onboarding) asks for whole days, as every screen always has.
        assertEquals(WHOLE, dayGranularityOf(null))
    }

    @Test
    fun aDaysRowsSayWhichGranularityItHas() {
        assertEquals(HeldGranularity.NONE, heldGranularity(emptyList()))
        assertEquals(HeldGranularity.WHOLE_DAY, heldGranularity(listOf(FULL)))
        assertEquals(HeldGranularity.HALF_DAYS, heldGranularity(listOf(AM)))
        assertEquals(HeldGranularity.HALF_DAYS, heldGranularity(listOf(PM)))
        assertEquals(HeldGranularity.HALF_DAYS, heldGranularity(listOf(AM, PM)))
        assertEquals(HeldGranularity.MIXED, heldGranularity(listOf(FULL, AM)))
        assertEquals(HeldGranularity.MIXED, heldGranularity(listOf(FULL, AM, PM)))
    }

    @Test
    fun anEmptyDayIsAskedForInTheSettingsGranularity() {
        assertEquals(listOf(FULL), portionsToOffer(emptyList(), WHOLE))
        assertEquals(listOf(AM, PM), portionsToOffer(emptyList(), HALVES))
    }

    @Test
    fun aDayHeldWholeInHalfDayModeOffersOneWholeDayChoice() {
        // R490: never half-day controls that quietly write FULL.
        assertEquals(listOf(FULL), portionsToOffer(listOf(FULL), HALVES))
        assertEquals(WHOLE, recordedInOtherGranularity(listOf(FULL), HALVES))
    }

    @Test
    fun aDayHeldInHalvesInWholeDayModeKeepsHalfDayEditing() {
        // R490's mirror (PARK-C1, closed by this ruling): never a FULL row added beside them.
        assertEquals(listOf(AM, PM), portionsToOffer(listOf(AM, PM), WHOLE))
        assertEquals(listOf(AM, PM), portionsToOffer(listOf(AM), WHOLE))
        assertEquals(HALVES, recordedInOtherGranularity(listOf(AM, PM), WHOLE))
    }

    @Test
    fun noNoticeWhenTheDayAndTheSettingAgreeOrTheDayIsEmptyOrMixed() {
        // Positive control first: the notice's condition does fire where the two differ - so the nulls below are
        // the rule's answer, not a function that answers null to everything.
        assertEquals(HALVES, recordedInOtherGranularity(listOf(PM), WHOLE))
        assertNull(recordedInOtherGranularity(listOf(FULL), WHOLE))
        assertNull(recordedInOtherGranularity(listOf(AM, PM), HALVES))
        assertNull(recordedInOtherGranularity(emptyList(), HALVES))
        assertNull(recordedInOtherGranularity(listOf(FULL, PM), HALVES))
    }

    @Test
    fun aMixedDayIsOfferedExactlyTheRowsItHolds() {
        // R494: each existing row can be edited, none can be added - whatever the setting.
        assertEquals(listOf(FULL, AM), portionsToOffer(listOf(AM, FULL), HALVES))
        assertEquals(listOf(FULL, PM), portionsToOffer(listOf(FULL, PM), WHOLE))
        assertEquals(listOf(FULL, AM, PM), portionsToOffer(listOf(PM, AM, FULL), WHOLE))
    }

    @Test
    fun wouldMixTellsAnAddFromAnEdit() {
        assertTrue(wouldMixGranularity(AM, listOf(FULL)), "a half beside a day held whole")
        assertTrue(wouldMixGranularity(FULL, listOf(AM, PM)), "a whole day beside its halves")
        assertTrue(wouldMixGranularity(FULL, listOf(PM)), "a whole day beside one half")
        assertTrue(wouldMixGranularity(PM, listOf(FULL, AM)), "a row added to a day already mixed (R494)")
        assertFalse(wouldMixGranularity(PM, listOf(AM)), "the other half of a day in halves")
        assertFalse(wouldMixGranularity(FULL, listOf(FULL)), "an edit of a whole day")
        assertFalse(wouldMixGranularity(FULL, listOf(FULL, AM)), "an edit of a mixed day's whole-day row (R494)")
        assertFalse(wouldMixGranularity(AM, listOf(FULL, AM)), "an edit of a mixed day's half (R494)")
        assertFalse(wouldMixGranularity(FULL, emptyList()), "a first write, whole")
        assertFalse(wouldMixGranularity(AM, emptyList()), "a first write, half")
    }

    @Test
    fun aScreenBuiltFromTheRuleNeverReachesTheRefusal() {
        // Every day shape x both settings: nothing the rule offers is something the repository would refuse.
        val clean = listOf(emptyList(), listOf(FULL), listOf(AM), listOf(PM), listOf(AM, PM))
        val mixed = listOf(listOf(FULL, AM), listOf(FULL, PM), listOf(FULL, AM, PM))
        val shapes = clean + mixed
        var checked = 0
        for (shape in shapes) {
            for (setting in DayGranularity.entries) {
                for (offered in portionsToOffer(shape, setting)) {
                    assertFalse(wouldMixGranularity(offered, shape), "$offered offered for $shape under $setting")
                    checked++
                }
            }
        }
        // Positive control: the loop looked at every offer - per shape, WHOLE then HALF_DAYS:
        // [] 1+2, [FULL] 1+1, [AM] 2+2, [PM] 2+2, [AM,PM] 2+2, [FULL,AM] 2+2, [FULL,PM] 2+2, [FULL,AM,PM] 3+3.
        assertEquals(31, checked)
    }

    // ---------------------------------------------------------------------------------------------------------------
    // The repository's refusal (R492), through the real LocalEntryRepository.
    // ---------------------------------------------------------------------------------------------------------------

    @Test
    fun aHalfBesideADayHeldWholeIsRefusedTypedAndWritesNothing() =
        runTest {
            val dao = held(FULL)
            val before = dao.rows.toMap()
            val repository = repositoryOver(dao)

            val result = repository.record(write(AM))

            assertEquals(RecordResult.MixedGranularityRefused(DAY, AM, listOf(FULL)), result)
            assertEquals(0, dao.upserts, "a refusal writes nothing")
            assertEquals(before, dao.rows.toMap())
            // Positive control: the same repository writes the edit the screens offer - the whole day itself.
            assertIs<RecordResult.Recorded>(repository.record(write(FULL)))
            assertEquals(1, dao.upserts)
        }

    @Test
    fun aWholeDayBesideItsHalvesIsRefused() =
        runTest {
            val dao = held(AM, PM)
            val repository = repositoryOver(dao)

            val result = repository.record(write(FULL))

            assertEquals(RecordResult.MixedGranularityRefused(DAY, FULL, listOf(AM, PM)), result)
            assertEquals(0, dao.upserts)
            assertIs<RecordResult.Recorded>(repository.record(write(PM)))
            assertEquals(1, dao.upserts)
        }

    @Test
    fun theSecondHalfOfADayInHalvesIsWritten() =
        runTest {
            val dao = held(AM)

            val result = repositoryOver(dao).record(write(PM))

            assertEquals(PM, assertIs<RecordResult.Recorded>(result).entry.portion)
            assertEquals(listOf(AM, PM), dao.rows.values.map { it.portion })
        }

    @Test
    fun aMixedDaysRowsCanBeEditedButNothingAdded() =
        runTest {
            // R494: a day already mixed (test data, or a day AN-PULL brought down) is neither repaired nor grown.
            val dao = held(FULL, AM)
            val repository = repositoryOver(dao)

            assertIs<RecordResult.Recorded>(repository.record(write(FULL, EntryKind.CH)))
            assertIs<RecordResult.Recorded>(repository.record(write(AM, EntryKind.MISSION_FR)))
            assertEquals(
                RecordResult.MixedGranularityRefused(DAY, PM, listOf(FULL, AM)),
                repository.record(write(PM)),
            )

            assertEquals(2, dao.upserts)
            assertEquals(listOf(FULL, AM), dao.rows.values.map { it.portion }, "nothing deleted, nothing added")
            assertEquals(listOf(EntryKind.CH, EntryKind.MISSION_FR), dao.rows.values.map { it.kind })
        }

    @Test
    fun anEmptyDayAcceptsEitherGranularityForItsFirstWrite() =
        runTest {
            val dao = InMemoryEntryDao()
            val repository = repositoryOver(dao)

            assertIs<RecordResult.Recorded>(repository.record(write(FULL)))
            assertIs<RecordResult.Recorded>(repository.record(write(AM).copy(dayDate = "2026-06-11")))
            assertEquals(2, dao.upserts)
        }

    @Test
    fun theRefusalReadsOnlyTheSignedInAccountsDay() =
        runTest {
            // Another account's whole day on the same date is not this account's day (R303: the account is in the key).
            val dao =
                InMemoryEntryDao().apply {
                    seed(localRow(DAY, FULL, EntryKind.HOME, SyncState.SYNCED, account = ACCOUNT_B))
                }

            assertIs<RecordResult.Recorded>(repositoryOver(dao).record(write(AM)))
            assertTrue(dao.readTags.isNotEmpty(), "positive control: the repository read the day")
            assertTrue(dao.readTags.all { it == ACCOUNT_A }, "every read named the signed-in account: ${dao.readTags}")
        }
}
