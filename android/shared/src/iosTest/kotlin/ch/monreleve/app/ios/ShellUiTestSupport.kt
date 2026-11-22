package ch.monreleve.app.ios

import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.pilot.waitBounded

// IOS-SHELL-2. The few moves every shell iosTest makes - read a text, tap a labelled control, wait with a bound
// (waitBounded, R807 - never the library's raw wait), open a tab - in one place, so the tests read as their flows.

internal const val SHELL_UI_TIMEOUT = 20_000L

internal fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
    onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

internal fun SemanticsNodeInteractionsProvider.clickable(text: String): Boolean =
    onAllNodes(hasText(text) and hasClickAction()).fetchSemanticsNodes().isNotEmpty()

@OptIn(ExperimentalTestApi::class)
internal fun ComposeUiTest.waitFor(
    what: String,
    condition: () -> Boolean,
) = waitBounded(what, SHELL_UI_TIMEOUT, condition)

/** Taps the first clickable node labelled [text], scrolled into view first when it sits in a scrolling container. */
@OptIn(ExperimentalTestApi::class)
internal fun ComposeUiTest.tap(text: String) {
    waitFor("a control labelled \"$text\"") { clickable(text) }
    val node = onAllNodes(hasText(text) and hasClickAction()).onFirst()
    // performScrollTo refuses a node with no scrolling parent (a dialog's or a sheet's button): it needs no scroll.
    runCatching { node.performScrollTo() }
    node.performClick()
}

/** Taps the bottom bar's Paramètres tab, once the bar is drawn. */
@OptIn(ExperimentalTestApi::class)
internal fun ComposeUiTest.openParametres() {
    waitFor("the bottom bar") { clickable(NavCopy.PARAMETRES) }
    onAllNodes(hasText(NavCopy.PARAMETRES) and hasClickAction()).onFirst().performClick()
}
