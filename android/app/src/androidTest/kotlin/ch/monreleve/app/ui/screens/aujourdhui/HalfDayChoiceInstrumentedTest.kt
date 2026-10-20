package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import ch.monreleve.app.R
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.kindIconResKey
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.onboarding.GranularityChoice
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * AN-POLISH (R434). HALF-DAY MODE: THE ANSWERED HALF SETTLES, THE OTHER COMES TO YOU.
 *
 * The behaviour this replaces is the one the operator reported as « nothing happens » (AN-ANSWER-ICON's Q1,
 * answered: the phone was in half-day mode and the product was behaving as designed). Answering « Matin »
 * changed ONE BUTTON'S FILL; the question stayed, both halves' options stayed, « Après-midi » sat below the
 * fold. Every assertion below fails against that card, which is what makes them worth having.
 *
 * IT DRIVES AujourdhuiScreen, NOT HalfDayChoiceCard (R204: the entry point is the unit under test). The
 * screen is stateless by contract, so the test owns the state and applies the record callback the way
 * AujourdhuiController does.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate COMPILES but does not run - the gate's
 * own stated limit. The report records the device run and its counts.
 */
class HalfDayChoiceInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private var writes = 0

    /** Shown once per OPEN half, so counting it is how "that half's options closed" is measured. */
    private val optionsOnly = AujourdhuiCopy.ABSENCE

    @Composable
    private fun Screen(initial: AujourdhuiState) {
        var state by remember { mutableStateOf(initial) }
        FrontierTheme {
            AujourdhuiScreen(
                state = state,
                actions =
                    AujourdhuiActions(
                        onRecord = { kind, slot, absence ->
                            writes += 1
                            val entry = DayEntry(kind = kind, absence = absence, pending = true, failed = false)
                            state =
                                when (slot) {
                                    Slot.FULL -> state.copy(fullDay = entry)
                                    Slot.MORNING -> state.copy(morning = entry)
                                    Slot.AFTERNOON -> state.copy(afternoon = entry)
                                }
                        },
                    ),
            )
        }
    }

    private fun host(initial: AujourdhuiState) {
        composeRule.setContent { Screen(initial) }
    }

    private fun halfDayState() = AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY)

    private fun morningAnswer(kind: RecordedKind) =
        AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, AujourdhuiCopy.kindLabel(kind.name, null))

    private fun afternoonAnswer(kind: RecordedKind) =
        AujourdhuiCopy.halfLabel(AujourdhuiCopy.AFTERNOON, AujourdhuiCopy.kindLabel(kind.name, null))

    /** Tap the FIRST remaining « Domicile » - the morning's while both halves are open. */
    private fun tapFirstDomicile() = composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()

    @Test
    fun answeringTheMorningClosesThatHalfIntoItsOwnAnswerLine() {
        host(halfDayState())
        // Both halves open: two « Déclarer une absence », one per half.
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(TWO_HALVES_OPEN)

        tapFirstDomicile()

        // The morning closed into ITS OWN line - the glyph, « Matin : Domicile », and a « Modifier ».
        composeRule.onNodeWithText(morningAnswer(RecordedKind.DOMICILE)).assertIsDisplayed()
        composeRule
            .onNode(SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_house), useUnmergedTree = true)
            .assertExists()
        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).assertIsDisplayed()
        // ...and exactly ONE half's options remain open.
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(ONE_HALF_OPEN)
    }

    @Test
    fun theUnansweredAfternoonIsStillDisplayedAfterTheMorningSettles() {
        host(halfDayState())
        tapFirstDomicile()

        // assertIsDisplayed, not assertExists: the defect being fixed is a half that EXISTS below the fold.
        composeRule.onNodeWithText(AujourdhuiCopy.AFTERNOON).assertIsDisplayed()
        composeRule.onNodeWithText(AujourdhuiCopy.SUISSE).assertIsDisplayed()
    }

    @Test
    fun theAnsweredHalfIsAnnouncedPolitelyWithTheHalfThatRemains() {
        host(halfDayState())
        tapFirstDomicile()

        val sentence = AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.MORNING, AujourdhuiCopy.AFTERNOON)
        composeRule
            .onNodeWithContentDescription(sentence, useUnmergedTree = true)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
    }

    @Test
    fun bothHalvesAnsweredCloseIntoOneAnswerThatStillAnnouncesBoth() {
        host(halfDayState())
        tapFirstDomicile()
        // Only the afternoon's options are left, so « En Suisse » is unambiguous.
        composeRule.onNodeWithText(AujourdhuiCopy.SUISSE).performClick()

        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(0)
        val morning = morningAnswer(RecordedKind.DOMICILE)
        val afternoon = afternoonAnswer(RecordedKind.SUISSE)
        composeRule.onNodeWithText(morning).assertIsDisplayed()
        composeRule.onNodeWithText(afternoon).assertIsDisplayed()
        // R434: the complete card's live region still announces BOTH halves.
        composeRule
            .onNode(
                SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite),
                useUnmergedTree = true,
            )
            .assert(hasAnyDescendant(hasText(morning)))
            .assert(hasAnyDescendant(hasText(afternoon)))
    }

    @Test
    fun modifierOnOneHalfReopensThatHalfOnlyAndAnnulerClosesItWithoutWriting() {
        host(halfDayState())
        tapFirstDomicile()
        val afterRecord = writes

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()
        // Both halves' options are open again - the morning's reopened, the afternoon's never closed.
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(TWO_HALVES_OPEN)

        composeRule.onNodeWithText(AujourdhuiCopy.CANCEL).performClick()
        composeRule.onNodeWithText(morningAnswer(RecordedKind.DOMICILE)).assertIsDisplayed()
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(ONE_HALF_OPEN)
        assertEquals(CANCEL_WRITES_NOTHING, afterRecord, writes)
    }

    @Test
    fun whichHalfIsOpenSurvivesARebuild() {
        // The morning is ALREADY recorded in the initial state, so the rebuild restores the same day and the
        // only thing under test is whether « Modifier » left that half open (rememberSaveable, R310).
        val recorded =
            halfDayState().copy(
                morning = DayEntry(RecordedKind.DOMICILE, absence = null, pending = true, failed = false),
            )
        val restorer = StateRestorationTester(composeRule)
        restorer.setContent { Screen(recorded) }
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(ONE_HALF_OPEN)

        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(TWO_HALVES_OPEN)

        restorer.emulateSavedInstanceStateRestore()

        // Without rememberSaveable the reopened morning collapses back onto its answer line and the
        // half-made correction is gone.
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(TWO_HALVES_OPEN)
    }

    @Test
    fun anAbsenceAnsweredInOneHalfSettlesWithItsReason() {
        host(halfDayState())
        composeRule.onAllNodesWithText(optionsOnly)[0].performClick()
        composeRule.onAllNodesWithText(AujourdhuiCopy.absenceLabel(AbsenceChoice.CONGE.name))[0].performClick()

        val label =
            AujourdhuiCopy.halfLabel(
                AujourdhuiCopy.MORNING,
                AujourdhuiCopy.kindLabel(RecordedKind.ABSENCE.name, AbsenceChoice.CONGE.name),
            )
        composeRule.onNodeWithText(label).assertIsDisplayed()
        composeRule
            .onNode(SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_calendar_x), useUnmergedTree = true)
            .assertExists()
    }

    private companion object {
        const val TODAY = "2026-06-15"
        const val TWO_HALVES_OPEN = 2
        const val ONE_HALF_OPEN = 1
        const val CANCEL_WRITES_NOTHING =
            "« Annuler » must write nothing - the record callback is the only writer (D16)"
    }
}
