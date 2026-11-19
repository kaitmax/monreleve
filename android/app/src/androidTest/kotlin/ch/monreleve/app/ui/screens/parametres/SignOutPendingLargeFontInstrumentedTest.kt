package ch.monreleve.app.ui.screens.parametres

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.text.formatDate
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.SignOutPrompt
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * AN-SHARED-FIXES (R1090). AT 200 % FONT, THE DAYS THE SIGN-OUT IS ABOUT TO LOSE ARE REACHABLE.
 *
 * C5's N2 (Queue Ruling 8): the renderer's signOutPendingDialogLarge stopped at « 2 journées n'ont pas pu être
 * envoyées : » - the dates and the loss sentence cut - while « Se déconnecter quand même » was still offered.
 * SignOutStillPendingDialog's body had no scroll, so the warning Text was laid out in whatever height was left and
 * clipped there; DeleteDialog's body scrolls.
 *
 * WHAT IS ASSERTED IS THE CUT ITSELF (R225: the sentence that answers « which days do I lose » is asserted at the
 * surface that asks), not a substring that happens to be on screen: the warning is ONE Text holding the count, the
 * dates and the loss sentence, and it is partly visible either way, so assertExists/assertIsDisplayed would pass on
 * the defect. The test asks (1) that the Text was laid out whole - its layout did not overflow the height it was
 * given - and (2) that its last line can be brought on screen, by scrolling the dialog body if it is not already
 * visible.
 *
 * THE CONTROL. The same assertions at the system's 100 % scale pass on the unfixed dialog, so a RED at 200 % is the
 * font scale's, not this harness's.
 *
 * THE SCALE IS THE SYSTEM'S, set through `settings put system font_scale` before the activity starts and restored
 * after - the setting a person changes. A LocalDensity override would not reach the dialog: a Compose Dialog is its
 * own window whose view re-provides LocalDensity from its context.
 *
 * IT RUNS ON A DEVICE (am instrument), which the JVM gate compiles but does not run (the gate's own stated limit,
 * as for LaunchSpeechInstrumentedTest). The report records the run and labels it: emulator API 36.
 */
class SignOutPendingLargeFontInstrumentedTest {
    @get:Rule
    val composeRule = createEmptyComposeRule()

    @Test
    fun atTwoHundredPercentTheWarningIsWholeAndReachable() {
        withFontScale(LARGE) { assertWarningReachable() }
    }

    @Test
    fun controlAtOneHundredPercentTheWarningIsWholeAndReachable() {
        withFontScale(NORMAL) { assertWarningReachable() }
    }

