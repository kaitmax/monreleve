package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.AutoDayState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.PendingLateness
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.RecordedProvenance
import ch.monreleve.app.aujourdhui.ToAttendTo
import ch.monreleve.app.aujourdhui.YearPanel
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.TeleworkInput
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.DayProvenance
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.LoggingMode
import org.junit.Rule
import org.junit.Test

/**
 * AN5b increment 3: baselines for the Aujourd'hui recording screen (SPEC 11.2). A regression guard,
 * not the proof of correctness (the walkthrough is, increment 6, R176/R177/R135). Captured at default
 * and 200 percent (fontScale 2f).
 *
 * States: today not yet recorded (DAY), today recorded En Suisse and pending sync (DAY), and the
 * half-day layout (HALF_DAY). Replaces AN1's placeholder baseline, which the real screen supersedes.
 */
class AujourdhuiScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val dayEmpty = AujourdhuiState(today = "2026-06-15", granularity = GranularityChoice.DAY)

    private val dayRecorded =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
        )

    private val halfDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.HALF_DAY,
            morning = DayEntry(kind = RecordedKind.DOMICILE, absence = null, pending = false, failed = false),
        )

    // AN-HOME section 1: a full day recorded and SYNCED - the choice is closed into the answer line, status
    // « Enregistré » (not pending), with « Modifier ».
    private val daySynced =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = false, failed = false),
        )

    // AN-HOME section 1: both halves recorded - the answer line shows BOTH (« Matin : Domicile — Après-midi :
    // En Suisse », R292), closed, with one « Modifier ».
    private val halfDayComplete =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.HALF_DAY,
            morning = DayEntry(kind = RecordedKind.DOMICILE, absence = null, pending = false, failed = false),
            afternoon = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
        )

    // AN-POLISH (R437), closing AN-ANSWER-ICON's Q6. THREE KINDS NOTHING PHOTOGRAPHED. briefcase, plane and
    // calendar-x shipped in AN-ANSWER-ICON with no baseline at all, because no fixture recorded a mission or
    // an absence - they were looked at on the device and nothing guards them since. These are the answered
    // card for each, SYNCED, so the only thing that differs between the three is the kind glyph and its
    // words, which is what R437 is photographing.
    //
    // "AN ABSENCE WITH A NOTE" IS AN ABSENCE WITH ITS REASON, and the difference is stated rather than
    // implied. DayEntry carries `absence` (the AbsenceChoice) and no free text; EntryEntity's `note` exists
    // in the record but no Aujourd'hui surface renders it, so a fixture carrying one would photograph
    // identically to this and certify nothing. The reason IS what the answer line shows -
    // "Absence - Conge" - so that is what is captured.
    private val missionFranceDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay =
                DayEntry(kind = RecordedKind.MISSION_FRANCE, absence = null, pending = false, failed = false),
        )

    private val missionThirdDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.MISSION_THIRD, absence = null, pending = false, failed = false),
        )

    private val absenceDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay =
                DayEntry(
                    kind = RecordedKind.ABSENCE,
                    absence = AbsenceChoice.CONGE,
                    pending = false,
                    failed = false,
                ),
        )

    // R198: a sync the server refused, held and SAID so (not silently dropped).
    private val syncFailed =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = false, failed = true),
        )

    // A real engine result, so the year panel photographs the same figures the device would compute,
    // not a hand-typed rate. 30 telework days -> a compliant ~12,5 %; 110 -> over the 40 % ceiling.
    private fun sampleYear(
        teleworkDays: Double,
        pendingLateness: PendingLateness = PendingLateness.NONE,
    ): YearPanel {
        val input =
            TeleworkInput(
                taxYear = 2026,
                canton = Canton.GE,
                employmentRate = 100,
                periodFraction = 1.0,
                denominator = DenominatorMethod.Simplified240,
                granularity = Granularity.DAY,
                teleworkDays = teleworkDays,
                missionDaysFrance = 0.0,
                missionDaysThirdState = 0.0,
            )
        val result = (calculateTelework(input) as CalcResult.Ok).value
        val rules = ruleSetFor(2026)
        return YearPanel(
            result = result,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
            unsyncedDays = 3,
            pendingLateness = pendingLateness,
            partialYear = false,
            fallbackYear = null,
        )
    }

    private val withYear =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0),
        )

    // R286: the pending line escalating. APPROACHING as the oldest unsynced day nears the threshold;
    // OVERDUE once it would be flagged on sync (R216: a prediction, not the record's flag).
    private val pendingApproaching =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0, pendingLateness = PendingLateness.APPROACHING),
        )

    private val pendingOverdue =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0, pendingLateness = PendingLateness.OVERDUE),
        )

    // A year over the fiscal ceiling: the rate is red, the badge REGIME_LOST, the fiscal tile a
    // distance ABOVE the threshold (never a negative, R73/SPEC 7.2 step 6).
    private val overCeiling =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            year = sampleYear(teleworkDays = 110.0),
        )

    // AN-AUTO increment 5: the automatic-mode states (SPEC 11.2 ETATS A/B/C, R311-R314). loggingMode AUTO_DETECT
    // switches the screen to the detection surface; `auto` drives A/B; a recorded detected day is ETAT C.
    private val autoDetecting =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            auto = AutoDayState.Detecting,
        )

    private val autoProposalSuisse =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            auto = AutoDayState.ToConfirm(RecordedKind.SUISSE),
        )

    private val autoProposalDomicile =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            auto = AutoDayState.ToConfirm(RecordedKind.DOMICILE),
        )

    private val autoNotSure =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            auto = AutoDayState.NotSure,
        )

    // ETAT C: a detected day confirmed by the person - the recorded row carries the provenance line (R314).
    private val autoConfirmed =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            fullDay =
                DayEntry(
                    kind = RecordedKind.DOMICILE,
                    absence = null,
                    pending = true,
                    failed = false,
                    provenance = RecordedProvenance.DETECTED_CONFIRMED,
                ),
        )

    // AN-HOME sections C/E/F (R328). Hand-built projections so the baseline photographs the three sections
    // rendering (the projection LOGIC is proven agreeing with CalendarModel in AujourdhuiSectionsTest). The
    // existing states above leave attend/week/month at their defaults, so C/E/F are absent there and those
    // baselines stay byte-identical (R207).
    // A test fixture builder for one week-strip cell; iso is derived from the day (all in June 2026). Its
    // parameters ARE the cell's varying fields, listed for readable call sites - a test fixture, not product.
    @Suppress("LongParameterList")
    private fun cell(
        dayOfMonth: Int,
        kind: DayKind?,
        secondKind: DayKind?,
        quality: RecordQuality,
        isToday: Boolean,
        recordable: Boolean,
    ): CalendarDayUi =
        CalendarDayUi(
            dayOfMonth = dayOfMonth,
            isoDate = "2026-06-%02d".format(dayOfMonth),
            kind = kind,
            secondKind = secondKind,
            quality = quality,
            corrected = false,
            provenance = if (kind == null) null else DayProvenance.MANUAL,
            isToday = isToday,
            recordable = recordable,
        )

    private val weekCells =
        listOf(
            cell(15, DayKind.SUISSE, null, RecordQuality.ON_TIME, isToday = false, recordable = true),
            cell(16, DayKind.DOMICILE, null, RecordQuality.ON_TIME, isToday = false, recordable = true),
            // A split half-day (R292: both kinds), today, still pending.
            cell(17, DayKind.SUISSE, DayKind.DOMICILE, RecordQuality.PENDING, isToday = true, recordable = true),
            // A past working day not yet recorded - « Non renseigné ».
            cell(18, null, null, RecordQuality.MISSING, isToday = false, recordable = true),
            // Tomorrow: future, nothing to show.
            cell(19, null, null, RecordQuality.NONE, isToday = false, recordable = false),
        )

    // Section C: both items present (unsent nearing the threshold, and unrecorded gaps), most urgent first.
    private val attend =
        ToAttendTo(
            unrecordedThisMonth = 3,
            unsyncedDays = 2,
            pendingLateness = PendingLateness.APPROACHING,
            lateThresholdDays = 7,
        )

    // Section F: this month's recorded days by kind (the same MonthSummary shape the calendar computes).
    private val month = MonthSummary(suisse = 8.0, domicile = 5.0, mission = 2.0, nonRenseigne = 3.0, absent = 1.0)

    // The full home with « À traiter »: a day recorded (B closed into the answer), C, then the year hero (D).
    // The 1000 dp device viewport (paparazzi) holds A-D; E and F sit below the fold here, so they get their
    // own state (weekAndMonth) where a compact top brings them into view - a baseline is a decision about
    // where to look (R178), so there is one for C and one for E/F.
    private val withSections =
        AujourdhuiState(
            today = "2026-06-17",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = false, failed = false),
            year = sampleYear(teleworkDays = 30.0),
            attend = attend,
            week = weekCells,
            month = month,
        )

    // Sections E « Cette semaine » and F « Ce mois » brought into the viewport: a recorded day (compact B),
    // no « À traiter » (attend null -> C absent), and an empty year (D is a one-liner), so the week strip and
    // the month counts sit above the 1000 dp fold.
    private val weekAndMonth =
        AujourdhuiState(
            today = "2026-06-17",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = false, failed = false),
            attend = null,
            week = weekCells,
            month = month,
        )

    // R313: the near-border suggestion, shown once above the detection surface.
    private val autoNearBorder =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            loggingMode = LoggingMode.AUTO_DETECT,
            auto = AutoDayState.ToConfirm(RecordedKind.SUISSE),
            nearBorderNotice = true,
        )

    // PARKAN-50: the screenshot titulaire. The greeting is now DATA-driven (Fr.greeting reads the holder's
    // name from state), so the host supplies one - « Camille Martin » -> « Bonjour Camille », the same header
    // these baselines have always shown, now proving the wired path rather than a hard-coded person. Supplying
    // the historical name keeps every baseline byte-identical (R207: no regeneration the change does not
    // explain); a fixture that sets its own holderName keeps it (this only fills the ones left null).
    private val holderName = "Camille Martin"

    @Composable
    private fun host(
        state: AujourdhuiState,
        yearDownloadFailed: Boolean = false,
    ) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                AujourdhuiScreen(
                    state = state.copy(holderName = state.holderName ?: holderName),
                    actions = AujourdhuiActions(onRecord = { _, _, _ -> }),
                    yearDownloadFailed = yearDownloadFailed,
                )
            }
        }
    }

    @Test
    fun aujourdhuiEmpty() {
        paparazzi.snapshot { host(dayEmpty) }
    }

    // AN-PULL (R484): the server's year could not be brought down to the phone - the notice and its retry, first,
    // above a day that is otherwise the empty one (the state a failed download leaves the screen in). NEW baselines;
    // every existing one is unchanged, because the notice is absent unless the flag is set.
    @Test
    fun aujourdhuiYearDownloadFailed() {
        paparazzi.snapshot { host(dayEmpty, yearDownloadFailed = true) }
    }

    @Test
    fun aujourdhuiYearDownloadFailedLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(dayEmpty, yearDownloadFailed = true) }
    }

    @Test
    fun aujourdhuiEmptyLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(dayEmpty) }
    }

    @Test
    fun aujourdhuiRecordedPending() {
        paparazzi.snapshot { host(dayRecorded) }
    }

    @Test
    fun aujourdhuiHalfDay() {
        paparazzi.snapshot { host(halfDay) }
    }

    // AN-POLISH (R436): the HALF-ANSWERED card at the largest font scale - the morning settled into its own
    // answer line, the afternoon still open. R436 asks for a capture of the answered card AND the
    // half-answered one at 200 %; the answered card already has three (aujourdhuiHalfDayCompleteLarge,
    // aujourdhuiWithYearLarge, aujourdhuiPendingOverdueLarge) and this was the gap. It is also where the
    // scaled glyph has to prove itself: a 40 dp house beside doubled words, with the half below it still
    // reachable rather than pushed off the viewport.
    @Test
    fun aujourdhuiHalfDayLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(halfDay) }
    }

    @Test
    fun aujourdhuiDaySynced() {
        paparazzi.snapshot { host(daySynced) }
    }

    // AN-POLISH (R437): the three answered cards that had no baseline - a mission in France (briefcase), a
    // mission in a third state (aeroplane), and an absence with its reason (struck-out calendar).
    @Test
    fun aujourdhuiMissionFrance() {
        paparazzi.snapshot { host(missionFranceDay) }
    }

    @Test
    fun aujourdhuiMissionThird() {
        paparazzi.snapshot { host(missionThirdDay) }
    }

    @Test
    fun aujourdhuiAbsence() {
        paparazzi.snapshot { host(absenceDay) }
    }

    @Test
    fun aujourdhuiHalfDayComplete() {
        paparazzi.snapshot { host(halfDayComplete) }
    }

    // AN-GRANULARITY (R490, R493): today RECORDED WHOLE while the setting is half-days - the whole-day answer card,
    // its « Modifier », and the one sentence saying why (not two halves that would quietly write FULL). NEW baseline.
    @Test
    fun aujourdhuiRecordedWholeInHalfDayMode() {
        paparazzi.snapshot { host(daySynced.copy(recordedAs = GranularityChoice.DAY)) }
    }

    // AN-GRANULARITY (R490, R493): the mirror - today RECORDED IN HALVES while the setting is whole days keeps its
    // halves, with the sentence. NEW baseline.
    @Test
    fun aujourdhuiRecordedHalvesInWholeDayMode() {
        paparazzi.snapshot { host(halfDayComplete.copy(recordedAs = GranularityChoice.HALF_DAY)) }
    }

    // AN-ANSWER-ICON (R433): the ANSWERED card at the largest font size, in the shape that carries TWO glyphs
    // - one beside « Matin : … », one beside « Après-midi : … ». The DAY answered card is already captured at
    // 200 % by aujourdhuiWithYearLarge and aujourdhuiPendingOverdueLarge; the split day was the gap, and it is
    // where a glyph could collide with wrapped words. DARK MODE IS NOT CAPTURED: FrontierTheme has no dark
    // path, by DESIGN-SYSTEM section 2's own override ("light ships first"), so a night capture would
    // photograph the light theme and certify nothing (PARKED - see REPORT-AN-ANSWER-ICON.txt).
    @Test
    fun aujourdhuiHalfDayCompleteLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(halfDayComplete) }
    }

    @Test
    fun aujourdhuiWithYear() {
        paparazzi.snapshot { host(withYear) }
    }

    @Test
    fun aujourdhuiWithYearLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(withYear) }
    }

    @Test
    fun aujourdhuiSyncFailed() {
        paparazzi.snapshot { host(syncFailed) }
    }

    @Test
    fun aujourdhuiPendingApproaching() {
        paparazzi.snapshot { host(pendingApproaching) }
    }

    @Test
    fun aujourdhuiPendingOverdue() {
        paparazzi.snapshot { host(pendingOverdue) }
    }

    @Test
    fun aujourdhuiPendingOverdueLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(pendingOverdue) }
    }

    @Test
    fun aujourdhuiOverCeiling() {
        paparazzi.snapshot { host(overCeiling) }
    }

    @Test
    fun aujourdhuiOverCeilingLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(overCeiling) }
    }

    // AN-AUTO increment 5: the automatic-mode states (SPEC 11.2).
    @Test
    fun aujourdhuiAutoDetecting() {
        paparazzi.snapshot { host(autoDetecting) }
    }

    @Test
    fun aujourdhuiAutoProposalSuisse() {
        paparazzi.snapshot { host(autoProposalSuisse) }
    }

    @Test
    fun aujourdhuiAutoProposalDomicile() {
        paparazzi.snapshot { host(autoProposalDomicile) }
    }

    @Test
    fun aujourdhuiAutoProposalSuisseLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(autoProposalSuisse) }
    }

    @Test
    fun aujourdhuiAutoNotSure() {
        paparazzi.snapshot { host(autoNotSure) }
    }

    @Test
    fun aujourdhuiAutoConfirmed() {
        paparazzi.snapshot { host(autoConfirmed) }
    }

    @Test
    fun aujourdhuiAutoNearBorder() {
        paparazzi.snapshot { host(autoNearBorder) }
    }

    // AN-HOME sections C/E/F (R328): the full home with « À traiter », the week strip (grid) and the month
    // counts, at default scale.
    @Test
    fun aujourdhuiWithSections() {
        paparazzi.snapshot { host(withSections) }
    }

    // At 200 %: A/B/C must stay legible with no horizontal overflow (R127's shape on Android).
    @Test
    fun aujourdhuiWithSectionsLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(withSections) }
    }

    // Sections E and F at default scale: the five Monday-Friday DayCells with the kind + quality legends
    // (R119), and the month's recorded-day counts by kind.
    @Test
    fun aujourdhuiWeekAndMonth() {
        paparazzi.snapshot { host(weekAndMonth) }
    }

    // At 200 %: the week strip follows the calendar's rule and becomes a LIST (R271), each day in words, with
    // no horizontal overflow.
    @Test
    fun aujourdhuiWeekAndMonthLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(weekAndMonth) }
    }
}
