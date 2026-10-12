package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.aujourdhui.YearPanel
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.MetricTile
import ch.monreleve.app.design.Motion
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
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.format.SignedDays
import ch.monreleve.app.fr.format.formatDayLong
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.fr.format.formatSignedDays
import ch.monreleve.app.settings.LoggingMode

// The threshold captions are derived from the RuleSet ceilings, never typed (R181): a fraction like
// 0.40 becomes "40,0 %". PERCENT scales the fraction; THRESHOLD_DECIMALS matches SPEC 9.3's "40,0 %".
private const val PERCENT = 100.0
private const val THRESHOLD_DECIMALS = 1

// AN5b increment 3 / AN-AUTO increment 5. Recording a day (SPEC 11.2). Stateless (fence 5): it reads an
// AujourdhuiState and calls back - onRecord for a manual tap, onConfirmDetected/onCorrectDetected for a
// detection, onNavigateToCalendrier for sections C/E/F. The screen speaks the UI vocabulary only
// (RecordedKind/Slot/AbsenceChoice/provenance); the wire enums never reach this file. No success animation
// (DESIGN-SYSTEM section 2).
//
// TWO MODES (SPEC 11.2). In MANUAL the mode strip names "Saisie manuelle" and the person taps the day in
// themselves (the AN5b flow, unchanged). In AUTO_DETECT the screen shows the detection surface (ETATS A/B/C,
// AujourdhuiAuto.kt) - only HIGH proposes (R311), and the app never records a day on its own (D16).

/**
 * The screen's callbacks, bundled the way every other screen bundles its own (CalendarActions, ReleveActions,
 * AutoActions): one parameter instead of four, so the screen stays within the parameter budget and each call
 * site reads as named fields. onConfirmDetected/onCorrectDetected default to no-ops (manual mode never calls
 * them), and onNavigateToCalendrier defaults to {} so a preview or the screenshot host needs only onRecord.
 */
data class AujourdhuiActions(
    val onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    val onConfirmDetected: (RecordedKind, Slot) -> Unit = { _, _ -> },
    val onCorrectDetected: (RecordedKind, Slot, AbsenceChoice?, RecordedKind) -> Unit = { _, _, _, _ -> },
    val onNavigateToCalendrier: () -> Unit = {},
    // AN-FORECAST: the year card's « Voir ma prevision », under the year notes (not replacing them).
    val onNavigateToForecast: () -> Unit = {},
)

@Composable
fun AujourdhuiScreen(
    state: AujourdhuiState,
    actions: AujourdhuiActions,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Header(state.today, state.holderName) // Section A
        val autoMode = state.loggingMode == LoggingMode.AUTO_DETECT
        Text(
            text = if (autoMode) DetectionCopy.MODE_AUTO else AujourdhuiCopy.MODE_MANUAL,
            style = FrontierType.caption,
        )

        // Section B - today's choice (manual) or the detection surface (auto).
        if (autoMode) {
            if (state.nearBorderNotice) NearBorderNotice()
            AutoSection(state, AutoActions(actions.onRecord, actions.onConfirmDetected, actions.onCorrectDetected))
        } else {
            Text(text = AujourdhuiCopy.QUESTION, style = FrontierType.h3)
            ManualSection(state, actions.onRecord)
        }

        // Ordered by what the person needs first (AN-HOME section 2): what to attend to, then the year's
        // position (the core answer), then this week and this month. C/E/F live in AujourdhuiSections.kt.
        AttendSection(state.attend, actions.onNavigateToCalendrier) // Section C
        YearSection(state.year, actions.onNavigateToForecast) // Section D
        WeekSection(state.week, actions.onNavigateToCalendrier) // Section E
        MonthSection(state.month) // Section F
    }
}

// Section A (AN-HOME): the greeting and today's date in Europe/Paris. The date is formatted from state.today,
// which the controller recomputes from the clock on resume (F8) - so it is "worked out when used", not frozen
// at construction. "Lundi 15 juin 2026", French, leading capital (formatDayLong).
@Composable
private fun Header(
    today: String,
    holderName: String?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        // PARKAN-50: the greeting is the holder's first name (Fr.greeting), from state, not a hard-coded person.
        Text(text = Fr.greeting(holderName), style = FrontierType.h2)
        Text(text = formatDayLong(today), style = FrontierType.body, color = LightColors.textSecondary)
    }
}

