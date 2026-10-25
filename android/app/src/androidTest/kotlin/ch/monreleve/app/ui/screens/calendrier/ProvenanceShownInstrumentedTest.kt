package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.RecordedProvenance
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.calendar.EditableDay
import ch.monreleve.app.calendar.EditableSlot
import ch.monreleve.app.calendar.SelectionState
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test

/**
 * AN-GRANULARITY (R519). WHO RECORDED A DAY, READ OFF THE SCREEN - the calendar sheet and the calendar's list, rendered
 * on the device, their accessibility tree read for the words (R225: at the surface that shows them).
 *
 * The sheet's day is the state the controller hands it (one slot recorded by [provenance]); the list's month is built
 * by the real model from stored rows. Each test asserts the detected name IS on screen and - for the detected forms -
 * that the manual label is NOT; and the MANUAL case asserts the manual label still is, so a surface that stopped
 * naming provenance at all cannot pass (R245's shape). Every word comes from its one home (R181).
 */
class ProvenanceShownInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private fun sheetOf(provenance: RecordedProvenance) =
        EditableDay(
            isoDate = DAY,
            granularity = GranularityChoice.DAY,
            slots =
                listOf(
                    EditableSlot(
                        slot = Slot.FULL,
                        kind = RecordedKind.SUISSE,
                        absence = null,
                        note = null,
                        late = false,
                        modifiedAt = null,
                        firstRecordedAt = "${DAY}T18:00:00Z",
                        provenance = provenance,
                    ),
                ),
            alreadyLate = false,
            wouldBeLate = false,
            lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
        )

    private fun showSheet(provenance: RecordedProvenance) {
        composeRule.setContent {
            FrontierTheme { CalendarEditSheetContent(day = sheetOf(provenance), onSave = {}, onCancel = {}) }
        }
    }

    private fun showList(provenance: Provenance) {
        val month = buildMonthView(listOf(stored(provenance)), SETTINGS, 2026, "2026-06-15", 6)
        composeRule.setContent {
            FrontierTheme { CalendarList(monthView = month, selection = SelectionState(), actions = NO_ACTIONS) }
        }
    }

    private fun assertShown(
        word: String,
        times: Int,
    ) = composeRule.onAllNodesWithText(word, useUnmergedTree = true).assertCountEquals(times)

    private fun label(name: String): String = DayCellCopy.provenanceLabel(name).also { assertNotNull(name, it) }!!

    @Test
    fun theSheetNamesADetectionConfirmedDayAsDetected() {
        showSheet(RecordedProvenance.DETECTED_CONFIRMED)
        assertShown(label("DETECTED_CONFIRMED"), 1)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 0)
    }

    @Test
    fun theSheetNamesADetectionCorrectedDayAsCorrected() {
        showSheet(RecordedProvenance.DETECTED_CORRECTED)
        assertShown(label("DETECTED_CORRECTED"), 1)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 0)
    }

    @Test
    fun theSheetStillNamesAManualDayManual() {
        showSheet(RecordedProvenance.MANUAL)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 1)
    }

    @Test
    fun theListNamesADetectionConfirmedDayAsDetected() {
        showList(Provenance.DETECTED_CONFIRMED)
        assertShown(label("DETECTED_CONFIRMED"), 1)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 0)
    }

    @Test
    fun theListNamesADetectionCorrectedDayAsCorrected() {
        showList(Provenance.DETECTED_CORRECTED)
        assertShown(label("DETECTED_CORRECTED"), 1)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 0)
    }

    @Test
    fun theListStillNamesAManualDayManual() {
        showList(Provenance.MANUAL)
        assertShown(AujourdhuiCopy.MODE_MANUAL, 1)
    }
}

/** A past working day (a Wednesday) in June 2026, before "today" (15 June). */
private const val DAY = "2026-06-10"

private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** [DAY], recorded whole by [provenance], synced - as the server holds it and a download stores it. */
private fun stored(provenance: Provenance) =
    EntryEntity(
        clientMutationId = "m-$provenance",
        dayDate = DAY,
        portion = Portion.FULL,
        kind = EntryKind.CH,
        absenceReason = null,
        note = null,
        provenance = provenance,
        detectedKind = if (provenance == Provenance.MANUAL) null else EntryKind.CH,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$provenance",
        firstRecordedAt = "${DAY}T18:00:00Z",
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
    )

private val NO_ACTIONS =
    CalendarActions(
        onPreviousMonth = {},
        onNextMonth = {},
        onDayClick = {},
        onSave = { _, _ -> },
        onDismissSheet = {},
        onStartSelection = {},
        onStartSelectionWithDay = {},
        onToggleDay = {},
        onCancelSelection = {},
        onChooseBulk = { _, _ -> },
        onConfirmBulk = {},
        onCancelConfirmation = {},
    )
