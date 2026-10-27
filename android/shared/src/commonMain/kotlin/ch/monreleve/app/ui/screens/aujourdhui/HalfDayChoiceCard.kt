package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Motion
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import kotlinx.coroutines.delay

// IOS-1b-A R604: MOVED FROM :app to :shared commonMain (package unchanged) - Aujourd'hui is one shared screen,
// hosted by Android's activity and by the iOS pilot.

// AN-POLISH (R434). THE ANSWERED HALF SETTLES, THE OTHER COMES TO YOU.
//
// Until AN-POLISH, answering « Matin » in half-day mode changed ONE BUTTON'S FILL and nothing else: the
// question stayed, both halves' options stayed, and « Après-midi » sat below the fold. To someone who does not
// know the mode, the button looked dead - which is exactly what the operator reported (AN-ANSWER-ICON's Q1,
// answered: the product behaved as designed, so the DESIGN is what changes).
//
// NOW: the answered half closes into ITS OWN answer line - the kind glyph, « Matin : Domicile », and a
// « Modifier » for that half alone - with the card's EXISTING close motion (ChoiceMotion.kt's tokens, no new
// animation, instant under "Remove animations"). The unanswered half stays open, is brought into view, and
// receives accessibility focus, and TalkBack announces once, politely, which half was recorded and which
// remains (AujourdhuiCopy.halfRecordedAnnouncement - the one home, R206).
//
// WHEN BOTH ARE ANSWERED the card closes into the existing two-line RecordedAnswer exactly as
// AN-ANSWER-ICON left it, with ONE « Modifier » that reopens BOTH halves. The per-half « Modifier » is the one
// shown while the other half is still open, and it reopens THAT half only.
//
// WHOLE-DAY MODE DOES NOT COME THROUGH HERE AT ALL (DayChoiceCard, ChoiceCard.kt), which is what makes
// "whole-day is unchanged" a structural fact rather than a claim about a branch.
//
// STATE (R310): which half is open survives rotation and a background kill - two rememberSaveable booleans,
// Bundle-backed like every other state on this screen.

/** One half of the card: its slot, its heading, what it holds, and whether its options are open. */
private class HalfSlot(
    val slot: Slot,
    val heading: String,
    val entry: DayEntry?,
    val open: Boolean,
)

/** The three taps a half answers. Bundled so each block stays inside the parameter budget. */
private class HalfActions(
    val onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    val onCancel: (Slot) -> Unit,
    val onModifier: (Slot) -> Unit,
)

/**
 * What the ONE still-open half gets when the other has just been answered (R434): brought into view,
 * accessibility focus, and the polite announcement naming both halves. Null for every other half, and null
 * while both are open - there is nothing to announce and nothing to move to.
 */
@OptIn(ExperimentalFoundationApi::class)
private class HalfAttention(
    val focus: FocusRequester,
    val bringIntoView: BringIntoViewRequester,
    val announcement: String,
)

@Composable
internal fun HalfDayChoiceCard(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    modifier: Modifier = Modifier,
) {
    // R310: which half is open for editing survives a rebuild. A half with no entry is open by definition;
    // these flags only say whether an ALREADY ANSWERED half has been reopened by « Modifier ».
    var editingMorning by rememberSaveable { mutableStateOf(false) }
    var editingAfternoon by rememberSaveable { mutableStateOf(false) }
    val morningOpen = state.morning == null || editingMorning
    val afternoonOpen = state.afternoon == null || editingAfternoon
    val reduceMotion = rememberReduceMotion()
    val modifierFocus = remember { FocusRequester() }
    // AN-LAUNCH-SPEECH (R648, ChoiceCard.kt): the complete answer is a live region only when a tap HERE recorded a
    // half. NOT saveable - two halves answered before this composition (a launch) are not announced.
    var answeredHere by remember { mutableStateOf(false) }

    val attention = rememberHalfAttention(morningOpen, afternoonOpen, reduceMotion)
    val actions =
        HalfActions(
            onRecord = { kind, slot, absence ->
                // R434: the answered half settles. D16 is untouched - the callback below is still the only
                // writer, and this only closes the half the tap answered.
                if (slot == Slot.MORNING) editingMorning = false else editingAfternoon = false
                answeredHere = true
                onRecord(kind, slot, absence)
            },
            onCancel = { slot -> if (slot == Slot.MORNING) editingMorning = false else editingAfternoon = false },
            onModifier = { slot -> if (slot == Slot.MORNING) editingMorning = true else editingAfternoon = true },
        )

    ChoiceSurface(modifier) {
        AnimatedVisibility(
            visible = morningOpen || afternoonOpen,
            enter = optionsEnter(reduceMotion),
            exit = optionsExit(reduceMotion),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                HalfBlock(
                    HalfSlot(Slot.MORNING, AujourdhuiCopy.MORNING, state.morning, morningOpen),
                    actions,
                    reduceMotion,
                    attention.takeIf { morningOpen && !afternoonOpen },
                )
                HalfBlock(
                    HalfSlot(Slot.AFTERNOON, AujourdhuiCopy.AFTERNOON, state.afternoon, afternoonOpen),
                    actions,
                    reduceMotion,
                    attention.takeIf { afternoonOpen && !morningOpen },
                )
            }
        }
        AnimatedVisibility(
            visible = !morningOpen && !afternoonOpen,
            enter = answerEnter(reduceMotion),
            exit = answerExit(reduceMotion),
        ) {
            // Both answered: the card closes into the existing two-line answer, unchanged from
            // AN-ANSWER-ICON, and its « Modifier » reopens BOTH halves.
            RecordedAnswer(
                parts = halfDayAnswerParts(state),
                announce = answeredHere,
                onModifier = {
                    editingMorning = true
                    editingAfternoon = true
                },
                modifierFocus = modifierFocus,
            )
        }
    }
}

