package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.aujourdhui.YearPanel
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.MetricTile
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.RateDisplay
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZoneBadge
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.design.rail.RailVariant
import ch.monreleve.app.design.rail.ThresholdRail
import ch.monreleve.app.design.statusFor
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DetectionCopy
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.MetricCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.fr.format.formatSignedDays
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.LoggingMode

// The threshold captions are derived from the RuleSet ceilings, never typed (R181): a fraction like
// 0.40 becomes "40,0 %". PERCENT scales the fraction; THRESHOLD_DECIMALS matches SPEC 9.3's "40,0 %".
private const val PERCENT = 100.0
private const val THRESHOLD_DECIMALS = 1

// AN5b increment 3 / AN-AUTO increment 5. Recording a day (SPEC 11.2). Stateless (fence 5): it reads an
// AujourdhuiState and calls back - onRecord for a manual tap, onConfirmDetected/onCorrectDetected for a
// detection. The screen speaks the UI vocabulary only (RecordedKind/Slot/AbsenceChoice/provenance); the wire
// enums never reach this file. No success animation (DESIGN-SYSTEM section 2).
//
// TWO MODES (SPEC 11.2). In MANUAL the mode strip names "Saisie manuelle" and the person taps the day in
// themselves (the AN5b flow, unchanged). In AUTO_DETECT the screen shows the detection surface (ETATS A/B/C,
// AujourdhuiAuto.kt) - only HIGH proposes (R311), and the app never records a day on its own (D16).

@Composable
fun AujourdhuiScreen(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    onConfirmDetected: (RecordedKind, Slot) -> Unit = { _, _ -> },
    onCorrectDetected: (RecordedKind, Slot, AbsenceChoice?, RecordedKind) -> Unit = { _, _, _, _ -> },
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = Fr.GREETING, style = FrontierType.h2)
        val autoMode = state.loggingMode == LoggingMode.AUTO_DETECT
        Text(
            text = if (autoMode) DetectionCopy.MODE_AUTO else AujourdhuiCopy.MODE_MANUAL,
            style = FrontierType.caption,
        )

        if (autoMode) {
            if (state.nearBorderNotice) NearBorderNotice()
            AutoSection(state, AutoActions(onRecord, onConfirmDetected, onCorrectDetected))
        } else {
            Text(text = AujourdhuiCopy.QUESTION, style = FrontierType.h3)
            ManualSection(state, onRecord)
        }

        YearSection(state.year)
    }
}

// The manual recording surface (SPEC 11.2, AN5b): the full day, or the two half-day slots. Internal so the
// auto surface (AujourdhuiAuto.kt) can fall back to it.
@Composable
internal fun ManualSection(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    if (state.granularity == GranularityChoice.HALF_DAY) {
        Text(text = AujourdhuiCopy.MORNING, style = FrontierType.bodyM)
        RecordSection(Slot.MORNING, state.morning, onRecord)
        Text(text = AujourdhuiCopy.AFTERNOON, style = FrontierType.bodyM)
        RecordSection(Slot.AFTERNOON, state.afternoon, onRecord)
    } else {
        RecordSection(Slot.FULL, state.fullDay, onRecord)
    }
}

/**
 * The year's position (SPEC 11.2), in the web result panel's order (R137): badge, rate, rail, the two
 * remaining-days tiles. Every figure comes from the engine result the controller computed (FW12: NO
 * second arithmetic here); zoneFor/statusFor are pure display mappings, not a recomputed rate. AC3:
 * an empty year says so instead of 0 %, and the honesty notes are conditional on their condition.
 */
@Composable
private fun YearSection(year: YearPanel?) {
    if (year == null) {
        Text(text = AujourdhuiCopy.EMPTY_YEAR, style = FrontierType.body)
        return
    }
    val result = year.result
    val thresholds = ZoneThresholds(year.fiscalCeiling, year.socialCeiling)
    val zone = zoneFor(result.declarableRate, thresholds)
    val fiscalPct = formatPercent(year.fiscalCeiling * PERCENT, THRESHOLD_DECIMALS)
    val socialPct = formatPercent(year.socialCeiling * PERCENT, THRESHOLD_DECIMALS)

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space16)) {
        ZoneBadge(statusFor(result))
        RateDisplay(declarableRate = result.declarableRate, zone = zone, rawRate = result.rawRate)
        ThresholdRail(
            percentage = result.declarableRate,
            zone = zone,
            variant = RailVariant.INLINE,
            thresholds = thresholds,
            modifier = Modifier.fillMaxWidth(),
        )
        MetricTile(
            label = MetricCopy.remaining(fiscalPct),
            overLabel = MetricCopy.over(fiscalPct),
            days = formatSignedDays(result.remainingToFiscal),
        )
        MetricTile(
            label = MetricCopy.remaining(socialPct),
            overLabel = MetricCopy.over(socialPct),
            days = formatSignedDays(result.remainingToSocial),
        )

        if (year.unsyncedDays > 0) {
            Text(
                text =
                    AujourdhuiCopy.pendingNote(
                        year.unsyncedDays,
                        year.pendingLateness.name,
                        year.lateThresholdDays,
                    ),
                style = FrontierType.caption,
            )
        }
        if (year.partialYear) Text(text = AujourdhuiCopy.PARTIAL_YEAR, style = FrontierType.caption)
        year.fallbackYear?.let { Text(text = AujourdhuiCopy.fallbackNote(it), style = FrontierType.caption) }
    }
}

