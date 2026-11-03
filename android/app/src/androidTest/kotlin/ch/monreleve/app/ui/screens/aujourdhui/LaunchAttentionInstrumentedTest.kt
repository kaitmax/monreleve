package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.Motion
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.onboarding.GranularityChoice
import org.junit.Rule
import org.junit.Test

/**
 * AN-LAUNCH-ATTENTION (R763). OPENING THE APP ON A HALF-ANSWERED DAY IS NOT A TRANSITION.
 *
 * AN-LAUNCH-SPEECH's UNNUMBERED-1, reproduced on the phone (R761): opening the app on a day whose MORNING is answered
 * and whose afternoon is not makes the screen reader speak the attention line « Matin enregistré. Après-midi : à
 * renseigner. » before anything is touched - on 2458dbe as on main, so it is not the Compose patch move R702 met.
 * The cause is in this code: the controller's first frame has no entries (AujourdhuiController.firstFrame), both
 * halves are open, then the repository's rows arrive and the afternoon becomes the ONE still-open half.
 * rememberHalfAttention read that as the within-session transition R434 designed it for: the afternoon's heading
 * became a polite live region and took focus.
 *
 * The attention line exists to answer what the person JUST DID (HalfDayChoiceCard.kt, R434). A day that was half
 * answered when the screen opened is not news. What is asserted is the semantics, on the load and after a tap:
 * whether the heading is a live region, and whether it requested focus. The heading's NAME is kept either way - it
 * is what the screen reader reads when it is navigated to (AN-LAUNCH-SPEECH's H1 reading, stop 7) - so every
 * negative case checks its presence first (R169).
 *
 * THE LOAD IS REPRODUCED AS THE CONTROLLER PRODUCES IT, as in LaunchSpeechInstrumentedTest: the first frame (no
 * entries), then the state replaced from OUTSIDE the screen - no callback fires. THE CLOCK IS ADVANCED past the
 * focus request's delay (Motion.standardMillis) before anything about focus is asserted, so "not focused" cannot be
 * an effect that simply had not fired yet.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate compiles but does not run (the gate's stated
 * limit, as for HalfDayChoiceInstrumentedTest). The report records the device run.
 */
class LaunchAttentionInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private var state by mutableStateOf(AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY))

    private val polite = SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite)

    /** The afternoon's heading while it is the one still-open half: named by the attention line. */
    private val attentionLine = hasContentDescription(AFTERNOON_REMAINS)

    /** The screen as the activity hosts it; a tap records into the test's state as the controller would. */
    private fun host(first: AujourdhuiState) {
        state = first
        composeRule.setContent {
            FrontierTheme {
                AujourdhuiScreen(
                    state = state,
                    actions =
                        AujourdhuiActions(
                            onRecord = { kind, slot, absence -> state = state.with(slot, entry(kind, absence)) },
                        ),
                )
            }
        }
        settle()
    }

    /** The repository's first emission: the same day, now with its recorded rows. Nothing on screen was touched. */
    private fun load(answered: AujourdhuiState) {
        state = answered
        settle()
    }

    /** Past the focus request's delay and every 200 ms motion, so an effect that would fire HAS fired. */
    private fun settle() {
        composeRule.waitForIdle()
        composeRule.mainClock.advanceTimeBy(SETTLE_MS)
        composeRule.waitForIdle()
    }

    private fun halfDayFirstFrame() = AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY)

    private fun loadMorningAnswered() {
        val firstFrame = halfDayFirstFrame()
        host(firstFrame)
        load(firstFrame.copy(morning = entry(RecordedKind.SUISSE)))
    }

    @Test
    fun aMorningAnsweredBeforeTheScreenOpenedIsNotALiveRegion() {
        loadMorningAnswered()

        // Presence first (R169): the heading is on screen and still NAMED by the attention line - the name a navigated
        // stop reads - so the zero below is not an empty screen's zero.
        composeRule.onNode(attentionLine, useUnmergedTree = true).assertExists()
        composeRule.onAllNodes(attentionLine.and(polite), useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun aMorningAnsweredBeforeTheScreenOpenedDoesNotTakeFocus() {
        loadMorningAnswered()

        // Still focusable (the node keeps its shape: it carries a Focused value), and not focused.
        composeRule
            .onNode(attentionLine, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Focused))
            .assertIsNotFocused()
    }

    // THE OTHER DIRECTION - the design (R434), and the positive control: without it, removing the live region and the
    // focus request everywhere would pass both tests above.

    @Test
    fun theMorningATapAnswersMakesTheAttentionLinePoliteAndFocused() {
        host(halfDayFirstFrame())

        // Both halves open: the morning's « Domicile » is the first.
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()
        settle()

        composeRule.onNode(attentionLine, useUnmergedTree = true).assert(polite).assertIsFocused()
    }

    @Test
    fun aLoadedMorningReopenedThenCancelledComesBackAsATransition() {
        // « Modifier » then « Annuler » makes the afternoon the one open half AGAIN, by the person's own taps - a
        // within-session transition, which main announces and focuses. The load must not take that away.
        loadMorningAnswered()

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()
        settle()
        composeRule.onNodeWithText(AujourdhuiCopy.CANCEL).performClick()
        settle()

        composeRule.onNode(attentionLine, useUnmergedTree = true).assert(polite).assertIsFocused()
    }

    private companion object {
        const val TODAY = "2026-06-15"

        /** Past Motion.standardMillis (the focus request's delay) with room for the enter/exit motion. */
        val SETTLE_MS = Motion.standardMillis.toLong() * 5

        val AFTERNOON_REMAINS =
            AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.MORNING, AujourdhuiCopy.AFTERNOON)

        fun entry(
            kind: RecordedKind,
            absence: AbsenceChoice? = null,
        ) = DayEntry(kind = kind, absence = absence, pending = false, failed = false)

        fun AujourdhuiState.with(
            slot: Slot,
            entry: DayEntry,
        ): AujourdhuiState =
            when (slot) {
                Slot.FULL -> copy(fullDay = entry)
                Slot.MORNING -> copy(morning = entry)
                Slot.AFTERNOON -> copy(afternoon = entry)
            }
    }
}
