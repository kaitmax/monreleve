package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
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
 * AN-ANSWER-ICON (R433). The operator's report was about a TAP: « Domicile » or « En Suisse », and then
 * nothing. R429 proved on the S9 that the card does close on main; this is the regression guard for that
 * property, plus the proof that the answer it closes into carries the icon of what was answered (R430).
 *
 * IT DRIVES AujourdhuiScreen, NOT ChoiceCard (R204: the entry point is the unit under test). The screen is
 * stateless by contract, so the test owns the state and applies the record callback the way
 * AujourdhuiController does - and what is under test, whether the options close and what the answer shows,
 * is entirely the screen's.
 *
 * THE EXPECTED DRAWABLE IS A LITERAL R.drawable.*, NEVER kindIcon() (R171). A test that asked the production
 * mapping which glyph to expect would restate it and pass on any mapping at all. These lines ARE the
 * assertion that « Domicile » shows a house.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate COMPILES but does not run - the gate's
 * own stated limit. The report records the device run and its counts.
 */
class AnswerIconInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private var writes = 0

    /** Shown only while the question is open, so its absence is what "the card closed" means. */
    private val optionsOnly = AujourdhuiCopy.ABSENCE

    /**
     * Render the screen over a state the test owns, applying each record the way AujourdhuiController does:
     * one slot, one entry, pending until a sync that never happens here.
     */
    private fun host(initial: AujourdhuiState) {
        composeRule.setContent {
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
    }

    private fun dayState() = AujourdhuiState(today = TODAY, granularity = GranularityChoice.DAY)

    private fun assertClosedInto(
        label: String,
        drawable: Int,
    ) {
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(0)
        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).assertIsDisplayed()
        composeRule.onNodeWithText(label).assertIsDisplayed()
        composeRule
            .onNode(SemanticsMatcher.expectValue(kindIconResKey, drawable), useUnmergedTree = true)
            .assertExists()
    }

    @Test
    fun domicileClosesIntoItsAnswerAndAHouse() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.DOMICILE).performClick()
        assertClosedInto(AujourdhuiCopy.kindLabel(RecordedKind.DOMICILE.name, null), R.drawable.ic_house)
    }

    @Test
    fun suisseClosesIntoItsAnswerAndABuilding() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.SUISSE).performClick()
        assertClosedInto(AujourdhuiCopy.kindLabel(RecordedKind.SUISSE.name, null), R.drawable.ic_building_2)
    }

    @Test
    fun missionFranceClosesIntoItsAnswerAndABriefcase() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.MISSION).performClick()
        composeRule.onNodeWithText(AujourdhuiCopy.MISSION_FRANCE).performClick()
        assertClosedInto(AujourdhuiCopy.kindLabel(RecordedKind.MISSION_FRANCE.name, null), R.drawable.ic_briefcase)
    }

    @Test
    fun missionThirdStateClosesIntoItsAnswerAndAPlane() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.MISSION).performClick()
        composeRule.onNodeWithText(AujourdhuiCopy.MISSION_THIRD).performClick()
        assertClosedInto(AujourdhuiCopy.kindLabel(RecordedKind.MISSION_THIRD.name, null), R.drawable.ic_plane)
    }

    @Test
    fun anAbsenceClosesIntoItsReasonAndAStruckOutCalendar() {
        host(dayState())
        composeRule.onNodeWithText(optionsOnly).performClick()
        composeRule.onNodeWithText(AujourdhuiCopy.absenceLabel(AbsenceChoice.CONGE.name)).performClick()
        val label = AujourdhuiCopy.kindLabel(RecordedKind.ABSENCE.name, AbsenceChoice.CONGE.name)
        assertClosedInto(label, R.drawable.ic_calendar_x)
    }

    @Test
    fun modifierReopensTheOptionsWithTheCurrentChoiceMarked() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.DOMICILE).performClick()
        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()

        composeRule.onNodeWithText(optionsOnly).assertIsDisplayed()
        composeRule.onNodeWithText(AujourdhuiCopy.DOMICILE).assertIsSelected()
        composeRule.onNodeWithText(AujourdhuiCopy.SUISSE).assertIsNotSelected()
    }

    @Test
    fun annulerClosesTheOptionsAgainWithoutWriting() {
        host(dayState())
        composeRule.onNodeWithText(AujourdhuiCopy.DOMICILE).performClick()
        val afterRecord = writes
        composeRule.onNodeWithText(AujourdhuiCopy.MODIFIER).performClick()
        composeRule.onNodeWithText(AujourdhuiCopy.CANCEL).performClick()

        assertClosedInto(AujourdhuiCopy.kindLabel(RecordedKind.DOMICILE.name, null), R.drawable.ic_house)
        assertEquals(CANCEL_WRITES_NOTHING, afterRecord, writes)
    }

    @Test
    fun aSplitHalfDayShowsBothGlyphsEachBesideItsOwnHalf() {
        host(AujourdhuiState(today = TODAY, granularity = GranularityChoice.HALF_DAY))
        // Index 0 is the morning's own option while BOTH halves are open. AN-POLISH (R434) changed what
        // follows: the answered half now SETTLES, so only the afternoon's options remain and its « En
        // Suisse » is the only one left - where this used to read assertCountEquals(2) and [1]. R434 owns
        // that behaviour (HalfDayChoiceInstrumentedTest); this test keeps its own claim, which is that a
        // split half-day ends up showing BOTH glyphs, each beside the words of its own half (R430).
        composeRule.onAllNodesWithText(AujourdhuiCopy.DOMICILE)[0].performClick()
        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(1)
        composeRule.onNodeWithText(AujourdhuiCopy.SUISSE).performClick()

        composeRule.onAllNodesWithText(optionsOnly).assertCountEquals(0)
        composeRule
            .onNode(SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_house), useUnmergedTree = true)
            .assertExists()
        composeRule
            .onNode(SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_building_2), useUnmergedTree = true)
            .assertExists()
    }

    private companion object {
        const val TODAY = "2026-06-15"
        const val CANCEL_WRITES_NOTHING =
            "« Annuler » must write nothing - the record callback is the only writer (D16)"
    }
}