// Internal so the auto surface (AujourdhuiAuto.kt) reuses it for its "enter it yourself" and correction paths.
@Composable
internal fun RecordSection(
    slot: Slot,
    current: DayEntry?,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    // AN-STATE (R310): the mission/absence chooser's expanded state survives a rebuild, keyed by slot so the
    // morning and afternoon choosers are independent. A recorded tap is already persisted (Room); this keeps
    // the half-made choice - the chooser a person had opened - across rotation, text size, dark mode, a kill.
    var missionOpen by rememberSaveable(slot) { mutableStateOf(false) }
    var absenceOpen by rememberSaveable(slot) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        RecordButton(AujourdhuiCopy.SUISSE, current?.kind == RecordedKind.SUISSE) {
            onRecord(RecordedKind.SUISSE, slot, null)
        }
        RecordButton(AujourdhuiCopy.DOMICILE, current?.kind == RecordedKind.DOMICILE) {
            onRecord(RecordedKind.DOMICILE, slot, null)
        }

        val missionSelected =
            current?.kind == RecordedKind.MISSION_FRANCE || current?.kind == RecordedKind.MISSION_THIRD
        RecordButton(AujourdhuiCopy.MISSION, missionSelected) { missionOpen = !missionOpen }
        if (missionOpen || missionSelected) {
            RecordButton(AujourdhuiCopy.MISSION_FRANCE, current?.kind == RecordedKind.MISSION_FRANCE) {
                onRecord(RecordedKind.MISSION_FRANCE, slot, null)
            }
            RecordButton(AujourdhuiCopy.MISSION_THIRD, current?.kind == RecordedKind.MISSION_THIRD) {
                onRecord(RecordedKind.MISSION_THIRD, slot, null)
            }
        }

        // Tertiary: an absence changes no figure, so it is visibly secondary (D28).
        TextButton(onClick = { absenceOpen = !absenceOpen }, modifier = Modifier.fillMaxWidth()) {
            Text(text = AujourdhuiCopy.ABSENCE)
        }
        if (absenceOpen || current?.kind == RecordedKind.ABSENCE) {
            AbsenceChoice.entries.forEach { choice ->
                val chosen = current?.kind == RecordedKind.ABSENCE && current.absence == choice
                RecordButton(AujourdhuiCopy.absenceLabel(choice.name), chosen) {
                    onRecord(RecordedKind.ABSENCE, slot, choice)
                }
            }
        }

        current?.let { RecordedRow(it) }
    }
}

@Composable
private fun RecordButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.buttonLg)
    // R285 / SPEC 11.2: the day's primary action is a 56 dp large button (the size token, not the 48 dp
    // touch-target spacing value PARKAN-16 stood in with).
    val sizing = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge)
    // Selected renders filled, unselected outlined - the state is visible without colour alone.
    if (selected) {
        Button(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    } else {
        OutlinedButton(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    }
}

@Composable
private fun RecordedRow(entry: DayEntry) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = AujourdhuiCopy.recordedLabel(entry.kind.name, entry.absence?.name), style = FrontierType.bodyM)
        // ETAT C (R314): the provenance line for a detected day - never abbreviated to an icon, shown wherever
        // the entry is. Null for a manual day (no detection line).
        DetectionCopy.provenanceLine(entry.provenance.name)?.let {
            Text(text = it, style = FrontierType.caption, color = LightColors.textSecondary)
        }
        if (entry.pending) Text(text = AujourdhuiCopy.PENDING, style = FrontierType.caption)
        if (entry.failed) {
            Text(
                text = AujourdhuiCopy.SYNC_FAILED,
                style = FrontierType.caption,
                color = MaterialTheme.colorScheme.error,
            )
        }
        Text(text = AujourdhuiCopy.EDIT_HINT, style = FrontierType.caption)
    }
}
