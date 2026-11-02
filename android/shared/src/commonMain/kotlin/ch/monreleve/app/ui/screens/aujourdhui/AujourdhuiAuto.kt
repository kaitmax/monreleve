package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.AutoDayState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Motion
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DetectionCopy
import ch.monreleve.app.onboarding.GranularityChoice
import kotlinx.coroutines.delay

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-AUTO increment 5 / R320. The automatic-mode surfaces for Aujourd'hui (SPEC 11.2 ETATS A/B/C, R311-R314), split
// out of AujourdhuiScreen.kt so neither file carries too many composables. Stateless (fence 5); every string from
// fr/ (the no-literal fence). It reuses the manual RecordSection for the "enter it yourself" and correction paths.
//
// R320 - GRANULARITY. A day-granularity user sees one auto surface for the whole day; a half-day-granularity user
// sees an independent surface for the morning (checks 1-2) and the afternoon (checks 3-4), each confirmed or
// corrected on its own slot. The controller has already decided each slot's outcome (auto / autoMorning /
// autoAfternoon); this file only renders it.
//
// NO ACCURACY CLAIM. Only HIGH surfaces (R311) and the proposal is phrased "Proposition - vérifiez"; there is no
// "détection fiable" badge (a beta under measurement must not assert reliability it has not measured).

// The cards here are a WHITE surface on the grey canvas (DESIGN-SYSTEM: card #FFFFFF on canvas #F7F8FA), so the fill
// alone delineates them - no explicit 1 px border, which would need a raw .dp the ui/ token fence forbids.

// R313: the near-border suggestion, shown once (the controller gates the "once"). It offers manual without
// disparaging detection (D19); the person keeps whichever mode they prefer, from Parametres.
@Composable
internal fun NearBorderNotice() {
    Text(
        text = DetectionCopy.NEAR_BORDER,
        style = FrontierType.caption,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.infoBg)
                .padding(Spacing.space12),
    )
}

// The three record callbacks the auto surface routes through, bundled so a slot's composable carries one seam, not
// three (fence 4 forbids an annotation's string argument in ui/, so the param count is kept low by design here).
internal class AutoActions(
    val onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    val onConfirmDetected: (RecordedKind, Slot) -> Unit,
    val onCorrectDetected: (RecordedKind, Slot, AbsenceChoice?, RecordedKind) -> Unit,
)

// SPEC 11.2 ETATS A/B/C for automatic mode, by granularity (R320). ETAT C (a recorded slot) shows the recorded row
// with its provenance line - the same RecordSection the manual flow uses, so a detected day can still be edited.
@Composable
internal fun AutoSection(
    state: AujourdhuiState,
    actions: AutoActions,
) {
    if (state.granularity == GranularityChoice.HALF_DAY) {
        Text(text = AujourdhuiCopy.MORNING, style = FrontierType.bodyM)
        AutoSlot(Slot.MORNING, state.morning, state.autoMorning, actions)
        Text(text = AujourdhuiCopy.AFTERNOON, style = FrontierType.bodyM)
        AutoSlot(Slot.AFTERNOON, state.afternoon, state.autoAfternoon, actions)
    } else {
        AutoSlot(Slot.FULL, state.fullDay, state.auto, actions)
    }
}

// One slot's auto surface: a recorded row (ETAT C), a proposal (ETAT B), the not-sure message, or "detection en
// cours" (ETAT A). `recorded` wins - a confirmed/corrected slot shows its row, not a re-proposal (D16).
@Composable
private fun AutoSlot(
    slot: Slot,
    recorded: DayEntry?,
    auto: AutoDayState?,
    actions: AutoActions,
) {
    // AN-LAUNCH-SPEECH (R702, ChoiceCard.kt): ETAT C's answer is a live region only when a tap HERE - a confirm, a
    // correction or a manual record - produced it. Held at the slot, because the proposal that was tapped and the
    // recorded row that replaces it are different composables. NOT saveable: a relaunch is not a tap.
    var answeredHere by remember(slot) { mutableStateOf(false) }
    val heard =
        AutoActions(
            onRecord = { kind, s, absence ->
                answeredHere = true
                actions.onRecord(kind, s, absence)
            },
            onConfirmDetected = { kind, s ->
                answeredHere = true
                actions.onConfirmDetected(kind, s)
            },
            onCorrectDetected = { kind, s, absence, detected ->
                answeredHere = true
                actions.onCorrectDetected(kind, s, absence, detected)
            },
        )
    when {
        recorded != null -> AutoRecordedSlot(slot, recorded, heard.onRecord, answeredHere) // ETAT C
        auto is AutoDayState.ToConfirm -> ProposalCard(auto.kind, slot, heard)
        auto is AutoDayState.NotSure -> NotSureBlock(slot, heard.onRecord)
        auto is AutoDayState.Detecting -> DetectingBlock(slot, heard.onRecord)
        else -> RecordSection(slot, null, heard.onRecord) // defensive: no auto decision -> manual
    }
}

