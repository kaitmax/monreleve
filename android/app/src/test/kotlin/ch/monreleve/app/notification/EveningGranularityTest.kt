package ch.monreleve.app.notification

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.written
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-GRANULARITY-DRIVE (R576, closing PARK-W2). THE EVENING NOTIFICATION FOLLOWS THE SETTING - asserted on what it
// WRITES, through the receiver's own write (recordEveningTap) over the real repository, not on what it decides.
//
// The notification is just another writer, so R490 holds for it: an empty day takes the setting's granularity -
// half-day mode writes a morning and an afternoon, whole-day mode one FULL row - and a day already held keeps its own,
// through R492's record path, never beside it. REPORT-AN-GRANULARITY's R491 found it writing one FULL row whatever
// the setting.
//
// BOTH DIRECTIONS (R245's shape): whole-day mode must still write its FULL row, so a writer that stopped writing at all
// cannot pass; and every "nothing written" below reads the stored rows back, so an empty store cannot pass either.

private const val ACCOUNT = "acct-A"

/** A Tuesday, in Paris - the day the notification was shown for and the day it still is. */
private const val TODAY = "2026-10-06"
private const val CLAIM = "2026-10-06T18:30:00+02:00"
private val EVENING: Clock = Clock.fixed(Instant.parse("2026-10-06T16:30:00Z"), ZoneId.of("Europe/Paris"))
private val AT_THE_TAP = TapMoment(currentAccount = ACCOUNT, today = TODAY, claimNow = CLAIM)

/** The person's settings as the receiver reads them at the tap: only the granularity matters here. */
private class GranularitySetting(private val value: String) : SettingsStore {
    override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, value, null)

    override fun save(settings: Settings) = Unit

    override fun clear() = Unit
}

private val WHOLE_DAYS: SettingsStore = GranularitySetting("DAY")
private val HALF_DAYS: SettingsStore = GranularitySetting("HALF_DAY")

private fun manualTap(kind: EntryKind) =
    EveningTap(
        shownForDay = TODAY,
        shownForAccount = ACCOUNT,
        kind = kind,
        provenance = Provenance.MANUAL,
        detectedKind = null,
    )

private fun confirmTap(proposed: EntryKind) =
    EveningTap(
        shownForDay = TODAY,
        shownForAccount = ACCOUNT,
        kind = proposed,
        provenance = Provenance.DETECTED_CONFIRMED,
        detectedKind = proposed,
    )

/** One device: its DAO and the account's repository, built the way EveningActionReceiver builds it. */
private class Device {
    val dao = FakeEntryDao()
    val repository = LocalEntryRepository(dao, EVENING, currentAccount = { ACCOUNT })

    /** Rows recorded for [TODAY] by another writer (the app, the calendar) - [portions] each of [kind]. */
    suspend fun holding(
        kind: EntryKind,
        vararg portions: Portion,
    ): Device =
        apply {
            portions.forEach { repository.record(RecordCommand(dayDate = TODAY, kind = kind, portion = it)).written() }
        }

    /**
     * The notification's button tapped: the receiver reads the device's rows, then writes - exactly its order. A
     * test that records a row between the two passes what the receiver read as [readByTheReceiver].
     */
    suspend fun tap(
        tap: EveningTap,
        settings: SettingsStore,
        readByTheReceiver: List<EntryEntity>? = null,
    ): EveningWrite = recordEveningTap(tap, AT_THE_TAP, readByTheReceiver ?: dao.all(), settings, repository)

    /** What the store holds for [TODAY], as (portion, kind). */
    suspend fun today(): List<Pair<Portion, EntryKind>> =
        dao.all().filter { it.dayDate == TODAY }.map { it.portion to it.kind }
}

