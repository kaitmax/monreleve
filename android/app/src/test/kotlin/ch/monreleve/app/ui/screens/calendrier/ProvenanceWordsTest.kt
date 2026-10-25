package ch.monreleve.app.ui.screens.calendrier

import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.calendar.EditableDay
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-GRANULARITY (R519). EVERY SURFACE THAT NAMES WHO RECORDED A DAY SAYS WHAT THE RECORD SAYS.
//
// WHAT THIS EXISTS TO STOP, stated as the thing that happened. AN-PULL brought detection-confirmed days down from
// the server, and the calendar sheet said « Saisie manuelle » of every one of them - its provenance block printed the
// manual product's constant for every recorded day - while the calendar list showed NO word for a detected day at
// all. The record carried the truth (Provenance on every row); two surfaces did not read it.
//
// ASSERTED WHERE EACH SURFACE TAKES ITS WORDS (R225): the sheet renders provenanceLines(day) one Text per line, and
// both list rows (the calendar's large-text list, Aujourd'hui's week list) render dayWords(day) one Text per word - so
// these ARE the words on screen. The day comes through the REAL controller and the REAL month model from stored rows.
// ProvenanceShownInstrumentedTest renders the two composables on the device and reads the same words off the tree.
//
// BOTH DIRECTIONS (R245's shape): a MANUAL day must still say « Saisie manuelle », so a surface that stopped naming
// provenance at all fails here too. Every expected word is read from its one home (DayCellCopy.provenanceLabel,
// AujourdhuiCopy.MODE_MANUAL), never typed (R181).

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private const val DAY = "2026-06-10"

private val WHOLE_DAYS =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

private fun label(provenance: Provenance): String = DayCellCopy.provenanceLabel(provenance.name).shouldNotBeNull()

private val MANUAL_LABEL = AujourdhuiCopy.MODE_MANUAL

/** One stored, synced row of [DAY] - recorded by [provenance], as the server holds it and a download stores it. */
private fun stored(
    portion: Portion,
    kind: EntryKind,
    provenance: Provenance,
): EntryEntity =
    EntryEntity(
        clientMutationId = "m-$portion",
        dayDate = DAY,
        portion = portion,
        kind = kind,
        absenceReason = null,
        note = null,
        provenance = provenance,
        detectedKind = if (provenance == Provenance.MANUAL) null else EntryKind.CH,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$portion",
        firstRecordedAt = "${DAY}T18:00:00Z",
        lastModifiedAt = "${DAY}T18:00:00Z",
        syncState = SyncState.SYNCED,
    )

/** The sheet the real controller opens on [DAY] for [rows]. */
@OptIn(ExperimentalCoroutinesApi::class)
private suspend fun TestScope.sheetFor(vararg rows: EntryEntity): EditableDay {
    val dao = FakeEntryDao()
    rows.forEach { dao.upsert(it) }
    val controller = CalendarController(LocalEntryRepository(dao, JUNE_15), WHOLE_DAYS, 2026, JUNE_15, this)
    advanceUntilIdle()
    controller.openDay(DAY)
    return controller.state.value.editing.shouldNotBeNull()
}

/** [DAY]'s row in the month the real model builds from [rows] - what both list rows render. */
private fun listDay(vararg rows: EntryEntity) =
    buildMonthView(rows.toList(), WHOLE_DAYS.load(), 2026, "2026-06-15", 6).days.first { it.isoDate == DAY }

