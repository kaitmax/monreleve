package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.calendar.CalendarState
import ch.monreleve.app.calendar.EditableDay
import ch.monreleve.app.calendar.EditableSlot
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import org.junit.Rule
import org.junit.Test

// AN10 increment 1: the calendar month baseline (SPEC 11.3, FD6). A regression guard, not the proof of
// correctness (the walkthrough is, increment 5, R176/R177/R135). The month is built by the REAL model
// (buildMonthView) from seeded rows, so the baseline photographs the same grid the device computes: an
// on-time day, a late day (from a backdated server timestamp), a pending day, recorded absences, today
// highlighted, and the past working days with no entry rendered as missing. Captured at default size;
// the high-scale LIST is increment 4's own baseline.

private fun settings(activityStartDate: String? = null): Settings {
    return Settings("GE", 100, "SIMPLIFIED240", null, "DAY", activityStartDate)
}

private fun entry(
    dayDate: String,
    kind: EntryKind,
    syncState: SyncState = SyncState.SYNCED,
    firstRecordedAt: String = "${dayDate}T09:00:00Z",
): EntryEntity =
    EntryEntity(
        clientMutationId = "$dayDate-FULL",
        dayDate = dayDate,
        portion = Portion.FULL,
        kind = kind,
        absenceReason = if (kind == EntryKind.ABSENT) AbsenceReason.FERIE else null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = if (syncState == SyncState.SYNCED) "srv-$dayDate" else null,
        firstRecordedAt = if (syncState == SyncState.SYNCED) firstRecordedAt else null,
        lastModifiedAt = null,
        syncState = syncState,
    )

class CalendrierScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    // today is 15 June 2026; the month shows on-time, late, pending, absence, missing and today.
    private val month =
        buildMonthView(
            entries =
                listOf(
                    entry("2026-06-01", EntryKind.CH),
                    entry("2026-06-02", EntryKind.HOME),
                    // recorded eight days after the day: late by the server's own timestamp (R216).
                    entry("2026-06-03", EntryKind.HOME, firstRecordedAt = "2026-06-11T09:00:00Z"),
                    entry("2026-06-04", EntryKind.MISSION_FR, syncState = SyncState.PENDING),
                    entry("2026-06-08", EntryKind.ABSENT),
                ),
            settings = settings(),
            taxYear = 2026,
            today = "2026-06-15",
            month = 6,
        )

    private val noopActions =
        CalendarActions(
            onPreviousMonth = {},
            onNextMonth = {},
            onDayClick = {},
            onSave = { _, _ -> },
            onDismissSheet = {},
        )

    // A day open in the edit sheet: a recorded Domicile with a note, DAY granularity (FD6 A2). Recorded
    // on time, so the provenance block shows the first-recording timestamp and no late notice.
    private val editingDay =
        EditableDay(
            isoDate = "2026-06-03",
            granularity = GranularityChoice.DAY,
            slots =
                listOf(
                    EditableSlot(
                        slot = Slot.FULL,
                        kind = RecordedKind.DOMICILE,
                        absence = null,
                        note = "Réunion annulée",
                        late = false,
                        modifiedAt = null,
                        firstRecordedAt = "2026-06-03T09:00:00Z",
                    ),
                ),
            alreadyLate = false,
            wouldBeLate = false,
            lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
        )

    // A late, corrected-after-the-fact day (FD6 A2's own example): the late notice states the flag is in
    // the dossier, and the provenance block shows both the first recording and the later modification.
    private val editingLateDay =
        EditableDay(
            isoDate = "2026-06-03",
            granularity = GranularityChoice.DAY,
            slots =
                listOf(
                    EditableSlot(
                        slot = Slot.FULL,
                        kind = RecordedKind.DOMICILE,
                        absence = null,
                        note = "Réunion annulée, journée à domicile",
                        late = true,
                        modifiedAt = "2026-06-20T14:30:00Z",
                        firstRecordedAt = "2026-06-15T21:08:00Z",
                    ),
                ),
            alreadyLate = true,
            wouldBeLate = true,
            lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
        )

    @Composable
    private fun host(state: CalendarState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                CalendrierScreen(state = state, actions = noopActions)
            }
        }
    }

    @Test
    fun calendrierMonth() {
        paparazzi.snapshot { host(CalendarState(monthView = month)) }
    }

    // R271, AC3: at 200 % text the grid becomes a list, one row per day, each saying date, kind, quality
    // and provenance in words. The switch is on the measured font scale (LIST_FONT_SCALE_THRESHOLD).
    @Test
    fun calendrierListLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(CalendarState(monthView = month)) }
    }

    // The edit sheet's content directly (a ModalBottomSheet's own scaffolding does not render reliably
    // under Layoutlib, so the content composable is baselined on its own).
    @Test
    fun calendrierEditSheet() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    CalendarEditSheetContent(day = editingDay, onSave = {}, onCancel = {})
                }
            }
        }
    }

    @Test
    fun calendrierEditSheetLate() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    CalendarEditSheetContent(day = editingLateDay, onSave = {}, onCancel = {})
                }
            }
        }
    }

    // The edit sheet at 200 percent (the night's baseline discipline: default AND fontScale 2f). The
    // richest state (late + modified). The content scrolls, so the fixed viewport photographs the head
    // (title, question, options) at 2f; the late notice and provenance sit below the fold here and are
    // seen at default (calendrierEditSheetLate) and on the device (cal-10/cal-11).
    @Test
    fun calendrierEditSheetLateLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot {
            FrontierTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    CalendarEditSheetContent(day = editingLateDay, onSave = {}, onCancel = {})
                }
            }
        }
    }
}
