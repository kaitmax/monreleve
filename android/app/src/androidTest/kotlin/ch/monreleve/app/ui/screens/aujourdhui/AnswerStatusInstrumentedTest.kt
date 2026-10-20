package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import ch.monreleve.app.R
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.kindIconResKey
import ch.monreleve.app.design.statusIconResKey
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.onboarding.GranularityChoice
import org.junit.Rule
import org.junit.Test

/**
 * AN-POLISH (R435). THE SYNC LINE'S GLYPH, one test per status state, ASSERTED BY DRAWABLE RESOURCE.
 *
 * DESIGN-SYSTEM section 1: « STATUS IS NEVER COLOUR ALONE: colour + icon + text, always ». Until AN-POLISH
 * this line was colour + text - the rule's substance met (three different sentences) and its letter not.
 * These three tests are what makes the letter true and keeps it true.
 *
 * THE EXPECTED DRAWABLE IS A LITERAL R.drawable.*, NEVER answerStatus() (R171). A test that asked the
 * production mapping which glyph to expect would restate it and pass on any mapping at all. These lines ARE
 * the assertion that a day the server has not got yet shows a clock.
 *
 * IT RUNS ON A DEVICE (connectedDebugAndroidTest), which the JVM gate COMPILES but does not run.
 */
class AnswerStatusInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    private fun host(entry: DayEntry) {
        composeRule.setContent {
            FrontierTheme {
                AujourdhuiScreen(
                    state =
                        AujourdhuiState(
                            today = TODAY,
                            granularity = GranularityChoice.DAY,
                            fullDay = entry,
                        ),
                    actions = AujourdhuiActions(onRecord = { _, _, _ -> }),
                )
            }
        }
    }

    private fun entry(
        pending: Boolean,
        failed: Boolean,
    ) = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = pending, failed = failed)

    private fun assertStatus(
        words: String,
        drawable: Int,
    ) {
        composeRule.onNodeWithText(words).assertIsDisplayed()
        composeRule
            .onAllNodes(SemanticsMatcher.expectValue(statusIconResKey, drawable), useUnmergedTree = true)
            .assertCountEquals(1)
    }

    @Test
    fun aDayStillOnThePhoneShowsAClockBesideItsWords() {
        host(entry(pending = true, failed = false))
        assertStatus(AujourdhuiCopy.PENDING, R.drawable.ic_clock)
    }

    @Test
    fun aDayTheServerHoldsShowsATickBesideItsWords() {
        host(entry(pending = false, failed = false))
        assertStatus(AujourdhuiCopy.SYNCED, R.drawable.ic_circle_check)
    }

    @Test
    fun aDayTheServerRefusedShowsATriangleBesideItsWords() {
        host(entry(pending = false, failed = true))
        assertStatus(AujourdhuiCopy.SYNC_FAILED, R.drawable.ic_triangle_alert)
    }

    /**
     * R432 / the two-key argument in design/StatusIconSemantics.kt, made checkable. The kind glyph and the
     * status glyph are on different rows, carry different resources, and are written under DIFFERENT
     * semantics keys - so a test can tell « the clock is on screen » from « the clock was drawn where the
     * kind belongs », which a single shared key could not.
     */
    @Test
    fun theKindGlyphAndTheStatusGlyphAreDistinctAndNeitherWearsTheOthersKey() {
        host(entry(pending = true, failed = false))
        composeRule
            .onAllNodes(
                SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_building_2),
                useUnmergedTree = true,
            ).assertCountEquals(1)
        composeRule
            .onAllNodes(SemanticsMatcher.expectValue(kindIconResKey, R.drawable.ic_clock), useUnmergedTree = true)
            .assertCountEquals(0)
        composeRule
            .onAllNodes(
                SemanticsMatcher.expectValue(statusIconResKey, R.drawable.ic_building_2),
                useUnmergedTree = true,
            ).assertCountEquals(0)
    }

    private companion object {
        const val TODAY = "2026-06-15"
    }
}