@OptIn(ExperimentalCoroutinesApi::class)
class ProvenanceWordsTest : FunSpec({
    test("R519 the sheet names a DETECTED_CONFIRMED day as detected - never as a manual entry") {
        runTest {
            val lines = provenanceLines(sheetFor(stored(Portion.FULL, EntryKind.CH, Provenance.DETECTED_CONFIRMED)))

            lines shouldContain label(Provenance.DETECTED_CONFIRMED)
            lines shouldNotContain MANUAL_LABEL
        }
    }

    test("R519 the sheet names a DETECTED_CORRECTED day as corrected - never as a manual entry") {
        runTest {
            val lines = provenanceLines(sheetFor(stored(Portion.FULL, EntryKind.HOME, Provenance.DETECTED_CORRECTED)))

            lines shouldContain label(Provenance.DETECTED_CORRECTED)
            lines shouldNotContain MANUAL_LABEL
        }
    }

    test("R519 both directions: the sheet still names a MANUAL day « Saisie manuelle »") {
        runTest {
            provenanceLines(sheetFor(stored(Portion.FULL, EntryKind.CH, Provenance.MANUAL))) shouldContain MANUAL_LABEL
        }
    }

    test("R519 the sheet states each half's provenance when the halves were recorded differently") {
        runTest {
            val lines =
                provenanceLines(
                    sheetFor(
                        stored(Portion.AM, EntryKind.CH, Provenance.DETECTED_CONFIRMED),
                        stored(Portion.PM, EntryKind.HOME, Provenance.MANUAL),
                    ),
                )

            lines shouldContain AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, label(Provenance.DETECTED_CONFIRMED))
            lines shouldContain AujourdhuiCopy.halfLabel(AujourdhuiCopy.AFTERNOON, MANUAL_LABEL)
        }
    }

    test("R519 the list rows name a DETECTED_CONFIRMED day as detected") {
        val words = dayWords(listDay(stored(Portion.FULL, EntryKind.CH, Provenance.DETECTED_CONFIRMED)))

        words shouldContain label(Provenance.DETECTED_CONFIRMED)
        words shouldNotContain MANUAL_LABEL
    }

    test("R519 the list rows name a DETECTED_CORRECTED day as corrected") {
        val words = dayWords(listDay(stored(Portion.FULL, EntryKind.HOME, Provenance.DETECTED_CORRECTED)))

        words shouldContain label(Provenance.DETECTED_CORRECTED)
        words shouldNotContain MANUAL_LABEL
    }

    test("R519 both directions: the list rows still name a MANUAL day « Saisie manuelle »") {
        dayWords(listDay(stored(Portion.FULL, EntryKind.CH, Provenance.MANUAL))) shouldContain MANUAL_LABEL
    }

    test("R519 the list rows state each half's provenance when the halves were recorded differently") {
        val words =
            dayWords(
                listDay(
                    stored(Portion.AM, EntryKind.CH, Provenance.DETECTED_CONFIRMED),
                    stored(Portion.PM, EntryKind.HOME, Provenance.MANUAL),
                ),
            )

        words shouldContain AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, label(Provenance.DETECTED_CONFIRMED))
        words shouldContain AujourdhuiCopy.halfLabel(AujourdhuiCopy.AFTERNOON, MANUAL_LABEL)
    }

    test("R519 the cell's announcement states each half's provenance when the halves were recorded differently") {
        val day =
            listDay(
                stored(Portion.AM, EntryKind.CH, Provenance.DETECTED_CONFIRMED),
                stored(Portion.PM, EntryKind.HOME, Provenance.MANUAL),
            )
        val spoken =
            DayCellCopy.contentDescription(
                dayOfMonth = day.dayOfMonth,
                kindLetter = day.kind?.letter,
                qualityName = day.quality.name,
                corrected = day.corrected,
                provenanceName = day.provenance?.name,
                secondKindLetter = day.secondKind?.letter,
                secondProvenanceName = day.secondProvenance?.name,
            )

        spoken shouldContain label(Provenance.DETECTED_CONFIRMED).replaceFirstChar { it.lowercase() }
        spoken shouldContain MANUAL_LABEL.replaceFirstChar { it.lowercase() }
    }

    test("R519 one home: the announcement and the Releve's annex say the same names the surfaces print") {
        for (provenance in Provenance.entries) {
            val spoken = DayCellCopy.contentDescription(1, "S", "ON_TIME", false, provenanceName = provenance.name)
            // The difference between the label and the announcement's word is stated, and it is only this.
            spoken shouldContain label(provenance).replaceFirstChar { it.lowercase() }
            spoken shouldNotContain label(provenance)
            ReleveCopy.annexEntryMeta("FULL", provenance.name, null, null, null) shouldContain label(provenance)
        }
        // A provenance this build does not know is not guessed as "manual" by the one home; the annex keeps its own
        // fallback, as it always has.
        DayCellCopy.provenanceLabel("FROM_THE_FUTURE") shouldBe null
    }
})
