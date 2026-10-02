package ch.monreleve.app.ui.screens.aujourdhui

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.AutoDayState
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DetectionCopy

// AN-AUTO increment 5. The automatic-mode surfaces for Aujourd'hui (SPEC 11.2 ETATS A/B/C, R311-R314), split
// out of AujourdhuiScreen.kt so neither file carries too many composables (the ParametresFields split, same
// reasoning). Stateless (fence 5); every string from fr/ (the no-literal fence). It reuses the manual
// RecordSection (internal) for the "enter it yourself" paths - a detected day can still be edited by hand.
//
// NO ACCURACY CLAIM. Only HIGH surfaces (R311) and the proposal is phrased "Proposition - verifiez"; there is
// no "detection fiable" badge (the beta must not assert reliability it has not measured). D4b's addendum
// confidence dot is deliberately dropped for that reason.

// The cards here are a WHITE surface on the grey canvas (DESIGN-SYSTEM: card #FFFFFF on canvas #F7F8FA), so the
// fill alone delineates them - no explicit 1 px border, which would need a raw .dp the ui/ token fence forbids
// and no border-width token exists. The contrast is the design's own card-vs-canvas contrast.

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

// SPEC 11.2 ETATS A/B/C for automatic mode. ETAT C (a recorded day) shows the recorded row with its
// provenance line - the same RecordSection the manual flow uses, so a detected day can still be edited.
@Composable
internal fun AutoSection(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    onConfirmDetected: (RecordedKind) -> Unit,
    onCorrectDetected: (RecordedKind, Slot, AbsenceChoice?, RecordedKind) -> Unit,
) {
    when {
        state.fullDay != null -> RecordSection(Slot.FULL, state.fullDay, onRecord) // ETAT C
        state.auto is AutoDayState.ToConfirm ->
            ProposalCard(state.auto.kind, onConfirmDetected, onCorrectDetected)
        state.auto is AutoDayState.NotSure -> NotSureBlock(onRecord)
        state.auto is AutoDayState.Detecting -> DetectingBlock(onRecord)
        else -> ManualSection(state, onRecord) // a half-day record, or defensive
    }
}

// SPEC 11.2 ETAT A - the day is still running; a quiet, uncoloured strip, no spinner. "Saisir maintenant"
// reveals the manual record options for a person who does not want to wait for the evening proposal.
@Composable
private fun DetectingBlock(onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit) {
    var manualOpen by rememberSaveable { mutableStateOf(false) }
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
            RecordSection(Slot.FULL, null, onRecord)
        } else {
            TextButton(onClick = { manualOpen = true }, modifier = Modifier.fillMaxWidth()) {
                Text(text = DetectionCopy.ENTER_NOW)
            }
        }
    }
}

// SPEC 11.2 ETAT B - the proposal (R314). Phrased as a proposal to verify; Confirmer records it as detected,
// Corriger reveals the full record options and records the person's choice as a correction (R202).
@Composable
private fun ProposalCard(
    proposedKind: RecordedKind,
    onConfirmDetected: (RecordedKind) -> Unit,
    onCorrectDetected: (RecordedKind, Slot, AbsenceChoice?, RecordedKind) -> Unit,
) {
    var correcting by rememberSaveable { mutableStateOf(false) }
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
            onClick = { onConfirmDetected(proposedKind) },
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
            // Corriger offers the full record options; whatever the person picks is recorded as a CORRECTION,
            // keeping what detection had proposed (R202). It routes through onCorrectDetected, not onRecord.
            RecordSection(
                slot = Slot.FULL,
                current = null,
                onRecord = { kind, slot, absence -> onCorrectDetected(kind, slot, absence, proposedKind) },
            )
        }
        Text(text = DetectionCopy.NOTHING_RECORDED_YET, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}

// SPEC 11.2 ETAT B withheld (R312): the not-sure message, then the manual record options so the person can
// enter the day themselves. Calm, never alarming, never a percentage (R27).
@Composable
private fun NotSureBlock(onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Text(text = DetectionCopy.NOT_SURE, style = FrontierType.bodyM)
        RecordSection(Slot.FULL, null, onRecord)
    }
}

// An 8 dp France-blue / Switzerland-red dot - which side, never a flag, never colour alone (the label carries
// the meaning). DESIGN-SYSTEM: "6-8 px dots and chips only".
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
