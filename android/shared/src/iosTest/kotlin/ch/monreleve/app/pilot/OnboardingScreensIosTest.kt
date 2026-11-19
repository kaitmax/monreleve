package ch.monreleve.app.pilot

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.onboarding.readyPeriod
import ch.monreleve.app.onboarding.swissDate
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.onboarding.PretScreen
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-2b R781. THE SHARED ONBOARDING, COMPOSED AND DRIVEN ON THE iOS SIMULATOR, THROUGH EVERY STEP, OVER FAKES.
//
// The wizard and its controller that moved to commonMain, hosted the way MainActivity's OnboardingRoute hosts them
// (the controller's state -> OnboardingScreen, READY -> PretScreen), with the REAL controller over an in-memory
// saver and store: no server, no account, no address. The PATCH /me encoder is this file's (`patch:` + the Settings) -
// iOS's real one is IOS-1b-B's (R784).
//
// THE R776 SEAM, PROVEN WITH NO iosMain CODE: the period step's date picker is a slot, and this test fills it with a
// fake - two buttons, one that cancels and one that picks a fixed ISO day - so the shared screen's side of the
// contract (compose the slot while asked; onPicked(an ISO day); onDismiss() to close) is exercised on iOS. Strings
// are read from fr/ and the expected values derived from the shared formatters, never retyped (R181).

private const val TAX_YEAR = 2026
private const val NAME = "Camille Martin"
private const val PICKED = "2026-03-02"
private const val FAKE_PICK = "fake picker: pick"
private const val FAKE_CANCEL = "fake picker: cancel"
private const val TIMEOUT = 10_000L

private class MemorySaver : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return PostOutcome.Ok(200, "{}")
    }
}

private class MemoryStore : SettingsStore {
    var saved: Settings? = null

    override fun load(): Settings? = saved

    override fun save(settings: Settings) {
        saved = settings
    }

    override fun clear() {
        saved = null
    }
}

private fun fakeBody(settings: Settings): String = "patch:$settings"

/** The R776 slot, filled by the test: cancel closes with nothing picked; pick reports PICKED, then closes. */
@Composable
private fun FakeStartDatePicker(
    onPicked: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    TextButton(onClick = onDismiss) { Text(FAKE_CANCEL) }
    TextButton(onClick = {
        onPicked(PICKED)
        onDismiss()
    }) { Text(FAKE_PICK) }
}

/** MainActivity's OnboardingRoute, reduced to its calls: the same controller, the same screens, the same hand-offs. */
@Composable
private fun OnboardingHost(
    saver: MemorySaver,
    store: MemoryStore,
    onDone: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val controller =
        remember {
            OnboardingController(saver, store, TAX_YEAR, scope, patchBody = ::fakeBody, onModeSaved = {})
        }
    val state by controller.state.collectAsState()
    FrontierTheme {
        if (state.phase == OnboardingPhase.READY) {
            store.load()?.let { PretScreen(settings = it, taxYear = TAX_YEAR, onContinue = onDone) }
        } else {
            OnboardingScreen(
                state = state,
                actions =
                    OnboardingActions(
                        onNameChange = controller::onNameChange,
                        onCantonChange = controller::onCantonChange,
                        onRateChoiceChange = controller::onRateChoiceChange,
                        onCustomRateChange = controller::onCustomRateChange,
                        onDenominatorChange = controller::onDenominatorChange,
                        onExactTotalChange = controller::onExactTotalChange,
                        onGranularityChange = controller::onGranularityChange,
                        onAllYearChange = controller::onAllYearChange,
                        onActivityStartDateChange = controller::onActivityStartDateChange,
                        onChooseManual = { controller.onModeChange(ModeChoice.MANUAL) },
                        onChooseAuto = {},
                        onReminderYes = {
                            controller.onReminderChange(true)
                            controller.next()
                        },
                        onReminderNo = {
                            controller.onReminderChange(false)
                            controller.next()
                        },
                        onNext = controller::next,
                        onBack = controller::back,
                    ),
                startDatePicker = { onPicked, onDismiss -> FakeStartDatePicker(onPicked, onDismiss) },
            )
        }
    }
}

