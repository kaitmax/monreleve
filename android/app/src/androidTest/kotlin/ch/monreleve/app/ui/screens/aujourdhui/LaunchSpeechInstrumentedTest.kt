package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.AutoDayState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DetectionCopy
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.LoggingMode
import org.junit.Rule
import org.junit.Test

/**
 * AN-LAUNCH-SPEECH (R702). OPENING THE APP ON AN ANSWERED DAY ANNOUNCES NOTHING; ANSWERING STILL DOES.
 *
 * AN-TALKBACK's R642-F1, reproduced 11 of 11 launches here (R700): on main's HEAD, opening the app on a day whose
 * two halves are answered makes the screen reader speak « Matin : En Suisse, Après-midi : Domicile, Enregistré »
 * before anything is touched; 2458dbe spoke it in 0 of 11. R701 named the cause: the Compose 1.7.6 / Material3
 * 1.3.1 patch move (2458dbe with ONLY composeBom 2024.12.01 speaks it 11 of 11). Under it, a live region that
 * APPEARS - the recorded answer arriving with the repository's first emission, after the controller's first frame
 * (AujourdhuiController.firstFrame: today, no entries) - is now announced, where 1.7.0 announced it never.
 *
 * The answer's live region exists to confirm what the person JUST DID (ChoiceCard's RecordedAnswer, R434). A day
 * that was already answered when the screen opened is not news, so its answer is not a live region; the answer a
 * tap produces is. What is asserted is the semantics on that first composition - the one place the library's
 * change can be met from this code - and, the other way round, that a tap's answer is still polite.
 *
 * THE LOAD IS REPRODUCED AS THE CONTROLLER PRODUCES IT: the screen composes the first frame (no entries), then the
 * state is replaced from OUTSIDE the screen, as the repository's first emission replaces it - no callback fires.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate compiles but does not run (the gate's own
 * stated limit, as for HalfDayChoiceInstrumentedTest). The report records the device run.
 */
class LaunchSpeechInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private var state by mutableStateOf(AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY))

    private val polite = SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite)

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
                            onConfirmDetected = { kind, slot -> state = state.with(slot, entry(kind, null)) },
                        ),
                )
            }
        }
        composeRule.waitForIdle()
    }

    /** The repository's first emission: the same day, now with its recorded rows. Nothing on screen was touched. */
    private fun load(answered: AujourdhuiState) {
        state = answered
        composeRule.waitForIdle()
    }

    /** Every live region on screen that holds [text] - the recorded answer's column, when it is one. */
    private fun liveRegionsHolding(text: String) =
        composeRule.onAllNodes(polite.and(hasAnyDescendant(hasText(text))), useUnmergedTree = true)

    @Test
    fun bothHalvesAnsweredBeforeTheScreenOpenedAreNotALiveRegion() {
        val firstFrame = AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY)
        host(firstFrame)

        load(firstFrame.copy(morning = entry(RecordedKind.SUISSE), afternoon = entry(RecordedKind.DOMICILE)))

        // Presence first (R169): the answer is ON SCREEN - its own « Modifier » - so the zero below is not an empty
        // screen's zero.
        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).assertExists()
        liveRegionsHolding(MORNING_SUISSE).assertCountEquals(0)
    }

    @Test
    fun aWholeDayAnsweredBeforeTheScreenOpenedIsNotALiveRegion() {
        val firstFrame = AujourdhuiState(today = TODAY, granularity = GranularityChoice.DAY)
        host(firstFrame)

        load(firstFrame.copy(fullDay = entry(RecordedKind.DOMICILE)))

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).assertExists()
        liveRegionsHolding(DOMICILE_DAY).assertCountEquals(0)
    }

    @Test
    fun anAutoDayRecordedBeforeTheScreenOpenedIsNotALiveRegion() {
        val firstFrame =
            AujourdhuiState(today = TODAY, granularity = GranularityChoice.DAY, loggingMode = LoggingMode.AUTO_DETECT)
        host(firstFrame)

        load(firstFrame.copy(fullDay = entry(RecordedKind.DOMICILE)))

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).assertExists()
        liveRegionsHolding(DOMICILE_DAY).assertCountEquals(0)
    }

    // THE OTHER DIRECTION - without it, removing the live region everywhere would pass every test above.

    @Test
    fun theAnswerATapProducesIsStillPolite() {
        host(AujourdhuiState(today = TODAY, granularity = GranularityChoice.DAY))

        composeRule.onNodeWithText(AujourdhuiCopy.DOMICILE).performClick()

        liveRegionsHolding(DOMICILE_DAY).assertCountEquals(1)
    }

    @Test
    fun aLoadedAnswerCorrectedThroughModifierIsPolite() {
        val firstFrame = AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY)
        host(firstFrame)
        load(firstFrame.copy(morning = entry(RecordedKind.SUISSE), afternoon = entry(RecordedKind.DOMICILE)))

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()
        // Both halves reopen. The morning's « Domicile » is the first; once the morning settles, the afternoon's
        // « En Suisse » is the only one left.
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()
        composeRule.onAllNodesWithText(AujourdhuiCopy.SUISSE)[0].performClick()

        liveRegionsHolding(MORNING_DOMICILE).assertCountEquals(1)
    }

    @Test
    fun anAutoProposalConfirmedIsPolite() {
        host(
            AujourdhuiState(
                today = TODAY,
                granularity = GranularityChoice.DAY,
                loggingMode = LoggingMode.AUTO_DETECT,
                auto = AutoDayState.ToConfirm(RecordedKind.DOMICILE),
            ),
        )

        composeRule.onNodeWithText(DetectionCopy.CONFIRM).performClick()
        // The controller drops the proposal once the slot is recorded (AujourdhuiState.auto: "null ... when recorded").
        state = state.copy(auto = null)
        composeRule.waitForIdle()

        liveRegionsHolding(DOMICILE_DAY).assertCountEquals(1)
    }

    private companion object {
        const val TODAY = "2026-06-15"
        val MORNING_SUISSE =
            AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, AujourdhuiCopy.kindLabel(RecordedKind.SUISSE.name, null))
        val MORNING_DOMICILE =
            AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, AujourdhuiCopy.kindLabel(RecordedKind.DOMICILE.name, null))
        val DOMICILE_DAY = AujourdhuiCopy.kindLabel(RecordedKind.DOMICILE.name, null)

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