// The manual recording surface (SPEC 11.2, AN5b): the choice card (AN-HOME section 1) - the options when the
// day is not yet recorded, closing into the answer line once it is. DAY shows one slot; HALF_DAY both halves.
@Composable
internal fun ManualSection(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    ChoiceCard(state = state, onRecord = onRecord)
}

/**
 * The year's position (SPEC 11.2), in the web result panel's order (R137): badge, rate, rail, the two
 * remaining-days tiles. Section D (AN-HOME): this is the product's core answer, so it is given the visual
 * weight of a HERO status card (radius 20, padding 24 - DESIGN-SYSTEM FrontierStatusCard). Every figure comes
 * from the engine result the controller computed (FW12: NO second arithmetic here); zoneFor/statusFor are pure
 * display mappings, not a recomputed rate. AC3: an empty year says so instead of 0 %, and the honesty notes are
 * conditional on their condition.
 *
 * NUMBER CHANGES animate over 300 ms (Motion.numbersMillis - DESIGN-SYSTEM "numbers animate over 300 ms"): the
 * rate, the rail fill and the two day counts count toward their new value when a day is recorded. The ZONE
 * (colour) and the tile LABELS come from the TARGET result, so only the figures move - no colour flicker, no
 * label flip mid-animation. With "Remove animations" on the change is instant (snap()).
 */
@Composable
private fun YearSection(
    year: YearPanel?,
    onNavigateToForecast: () -> Unit,
) {
    if (year == null) {
        Text(text = AujourdhuiCopy.EMPTY_YEAR, style = FrontierType.body)
        return
    }
    YearHeroCard(year, onNavigateToForecast)
}

// The displayed day count animates, but its negative flag (which picks the « restants »/« au-dessus » label)
// stays the TARGET's, so the label never flips mid-count. Block body so the formatter keeps the line short.
private fun animatedDays(
    target: Double,
    animated: Float,
): SignedDays {
    return formatSignedDays(target).copy(text = formatSignedDays(animated.toDouble()).text)
}

@Composable
private fun YearHeroCard(
    year: YearPanel,
    onNavigateToForecast: () -> Unit,
) {
    val result = year.result
    val thresholds = ZoneThresholds(year.fiscalCeiling, year.socialCeiling)
    val zone = zoneFor(result.declarableRate, thresholds)
    val fiscalPct = formatPercent(year.fiscalCeiling * PERCENT, THRESHOLD_DECIMALS)
    val socialPct = formatPercent(year.socialCeiling * PERCENT, THRESHOLD_DECIMALS)
    val numberSpec: AnimationSpec<Float> = if (rememberReduceMotion()) snap() else tween(Motion.numbersMillis)
    val animRate by animateFloatAsState(result.declarableRate.toFloat(), numberSpec)
    val animFiscal by animateFloatAsState(result.remainingToFiscal.toFloat(), numberSpec)
    val animSocial by animateFloatAsState(result.remainingToSocial.toFloat(), numberSpec)

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.xl))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.xl))
                .padding(Spacing.space24),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        ZoneBadge(statusFor(result))
        RateDisplay(declarableRate = animRate.toDouble(), zone = zone, rawRate = result.rawRate)
        ThresholdRail(
            percentage = animRate.toDouble(),
            zone = zone,
            variant = RailVariant.INLINE,
            thresholds = thresholds,
            modifier = Modifier.fillMaxWidth(),
        )
        MetricTile(
            label = MetricCopy.remaining(fiscalPct),
            overLabel = MetricCopy.over(fiscalPct),
            days = animatedDays(result.remainingToFiscal, animFiscal),
        )
        MetricTile(
            label = MetricCopy.remaining(socialPct),
            overLabel = MetricCopy.over(socialPct),
            days = animatedDays(result.remainingToSocial, animSocial),
        )
        YearNotes(year)
        // AN-FORECAST: the entry point to the year-end forecast, under the notes (R85: live now that the
        // forecast screen exists). A text link, subordinate to the card's figures - not a second primary action.
        TextButton(onClick = onNavigateToForecast, modifier = Modifier.fillMaxWidth()) {
            Text(text = RythmeCopy.VIEW_FORECAST)
        }
    }
}

// The honesty notes (AC3): shown only on their condition - unsynced count (R286 escalation), a partial year,
// and a RuleSet fallback. Each is conditional on its own state, never a permanent line.
@Composable
private fun YearNotes(year: YearPanel) {
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
