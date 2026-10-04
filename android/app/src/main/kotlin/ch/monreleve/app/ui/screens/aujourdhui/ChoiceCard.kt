package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
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

// AN-HOME section 1. The operator's main request: the choice CLOSES into the answer once a day is recorded,
// instead of the options staying on screen. One white card (1 px border, no shadow - DESIGN-SYSTEM "Borders
// preferred"): BEFORE a choice it holds the options; AFTER the tap it holds one compact answer line and a
// « Modifier » text button. « Modifier » reopens the options with the current choice marked; « Annuler »
// closes them again without writing (the record callback is the only writer - D16 is untouched).
//
// MOTION (ChoiceMotion.kt) is the design system's, never an invented number: the options fade + the card
// height shrinks to the answer over the 200 ms standard duration, no bounce; reopening is the reverse. With
// Android's "Remove animations" on the change is INSTANT, nothing left half-drawn. NO CELEBRATION
// (DESIGN-SYSTEM section 2): the confirmation IS the answer appearing.
//
// ACCESSIBILITY: the answer is a POLITE live region, so TalkBack announces it when the options close; focus
// lands on « Modifier » on that close (best-effort, after the enter settles), never lost.
//
// STATE (R310): whether the options are open for editing survives rotation, a text-size change, dark mode and
// a background kill - rememberSaveable, Bundle-backed like every other state on this screen (AN-STATE).

/** The white card the choice and its answer both live in: 1 px border, token radius, no shadow. */
@Composable
internal fun ChoiceSurface(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
    ) {
        content()
    }
}

/**
 * The manual choice card (SPEC 11.2, AN5b flow re-presented). DAY shows one slot; HALF_DAY shows the morning
 * and the afternoon, each recorded on its own slot. The day is "complete" when every slot is recorded; it then
 * closes into the answer line until « Modifier » reopens it.
 */
@Composable
internal fun ChoiceCard(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val complete =
        when (state.granularity) {
            GranularityChoice.DAY -> state.fullDay != null
            GranularityChoice.HALF_DAY -> state.morning != null && state.afternoon != null
        }
    var editing by rememberSaveable { mutableStateOf(false) }
    val showOptions = !complete || editing
    val reduceMotion = rememberReduceMotion()

    val modifierFocus = remember { FocusRequester() }
    // NOT saveable: a config change restores focus itself, so this only fires on a within-session close.
    var optionsWereOpen by remember { mutableStateOf(showOptions) }
    LaunchedEffect(showOptions) {
        if (!showOptions && optionsWereOpen) {
            if (!reduceMotion) delay(Motion.standardMillis.toLong())
            runCatching { modifierFocus.requestFocus() }
        }
        optionsWereOpen = showOptions
    }

    ChoiceSurface(modifier) {
        AnimatedVisibility(
            visible = showOptions,
            enter = optionsEnter(reduceMotion),
            exit = optionsExit(reduceMotion),
        ) {
            ChoiceOptions(
                state = state,
                onRecord = { kind, slot, absence ->
                    // DAY: a single tap completes the day AND closes. HALF_DAY: completion (both halves) or
                    // « Annuler » drives the close, so a mid-edit tap on one half keeps the editor open.
                    if (state.granularity == GranularityChoice.DAY) editing = false
                    onRecord(kind, slot, absence)
                },
                showCancel = complete && editing,
                onCancel = { editing = false },
            )
        }
        AnimatedVisibility(
            visible = !showOptions,
            enter = answerEnter(reduceMotion),
            exit = answerExit(reduceMotion),
        ) {
            RecordedAnswer(
                parts = dayAnswerParts(state),
                onModifier = { editing = true },
                modifierFocus = modifierFocus,
            )
        }
    }
}

@Composable
private fun ChoiceOptions(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    showCancel: Boolean,
    onCancel: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        if (state.granularity == GranularityChoice.HALF_DAY) {
            Text(text = AujourdhuiCopy.MORNING, style = FrontierType.bodyM)
            RecordSection(Slot.MORNING, state.morning, onRecord)
            Text(text = AujourdhuiCopy.AFTERNOON, style = FrontierType.bodyM)
            RecordSection(Slot.AFTERNOON, state.afternoon, onRecord)
        } else {
            RecordSection(Slot.FULL, state.fullDay, onRecord)
        }
        if (showCancel) {
            TextButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
                Text(text = AujourdhuiCopy.CANCEL)
            }
        }
    }
}

/** The answer a recorded day (or slot) closes into: the kind, the sync truth, the provenance, and « Modifier ». */
@Composable
internal fun RecordedAnswer(
    parts: AnswerParts,
    onModifier: () -> Unit,
    modifierFocus: FocusRequester,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        Text(text = parts.primary, style = FrontierType.bodyM)
        Text(
            text = parts.status,
            style = FrontierType.caption,
            color = if (parts.failed) LightColors.error else LightColors.textSecondary,
        )
        parts.provenance?.let { Text(text = it, style = FrontierType.caption, color = LightColors.textSecondary) }
        TextButton(onClick = onModifier, modifier = Modifier.fillMaxWidth().focusRequester(modifierFocus)) {
            Text(text = AujourdhuiCopy.MODIFIER)
        }
    }
}

/** The three strings the answer shows, plus whether the sync failed (so the status reads in the error colour). */
internal data class AnswerParts(
    val primary: String,
    val status: String,
    val failed: Boolean,
    val provenance: String?,
)

private fun statusText(
    pending: Boolean,
    failed: Boolean,
): String =
    when {
        failed -> AujourdhuiCopy.SYNC_FAILED
        pending -> AujourdhuiCopy.PENDING
        else -> AujourdhuiCopy.SYNCED
    }

/** One recorded slot's answer parts (DAY mode, and each auto slot). */
internal fun slotAnswerParts(entry: DayEntry): AnswerParts =
    AnswerParts(
        primary = AujourdhuiCopy.kindLabel(entry.kind.name, entry.absence?.name),
        status = statusText(entry.pending, entry.failed),
        failed = entry.failed,
        provenance = DetectionCopy.provenanceLine(entry.provenance.name),
    )

/**
 * The day-level answer parts: one kind for DAY, both halves joined for HALF_DAY (R292 - never one label). The
 * answer is only ever rendered when the day is complete, so requireNotNull documents that invariant rather than
 * a defensive fallback (an expression body, so there is no explicit-return count to exceed).
 */
private fun dayAnswerParts(state: AujourdhuiState): AnswerParts =
    if (state.granularity == GranularityChoice.DAY) {
        slotAnswerParts(requireNotNull(state.fullDay))
    } else {
        val am = requireNotNull(state.morning)
        val pm = requireNotNull(state.afternoon)
        AnswerParts(
            primary =
                AujourdhuiCopy.answerHalfDay(
                    AujourdhuiCopy.kindLabel(am.kind.name, am.absence?.name),
                    AujourdhuiCopy.kindLabel(pm.kind.name, pm.absence?.name),
                ),
            status = statusText(am.pending || pm.pending, am.failed || pm.failed),
            failed = am.failed || pm.failed,
            // A detection provenance only when both halves agree; a mixed pair (one manual) carries none.
            provenance =
                if (am.provenance == pm.provenance) DetectionCopy.provenanceLine(am.provenance.name) else null,
        )
    }
