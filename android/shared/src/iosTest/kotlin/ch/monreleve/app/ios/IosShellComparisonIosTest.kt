package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.fr.ComparisonCopy
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.text.formatPercent
import ch.monreleve.app.pilot.FIXTURE_DOSSIER
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-SHELL-3 R1372 (iOS Ruling 15 Q1). THE EMPLOYER COMPARISON ON iOS, THROUGH THE SHELL (R204): a figure the person
// typed earlier (R1334's UserDefaults store, written here as a previous visit would have) -> the Relevé, the year the
// server holds with days -> "Comparer avec mon employeur" -> the overlay, showing THAT figure -> a new figure typed,
// read back through a NEW store instance (what a relaunch reads) -> back, to the Relevé.
//
// The year is the one BEFORE the shell's (2025): the current year is refused with an explanation and no field
// (ComparisonCopy.currentYearRefusal), so only a completed year can show a figure. The dossier is the pilot's fixture
// (FIXTURE_DOSSIER, one text, one home - R206) served for whichever year is asked. Every expected text is derived
// (formatPercent, the copy objects), never typed (R181).

private const val ACCOUNT = "this-install"
private const val FIGURE = 41.25
private const val TYPED = 40.5

@OptIn(ExperimentalTestApi::class)
class IosShellComparisonIosTest {
    private fun dossierServer() =
        RecordingTransport(
            route = { request, path ->
                val year = yearOf(request)
                if (request.method.name == "GET" && path == "/api/v1/dossier" && year != null) {
                    HttpResponse(200, FIXTURE_DOSSIER.replace("2026", year.toString()))
                } else {
                    emptyYearAnswer(request, path)
                }
            },
            answer = { method, path ->
                when {
                    method == "GET" && path == "/api/v1/me" -> HttpResponse(200, SHELL_COMPLETE_ME)
                    else -> HttpResponse(200, "{}")
                }
            },
        )

    @Test
    fun r1372TheStoredFigureIsShownInTheComparisonATypedOneIsKeptAndBackCloses() =
        runComposeUiTest {
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = ACCOUNT,
                    settings = SHELL_COMPLETE_SETTINGS,
                    transport = dossierServer(),
                )
            val store = { UserDefaultsEmployerFigureStore(rig.defaults()) { ACCOUNT } }
            try {
                store().save(2025, FIGURE)
                setShellContent(rig)
                waitFor("the bottom bar") { clickable(NavCopy.RELEVE) }
                onAllNodes(hasText(NavCopy.RELEVE) and hasClickAction()).onFirst().performClick()
                waitFor("the Relevé offers the year before, which holds days") {
                    clickable(ReleveCopy.yearLabel(2025))
                }
                tap(ReleveCopy.yearLabel(2025))
                waitFor("the Relevé shows 2025") {
                    onAllNodes(hasText(ReleveCopy.yearLabel(2025)) and isSelected()).fetchSemanticsNodes().isNotEmpty()
                }
                waitForIdle()

                tap(ReleveCopy.COMPARE_EMPLOYER)
                waitFor("the comparison overlay for 2025") { shows(ComparisonCopy.employerRateLabel(2025)) }
                assertTrue(shows(ComparisonCopy.TITLE), "the comparison's own title")
                waitFor("the figure typed on an earlier visit, read from the store") {
                    shows(formatPercent(FIGURE, 2))
                }

                onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(formatPercent(TYPED, 2))
                waitFor("the new figure kept, read back through a NEW store instance") {
                    store().figureFor(2025) == TYPED
                }

                onAllNodes(hasContentDescription(LicencesCopy.BACK) and hasClickAction()).onFirst().performClick()
                waitFor("back closed the overlay onto the Relevé") {
                    !shows(ComparisonCopy.TITLE) && clickable(ReleveCopy.COMPARE_EMPLOYER)
                }
            } finally {
                rig.close()
            }
        }
}