@OptIn(ExperimentalTestApi::class)
class OnboardingScreensIosTest {
    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    /** Tap the first clickable node with this text, scrolled into view first when it sits in the step's scroll. */
    private fun SemanticsNodeInteractionsProvider.tap(label: String) = tapFirst(hasText(label) and hasClickAction())

    private fun SemanticsNodeInteractionsProvider.tapFirst(matcher: SemanticsMatcher) {
        val node = onAllNodes(matcher).onFirst()
        try {
            node.performScrollTo()
        } catch (expectedOutsideAScroll: AssertionError) {
            // the bottom actions (Continuer, Pas maintenant) are outside the scroll; nothing to scroll
        }
        node.performClick()
    }

    @Test
    fun everyStepIsAnsweredThePeriodThroughTheSeamAndTheSummaryShowsWhatWasSaved() =
        runComposeUiTest {
            val saver = MemorySaver()
            val store = MemoryStore()
            var done = false
            setContent { OnboardingHost(saver, store, onDone = { done = true }) }

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.NAME_TITLE) }
            onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(NAME)
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.CANTON_TITLE) }
            tap(CantonCopy.name(Canton.GE))
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.RATE_TITLE) }
            tap(OnboardingCopy.RATE_80)
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.METHOD_LABEL) }
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.GRANULARITY_TITLE) }
            tap(OnboardingCopy.CONTINUE)

            // THE PERIOD STEP, THROUGH THE SEAM: part of the year; the picker opened and CANCELLED (nothing picked, so
            // the controller refuses the step); opened again and a day PICKED, which the field then shows Swiss.
            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.PERIOD_TITLE) }
            tap(OnboardingCopy.PERIOD_PART_TITLE)
            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.PERIOD_START_LABEL) }
            assertTrue(!shows(FAKE_PICK), "the picker slot is not composed until it is asked for")
            tapFirst(hasText("") and hasClickAction()) // the start-date field, still empty
            waitUntil(timeoutMillis = TIMEOUT) { shows(FAKE_CANCEL) }
            tap(FAKE_CANCEL)
            waitUntil(timeoutMillis = TIMEOUT) { !shows(FAKE_PICK) }
            tap(OnboardingCopy.CONTINUE)
            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.ERROR_START_DATE_INVALID) }
            tapFirst(hasText("") and hasClickAction()) // the start-date field, still empty
            waitUntil(timeoutMillis = TIMEOUT) { shows(FAKE_PICK) }
            tap(FAKE_PICK)
            waitUntil(timeoutMillis = TIMEOUT) { shows(swissDate(PICKED)) }
            assertTrue(!shows(FAKE_PICK), "onDismiss closed the picker")
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.MODE_TITLE) }
            tap(OnboardingCopy.MODE_MANUAL_TITLE)
            tap(OnboardingCopy.CONTINUE)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.REMINDER_TITLE) }
            tap(OnboardingCopy.REMINDER_NOT_NOW)

            waitUntil(timeoutMillis = TIMEOUT) { shows(OnboardingCopy.READY_TITLE) }
            val expected =
                Settings(
                    canton = "GE",
                    employmentRate = 80,
                    denominatorKind = "SIMPLIFIED240",
                    exactTotalWorkDays = null,
                    granularity = "DAY",
                    activityStartDate = PICKED,
                    name = NAME,
                    loggingMode = null,
                    detectionConsent = null,
                )
            assertEquals(listOf(fakeBody(expected)), saver.bodies)
            assertEquals(expected, store.saved)
            assertTrue(shows(readyPeriod(PICKED, TAX_YEAR)), "the summary shows the picked period")
            tap(OnboardingCopy.CONTINUE)
            waitUntil(timeoutMillis = TIMEOUT) { done }
        }
}
