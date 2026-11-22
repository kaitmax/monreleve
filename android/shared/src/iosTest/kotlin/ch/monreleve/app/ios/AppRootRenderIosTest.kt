package ch.monreleve.app.ios

import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.design.Glyph
import ch.monreleve.app.design.navIconResKey
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.pilot.waitBounded
import ch.monreleve.app.ui.shell.AppBottomBar
import ch.monreleve.app.ui.shell.AppRoot
import ch.monreleve.app.ui.shell.AppTab
import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-SHELL-1 (R1326; iOS Ruling 11 Q3). THE RENDER PROOF: AppRoot WITH THE BOTTOM BAR, DRAWN ON THE iOS SIMULATOR.
//
// The bar moved to commonMain in 5a (IOS-MOVE-CORE) and nothing rendered it on iOS. This draws AppRoot around a
// Scaffold
// whose bottom bar is the common AppBottomBar - the bar IosMainShell hosts - selects each tab in turn, and asserts:
//   - the four glyphs RESOLVE: each icon node carries its glyph's id (navIconRes, design/NavIconSemantics.kt), which on
//     iOS is the Glyph's ordinal (glyphSemanticsId) - and a glyph whose Compose resource were missing would throw at
//     its painter before any id could be read (Glyph.ios.kt);
//   - the selected tab is the one marked selected, and only that one.
// The expected glyphs are the destinations' own (AN10b R293: sun, calendar, file-text, settings), as ordinals.

private val EXPECTED_GLYPHS: Map<AppTab, Glyph> =
    mapOf(
        AppTab.AUJOURDHUI to Glyph.SUN,
        // DELIBERATE RED (R1326): the wrong glyph, expected to fail.
        AppTab.CALENDRIER to Glyph.CALENDAR_CHECK,
        AppTab.RELEVE to Glyph.FILE_TEXT,
        AppTab.PARAMETRES to Glyph.SETTINGS,
    )

private val LABELS: Map<AppTab, String> =
    mapOf(
        AppTab.AUJOURDHUI to NavCopy.AUJOURDHUI,
        AppTab.CALENDRIER to NavCopy.CALENDRIER,
        AppTab.RELEVE to NavCopy.RELEVE,
        AppTab.PARAMETRES to NavCopy.PARAMETRES,
    )

@OptIn(ExperimentalTestApi::class)
class AppRootRenderIosTest {
    @Test
    fun appRootDrawsTheBarWithItsFourGlyphsAndMarksEachSelectedTabInTurn() =
        runComposeUiTest {
            var selected by mutableStateOf(AppTab.AUJOURDHUI)
            setContent {
                AppRoot {
                    Scaffold(bottomBar = { AppBottomBar(selected = selected, onSelect = { selected = it }) }) { }
                }
            }
            for (tab in AppTab.entries) {
                selected = tab
                waitBounded("the bar shows $tab selected", TIMEOUT) { selectedLabels() == listOf(LABELS.getValue(tab)) }
                val glyphIds =
                    onAllNodes(SemanticsMatcher.keyIsDefined(navIconResKey), useUnmergedTree = true)
                        .fetchSemanticsNodes()
                        .map { it.config[navIconResKey] }
                assertEquals(
                    AppTab.entries.map { EXPECTED_GLYPHS.getValue(it).ordinal },
                    glyphIds,
                    "the four bar glyphs, in tab order, by their ids (the ordinal on iOS), with $tab selected",
                )
                assertEquals(listOf(LABELS.getValue(tab)), selectedLabels(), "only $tab is marked selected")
            }
        }

    /** The labels of the bar items marked selected. */
    private fun androidx.compose.ui.test.SemanticsNodeInteractionsProvider.selectedLabels(): List<String> =
        LABELS.values.filter { label ->
            onAllNodes(hasText(label) and hasClickAction())
                .fetchSemanticsNodes()
                .any { it.config.getOrNull(SemanticsProperties.Selected) == true }
        }

    private companion object {
        const val TIMEOUT = 10_000L
    }
}