class EveningGranularityTest : FunSpec({
    test("R576 - half-day mode: an empty day is written as a morning and an afternoon of the kind tapped") {
        val device = Device()

        val write = device.tap(manualTap(EntryKind.CH), HALF_DAYS)

        device.today() shouldBe listOf(Portion.AM to EntryKind.CH, Portion.PM to EntryKind.CH)
        // Each half is the whole tap - a manual record, the account's own, waiting to be sent - and the confirmation
        // the glue posts names the kind and the day it was shown for.
        device.dao.all().map { Triple(it.provenance, it.accountTag, it.syncState) } shouldBe
            List(2) { Triple(Provenance.MANUAL, ACCOUNT, SyncState.PENDING) }
        (write as EveningWrite.Recorded).commands.map { it.portion } shouldBe listOf(Portion.AM, Portion.PM)
    }

    test("R576 - whole-day mode: an empty day is still written as ONE FULL row (the other direction)") {
        val device = Device()

        val write = device.tap(manualTap(EntryKind.HOME), WHOLE_DAYS)

        device.today() shouldBe listOf(Portion.FULL to EntryKind.HOME)
        (write as EveningWrite.Recorded).commands.map { it.portion } shouldBe listOf(Portion.FULL)
    }

    test("R576 - half-day mode, detection's Confirmer: both halves carry the proposed side and the tap's time") {
        val device = Device()

        device.tap(confirmTap(EntryKind.HOME), HALF_DAYS)

        device.dao.all().map { listOf(it.portion, it.kind, it.provenance, it.detectedKind, it.detectedAt) } shouldBe
            listOf(Portion.AM, Portion.PM).map { half ->
                listOf(half, EntryKind.HOME, Provenance.DETECTED_CONFIRMED, EntryKind.HOME, CLAIM)
            }
    }

    // A DAY ALREADY HELD KEEPS ITS OWN. The notification never writes a day that holds a row (R339's stale tap); these
    // pin that the setting does not reach past that refusal, and read the held rows back as the positive control.
    test("R490 - a day held WHOLE, tapped in half-day mode: nothing is written, the FULL row stays as it was") {
        val device = Device().holding(EntryKind.HOME, Portion.FULL)

        device.tap(manualTap(EntryKind.CH), HALF_DAYS) shouldBe EveningWrite.Ignored(EveningTapRefused.ALREADY_RECORDED)

        device.today() shouldBe listOf(Portion.FULL to EntryKind.HOME)
    }

    test("R490 - a day held in HALVES, tapped in whole-day mode: nothing is written, no FULL row beside them") {
        val device = Device().holding(EntryKind.HOME, Portion.AM, Portion.PM)

        device.tap(manualTap(EntryKind.CH), WHOLE_DAYS) shouldBe
            EveningWrite.Ignored(EveningTapRefused.ALREADY_RECORDED)

        device.today() shouldBe listOf(Portion.AM to EntryKind.HOME, Portion.PM to EntryKind.HOME)
    }

    // THROUGH R492's RECORD PATH, NEVER BESIDE IT. The receiver reads the day, then writes; a row recorded in between
    // (the app open on the same day) is invisible to its check. The repository is what refuses then.
    test("R492 - a whole day recorded after the receiver's read: half-day mode writes no half beside it") {
        val device = Device()
        val readByTheReceiver = device.dao.all()
        device.holding(EntryKind.HOME, Portion.FULL)

        val write = device.tap(manualTap(EntryKind.CH), HALF_DAYS, readByTheReceiver)

        write shouldBe EveningWrite.Refused(written = 0)
        device.today() shouldBe listOf(Portion.FULL to EntryKind.HOME)
    }

    test("R492 - halves recorded after the receiver's read: whole-day mode writes no FULL row beside them") {
        val device = Device()
        val readByTheReceiver = device.dao.all()
        device.holding(EntryKind.HOME, Portion.AM, Portion.PM)

        val write = device.tap(manualTap(EntryKind.CH), WHOLE_DAYS, readByTheReceiver)

        write shouldBe EveningWrite.Refused(written = 0)
        device.today() shouldBe listOf(Portion.AM to EntryKind.HOME, Portion.PM to EntryKind.HOME)
    }
})