/**
 * The attention the one still-open half receives, and the effect that moves to it. It fires only on a
 * WITHIN-SESSION transition into that state: a rebuild restores focus itself, and a card restored with one
 * half already answered must not steal focus from wherever the person was (the same reasoning
 * ChoiceCard's own `optionsWereOpen` flag carries, which is why neither is saveable).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun rememberHalfAttention(
    morningOpen: Boolean,
    afternoonOpen: Boolean,
    reduceMotion: Boolean,
): HalfAttention {
    val focus = remember { FocusRequester() }
    val bringIntoView = remember { BringIntoViewRequester() }
    val lonely: Slot? =
        when {
            morningOpen && !afternoonOpen -> Slot.MORNING
            afternoonOpen && !morningOpen -> Slot.AFTERNOON
            else -> null
        }
    var previous by remember { mutableStateOf(lonely) }
    LaunchedEffect(lonely) {
        if (lonely != null && previous == null) {
            if (!reduceMotion) delay(Motion.standardMillis.toLong())
            runCatching { bringIntoView.bringIntoView() }
            runCatching { focus.requestFocus() }
        }
        previous = lonely
    }
    val announcement =
        if (lonely == Slot.MORNING) {
            AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.AFTERNOON, AujourdhuiCopy.MORNING)
        } else {
            AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.MORNING, AujourdhuiCopy.AFTERNOON)
        }
    return HalfAttention(focus, bringIntoView, announcement)
}

/**
 * One half: its options while it is open, its own answer line once it is answered. The transition between the
 * two is the card's existing motion (ChoiceMotion.kt), so the half settles exactly the way the whole card
 * does - and is instant under "Remove animations".
 */
@Composable
private fun HalfBlock(
    half: HalfSlot,
    actions: HalfActions,
    reduceMotion: Boolean,
    attention: HalfAttention?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        AnimatedVisibility(
            visible = half.open,
            enter = optionsEnter(reduceMotion),
            exit = optionsExit(reduceMotion),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                HalfHeading(half.heading, attention)
                RecordSection(half.slot, half.entry, actions.onRecord)
                // « Annuler » belongs to a half REOPENED for editing: it closes that half back onto the
                // answer it already holds, writing nothing. A half with no entry has nothing to go back to.
                if (half.entry != null) {
                    TextButton(
                        onClick = { actions.onCancel(half.slot) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(text = AujourdhuiCopy.CANCEL)
                    }
                }
            }
        }
        AnimatedVisibility(
            visible = !half.open,
            enter = answerEnter(reduceMotion),
            exit = answerExit(reduceMotion),
        ) {
            half.entry?.let { entry ->
                HalfAnswer(half.heading, entry) { actions.onModifier(half.slot) }
            }
        }
    }
}

/**
 * The open half's heading. When it is the one still-open half (R434) it carries the move: brought into view,
 * focusable so accessibility focus can land on it, and a POLITE live region whose accessible name is the
 * announcement - one node doing all three, so there is no zero-size announcer to believe in. The visible word
 * is inside the spoken sentence, so the name still contains the label.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HalfHeading(
    heading: String,
    attention: HalfAttention?,
) {
    if (attention == null) {
        Text(text = heading, style = FrontierType.bodyM)
        return
    }
    Text(
        text = heading,
        style = FrontierType.bodyM,
        modifier =
            Modifier
                .bringIntoViewRequester(attention.bringIntoView)
                .focusRequester(attention.focus)
                .focusable()
                .semantics {
                    liveRegion = LiveRegionMode.Polite
                    contentDescription = attention.announcement
                },
    )
}

/** An answered half, closed: its glyph, « Matin : Domicile », and a « Modifier » for this half alone. */
@Composable
private fun HalfAnswer(
    heading: String,
    entry: DayEntry,
    onModifier: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        AnswerKindLine(
            AnswerLine(
                label =
                    AujourdhuiCopy.halfLabel(
                        heading,
                        AujourdhuiCopy.kindLabel(entry.kind.name, entry.absence?.name),
                    ),
                icon = kindIcon(entry.kind),
            ),
        )
        TextButton(onClick = onModifier, modifier = Modifier.fillMaxWidth()) {
            Text(text = AujourdhuiCopy.MODIFIER)
        }
    }
}