    private fun assertWarningReachable() {
        // Presence first (R169): the dialog is up and still offers the way out that loses the days.
        composeRule.onNodeWithText(ParametresCopy.SIGN_OUT_ANYWAY).assertIsDisplayed()
        val warning = composeRule.onNodeWithText(WARNING, useUnmergedTree = true)
        warning.assertIsDisplayed()

        // (1) The Text was laid out whole: nothing of it was cut by the height it was given.
        assertFalse(
            "the warning naming the days to be lost was cut: its text overflows the height the dialog gave it",
            layoutOf(warning).didOverflowHeight,
        )

        // (2) Its last line can be brought on screen.
        if (!bottomVisible(warning)) {
            val body = composeRule.onNode(hasScrollAction().and(hasAnyDescendant(hasText(WARNING))))
            val range = body.fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange]
            body.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, range.maxValue() - range.value()) }
            composeRule.waitForIdle()
        }
        assertTrue("the warning's last line cannot be brought on screen", bottomVisible(warning))
        // ...and its first line can be brought back.
        warning.performScrollToIfScrollable()
        val node = warning.fetchSemanticsNode()
        assertTrue(
            "the warning's first line cannot be brought on screen",
            node.boundsInRoot.top <= node.positionInRoot.y + 1f,
        )
    }

    private fun SemanticsNodeInteraction.performScrollToIfScrollable() {
        val scrollable = composeRule.onAllNodes(hasScrollAction().and(hasAnyDescendant(hasText(WARNING))))
        if (scrollable.fetchSemanticsNodes().isNotEmpty()) performScrollTo()
        composeRule.waitForIdle()
    }

    private fun layoutOf(node: SemanticsNodeInteraction): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        return results.single()
    }

    /** The node's clipped bottom reaches its unclipped bottom: its last line is not cut by any ancestor. */
    private fun bottomVisible(node: SemanticsNodeInteraction): Boolean {
        val semantics = node.fetchSemanticsNode()
        val unclippedBottom = semantics.positionInRoot.y + semantics.size.height
        return semantics.boundsInRoot.bottom >= unclippedBottom - 1f
    }

    /** Sets the system font scale, waits for this process to see it, hosts the dialog, and always restores. */
    private fun withFontScale(
        scale: Float,
        block: () -> Unit,
    ) {
        val previous = shell("settings get system font_scale").trim()
        try {
            shell("settings put system font_scale $scale")
            awaitFontScale(scale)
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    activity.setContent {
                        FrontierTheme {
                            Surface(
                                modifier = Modifier.fillMaxSize(),
                                color = MaterialTheme.colorScheme.background,
                            ) {
                                ParametresScreen(
                                    state = PENDING_STATE,
                                    actions = NOOP_ACTIONS,
                                    appVersion = APP_VERSION,
                                )
                            }
                        }
                    }
                }
                composeRule.waitForIdle()
                block()
            }
        } finally {
            val restore =
                if (previous == "null" || previous.isEmpty()) {
                    "delete system font_scale"
                } else {
                    "put system font_scale $previous"
                }
            shell("settings $restore")
        }
    }

    private fun awaitFontScale(scale: Float) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val deadline = System.currentTimeMillis() + SCALE_WAIT_MS
        while (context.resources.configuration.fontScale != scale) {
            check(System.currentTimeMillis() < deadline) {
                "the system font scale did not reach $scale (still ${context.resources.configuration.fontScale})"
            }
            Thread.sleep(POLL_MS)
        }
    }

    private fun shell(command: String): String =
        InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command).let { fd ->
            android.os.ParcelFileDescriptor.AutoCloseInputStream(fd).bufferedReader().use { it.readText() }
        }

    private companion object {
        const val LARGE = 2f
        const val NORMAL = 1f
        const val SCALE_WAIT_MS = 10_000L
        const val POLL_MS = 100L
        const val APP_VERSION = "1.0.0"

        /** The renderer's two days (ParametresScreenScreenshotTest.PENDING_DATES). */
        val PENDING_DATES = listOf("2026-06-02", "2026-06-03")

        /** Derived from the copy the dialog renders (R181): count, dates and the loss sentence, one Text. */
        val WARNING =
            ParametresCopy.stillPendingWarning(
                PENDING_DATES.size,
                ParametresCopy.dateList(PENDING_DATES.map(::formatDate)),
            )

        val PENDING_STATE =
            ParametresState(
                canton = Canton.GE,
                employmentRate = "100",
                denominator = DenominatorChoice.SIMPLIFIED240,
                exactTotalWorkDays = "",
                granularity = GranularityChoice.DAY,
                activityStartDate = "",
                signOutPrompt = SignOutPrompt(pendingDates = PENDING_DATES),
            )

        val NOOP_ACTIONS =
            ParametresActions(
                onCantonChange = {},
                onEmploymentRateChange = {},
                onDenominatorChange = {},
                onExactTotalChange = {},
                onGranularityChange = {},
                onActivityStartDateChange = {},
                onSave = {},
                onConfirmRateChange = {},
                onCancelRateChange = {},
                onExportJson = {},
                onExportCsv = {},
                onRequestSignOut = {},
                onConfirmSignOut = {},
                onCancelSignOut = {},
                onRequestDelete = {},
                onConfirmDelete = {},
                onCancelDelete = {},
                onAcknowledgeDelete = {},
                onOpenLegal = {},
                onToggleAutoDetection = {},
                onToggleEveningNotification = {},
            )
    }
}