// SPEC 11.2 ETAT C - a recorded detected (or corrected) day, closed into its answer line (AN-HOME section 1).
// « Modifier » reopens the manual options routing through onRecord, exactly as the pre-AN-HOME ETAT C did
// (editing a recorded day re-records it); the 1 px card, the motion, the polite live region and the R310
// editing state are ChoiceCard's shared pieces, reused here per slot.
@Composable
private fun AutoRecordedSlot(
    slot: Slot,
    entry: DayEntry,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    announce: Boolean,
) {
    var editing by rememberSaveable(slot) { mutableStateOf(false) }
    val reduceMotion = rememberReduceMotion()
    val modifierFocus = remember { FocusRequester() }
    var wasEditing by remember { mutableStateOf(editing) }
    LaunchedEffect(editing) {
        if (!editing && wasEditing) {
            if (!reduceMotion) delay(Motion.standardMillis.toLong())
            runCatching { modifierFocus.requestFocus() }
        }
        wasEditing = editing
    }
    ChoiceSurface {
        AnimatedVisibility(
            visible = editing,
            enter = optionsEnter(reduceMotion),
            exit = optionsExit(reduceMotion),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                RecordSection(
                    slot = slot,
                    current = entry,
                    onRecord = { kind, s, absence ->
                        editing = false
                        onRecord(kind, s, absence)
                    },
                )
                TextButton(onClick = { editing = false }, modifier = Modifier.fillMaxWidth()) {
                    Text(text = AujourdhuiCopy.CANCEL)
                }
            }
        }
        AnimatedVisibility(
            visible = !editing,
            enter = answerEnter(reduceMotion),
            exit = answerExit(reduceMotion),
        ) {
            RecordedAnswer(
                parts = slotAnswerParts(entry),
                announce = announce,
                onModifier = { editing = true },
                modifierFocus = modifierFocus,
            )
        }
    }
}

// SPEC 11.2 ETAT A - the day is still running; a quiet, uncoloured strip, no spinner. "Saisir maintenant" reveals
// the manual record options for a person who does not want to wait for the evening proposal.
@Composable
private fun DetectingBlock(
    slot: Slot,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    var manualOpen by rememberSaveable(slot) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radius.md))
                    .background(LightColors.surface)
                    .padding(Spacing.space16),
            verticalArrangement = Arrangement.spacedBy(Spacing.space4),
        ) {
            Text(text = DetectionCopy.DETECTING_TITLE, style = FrontierType.bodyM)
            Text(
                text = DetectionCopy.DETECTING_SUBTITLE,
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
        }
        if (manualOpen) {
            RecordSection(slot, null, onRecord)
        } else {
            TextButton(onClick = { manualOpen = true }, modifier = Modifier.fillMaxWidth()) {
                Text(text = DetectionCopy.ENTER_NOW)
            }
        }
    }
}

// SPEC 11.2 ETAT B - the proposal (R314). Phrased as a proposal to verify; Confirmer records it as detected on this
// slot, Corriger reveals the full record options and records the person's choice as a correction (R202).
@Composable
private fun ProposalCard(
    proposedKind: RecordedKind,
    slot: Slot,
    actions: AutoActions,
) {
    var correcting by rememberSaveable(slot) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = DetectionCopy.PROPOSAL_HEADING, style = FrontierType.bodyM)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radius.xl))
                    .background(LightColors.surface)
                    .padding(Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space8),
        ) {
            Text(text = DetectionCopy.PROPOSAL_TITLE, style = FrontierType.caption, color = LightColors.textSecondary)
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SideDot(proposedKind)
                Text(text = kindLabel(proposedKind), style = FrontierType.h3)
            }
            Text(
                text = DetectionCopy.proposalExplain(proposedKind.name),
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
            Text(
                text = DetectionCopy.PROPOSAL_DETECTED_NOTE,
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
        }
        Button(
            onClick = { actions.onConfirmDetected(proposedKind, slot) },
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = DetectionCopy.CONFIRM)
        }
        OutlinedButton(
            onClick = { correcting = !correcting },
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = DetectionCopy.CORRECT)
        }
        if (correcting) {
            // Corriger offers the full record options; whatever the person picks is recorded as a CORRECTION on this
            // slot, keeping what detection had proposed (R202). It routes through onCorrectDetected, not onRecord.
            RecordSection(
                slot = slot,
                current = null,
                onRecord = { kind, s, absence -> actions.onCorrectDetected(kind, s, absence, proposedKind) },
            )
        }
        Text(text = DetectionCopy.NOTHING_RECORDED_YET, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}

// SPEC 11.2 ETAT B withheld (R312): the not-sure message, then the manual record options so the person can enter the
// slot themselves. Calm, never alarming, never a percentage (R27).
@Composable
private fun NotSureBlock(
    slot: Slot,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Text(text = DetectionCopy.NOT_SURE, style = FrontierType.bodyM)
        RecordSection(slot, null, onRecord)
    }
}

// An 8 dp France-blue / Switzerland-red dot - which side, never a flag, never colour alone (the label carries the
// meaning). DESIGN-SYSTEM: "6-8 px dots and chips only".
@Composable
private fun SideDot(kind: RecordedKind) {
    val color = if (kind == RecordedKind.SUISSE) LightColors.switzerlandMain else LightColors.franceMain
    Box(
        modifier =
            Modifier
                .size(Spacing.space8)
                .clip(RoundedCornerShape(Radius.pill))
                .background(color),
    )
}

private fun kindLabel(kind: RecordedKind): String =
    when (kind) {
        RecordedKind.SUISSE -> AujourdhuiCopy.SUISSE
        else -> AujourdhuiCopy.DOMICILE
    }
