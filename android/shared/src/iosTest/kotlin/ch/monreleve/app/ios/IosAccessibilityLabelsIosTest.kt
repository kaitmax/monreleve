package ch.monreleve.app.ios

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.ComparisonCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.SimulationCopy
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.pilot.FIXTURE_DOSSIER
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-AUDIT R1355. EVERY CONTROL A PERSON CAN ACTIVATE CARRIES A LABEL, ON EVERY SCREEN iOS DRAWS - through the real
// shell (R204). What VoiceOver speaks for a Compose control is its semantics label: the merged Text, a content
// description, or a field's text. A clickable node with none of them is a control VoiceOver can reach and cannot name.
// So on each screen - Bienvenue (signed out), the four tabs (Aujourd'hui, Calendrier, Relevé, Paramètres), the Rythme,
// Prévision and Simulation overlays, and the employer comparison - every node with a click action, in the MERGED tree
// (what an assistive service is handed), is asserted to carry a non-blank label; and the four tabs are asserted to be
// clickable by their own labels. That these semantics REACH UIAccessibility on the simulator is measured separately,
// from the walk's captured accessibility trees (REPORT-IOS-AUDIT R1355) - not assumed here.

private const val ACCOUNT = "this-install"
private const val COMPARED_YEAR = 2025

@OptIn(ExperimentalTestApi::class)
class IosAccessibilityLabelsIosTest {
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

    /** Every clickable node of the merged tree with no label at all, described by its role and bounds. */
    private fun ComposeUiTest.unlabelledControls(): List<String> =
        onAllNodes(hasClickAction()).fetchSemanticsNodes().filter { node ->
            val config = node.config
            val text = config.getOrNull(SemanticsProperties.Text).orEmpty().joinToString(" ") { it.text }
            val description = config.getOrNull(SemanticsProperties.ContentDescription).orEmpty().joinToString(" ")
            val edited = config.getOrNull(SemanticsProperties.EditableText)?.text.orEmpty()
            (text + description + edited).isBlank()
        }.map { "role=${it.config.getOrNull(SemanticsProperties.Role)} at ${it.boundsInRoot}" }

    private fun ComposeUiTest.assertEveryControlLabelled(screen: String) {
        waitForIdle()
        val missing = unlabelledControls()
        assertTrue(missing.isEmpty(), "R1355 $screen: controls with no accessibility label: $missing")
    }

    private fun ComposeUiTest.selectTab(label: String) {
        waitFor("the tab $label") { clickable(label) }
        onAllNodes(hasText(label) and hasClickAction()).onFirst().performClick()
    }

    @Test
    fun r1355bienvenueEveryControlIsLabelled() =
        runComposeUiTest {
            val rig = ShellRig(marked = true, pair = null, pendingAddress = null, account = null, settings = null)
            try {
                setShellContent(rig)
                waitFor("Bienvenue") { clickable(WelcomeCopy.START) }
                assertEveryControlLabelled("Bienvenue")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1355theFourTabsAndEveryScreenBehindThemAreLabelled() =
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
            try {
                runBlocking {
                    rig.shell.rhythmRepository.save(
                        WeeklyRhythm(
                            RhythmKind.SUISSE,
                            RhythmKind.DOMICILE,
                            RhythmKind.SUISSE,
                            RhythmKind.DOMICILE,
                            RhythmKind.SUISSE,
                        ),
                    )
                }
                setShellContent(rig)
                waitFor("Aujourd'hui") { shows(AujourdhuiCopy.QUESTION) }
                for (tab in listOf(NavCopy.AUJOURDHUI, NavCopy.CALENDRIER, NavCopy.RELEVE, NavCopy.PARAMETRES)) {
                    assertTrue(clickable(tab), "R1355: the tab \"$tab\" is a control named by its own label")
                }
                assertEveryControlLabelled("Aujourd'hui")

                selectTab(NavCopy.CALENDRIER)
                waitFor("Calendrier selected") {
                    onAllNodes(hasText(NavCopy.CALENDRIER) and isSelected()).fetchSemanticsNodes().isNotEmpty()
                }
                assertEveryControlLabelled("Calendrier")

                selectTab(NavCopy.RELEVE)
                waitFor("the Relevé's document") { shows(ReleveCopy.TITLE) }
                assertEveryControlLabelled("Relevé")

                selectTab(NavCopy.PARAMETRES)
                waitFor("Paramètres") { clickable(ParametresCopy.SIGN_OUT) }
                assertEveryControlLabelled("Paramètres")

                tap(RythmeCopy.TITLE)
                waitFor("Rythme") { shows(RythmeCopy.weeklyDomicile(2)) }
                assertEveryControlLabelled("Rythme")

                tap(RythmeCopy.VIEW_FORECAST)
                waitFor("Prévision") { shows(PrevisionCopy.TITLE) }
                assertEveryControlLabelled("Prévision")

                tap(PrevisionCopy.TEST_CHANGE)
                waitFor("Simulation") { shows(SimulationCopy.TITLE) }
                assertEveryControlLabelled("Simulation")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1355theEmployerComparisonIsLabelled() =
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
            try {
                setShellContent(rig)
                selectTab(NavCopy.RELEVE)
                val year = ReleveCopy.yearLabel(COMPARED_YEAR)
                waitFor("the Relevé offers $COMPARED_YEAR") { clickable(year) }
                tap(year)
                waitFor("the Relevé shows $COMPARED_YEAR") {
                    onAllNodes(hasText(year) and isSelected()).fetchSemanticsNodes().isNotEmpty()
                }
                waitForIdle()
                tap(ReleveCopy.COMPARE_EMPLOYER)
                waitFor("the comparison") { shows(ComparisonCopy.employerRateLabel(COMPARED_YEAR)) }
                assertEveryControlLabelled("the employer comparison")
            } finally {
                rig.close()
            }
        }
}
