package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.MeView
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2b R778. THE ONBOARDING CONTROLLER AND ITS PLAN, PINNED BEFORE THEY MOVE (the R768 way).
//
// Written in :app's test scope (R457) against the controller as it stood, green there, red on a verified plant
// (R180), then `git mv`-ed UNEDITED to :shared commonTest with the controller. kotlin.test and
// kotlinx-coroutines-test only, so it compiles in commonTest and runs on the JVM and the iOS simulator.
//
// THE BODY. The PATCH /me body is made by the encoder the controller is handed (org.json's mePatchBody on Android,
// which stays in :app - MeWire.kt, PARK-D3). This pin hands in `"patch:" + settings` - Settings is a data class, so
// its toString is the same on every platform - and asserts the saver received exactly that for the expected
// Settings, and that the store holds exactly that Settings: the WHOLE saved object is pinned, field by field. The
// org.json body itself stays pinned by OnboardingControllerTest in :app, unedited.
//
// THE START DATE. Every string OnboardingDatesPinTest says the check refuses is refused HERE too, through the
// controller's own trim + check, at the period step - R777's coverage of the controller line it could not reach.

private const val TAX_YEAR = 2026
private val ALL_STEPS =
    listOf(
        OnboardingStep.NOM,
        OnboardingStep.CANTON,
        OnboardingStep.TAUX,
        OnboardingStep.METHODE,
        OnboardingStep.GRANULARITY,
        OnboardingStep.PERIODE,
        OnboardingStep.MODE,
        OnboardingStep.RAPPEL,
    )

private class PinSaver(private val outcome: PostOutcome) : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return outcome
    }
}

private class PinStore : SettingsStore {
    var saved: Settings? = null

    override fun load(): Settings? = saved

    override fun save(settings: Settings) {
        saved = settings
    }

    override fun clear() {
        saved = null
    }
}

// AN-MANUAL-REMINDER (R1145): the body now also takes the opt-in; this pin keeps its settings-only bytes - the opt-in
// it carries is OnboardingReminderOptInTest's to assert.
@Suppress("UnusedParameter")
private fun pinBody(
    settings: Settings,
    reminderEnabled: Boolean? = null,
): String = "patch:$settings"

private fun pinController(
    scope: CoroutineScope,
    saver: SettingsSaver,
    store: SettingsStore,
    restored: OnboardingSnapshot? = null,
    onModeSaved: (LoggingMode) -> Unit = {},
): OnboardingController =
    OnboardingController(
        saver,
        store,
        TAX_YEAR,
        scope,
        restored,
        patchBody = ::pinBody,
        onModeSaved = onModeSaved,
        onReminderSaved = {},
    )

/** Walk NOM..PERIODE with valid answers; the start date (null = the whole year) is the variable. */
private fun OnboardingController.answerUpToThePeriod(startDate: String?) {
    onNameChange("Camille Martin")
    next()
    onCantonChange(Canton.GE)
    next()
    onRateChoiceChange(RateChoice.R80)
    next()
    onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
    next()
    onGranularityChange(GranularityChoice.DAY)
    next()
    if (startDate == null) onAllYearChange(true) else onActivityStartDateChange(startDate)
    next()
}

private val MANUAL_WHOLE_YEAR =
    Settings(
        canton = "GE",
        employmentRate = 80,
        denominatorKind = "SIMPLIFIED240",
        exactTotalWorkDays = null,
        granularity = "DAY",
        activityStartDate = null,
        name = "Camille Martin",
        loggingMode = null,
        detectionConsent = null,
    )

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingControllerPinTest {
    @Test
    fun theFullFlowWalksTheEightStepsInOrderAndSavesOnce() =
        runTest {
            val saver = PinSaver(PostOutcome.Ok(200, "{}"))
            val store = PinStore()
            val c = pinController(this, saver, store)
            assertEquals(ALL_STEPS, c.state.value.steps)
            val seen = mutableListOf(c.state.value.step)
            c.onNameChange("  Camille Martin  ")
            c.next()
            seen += c.state.value.step
            c.onCantonChange(Canton.GE)
            c.next()
            seen += c.state.value.step
            c.onRateChoiceChange(RateChoice.R80)
            c.next()
            seen += c.state.value.step
            c.next()
            seen += c.state.value.step
            c.next()
            seen += c.state.value.step
            c.next()
            seen += c.state.value.step
            c.onChooseManualForPin()
            c.next()
            seen += c.state.value.step
            assertEquals(ALL_STEPS, seen)
            c.onReminderChange(false)
            c.next()
            assertEquals(OnboardingPhase.SUBMITTING, c.state.value.phase)
            advanceUntilIdle()
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertEquals(listOf(pinBody(MANUAL_WHOLE_YEAR)), saver.bodies)
            assertEquals(MANUAL_WHOLE_YEAR, store.saved)
            assertNull(c.state.value.error)
        }

    @Test
    fun automaticHalfDaysRealDaysAndAMidYearStartAreAllSaved() =
        runTest {
            val saver = PinSaver(PostOutcome.Ok(200, "{}"))
            val store = PinStore()
            val c = pinController(this, saver, store)
            c.onNameChange("Alex Dupont")
            c.next()
            c.onCantonChange(Canton.VD)
            c.next()
            c.onCustomRateChange(" 75 ")
            c.next()
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.onExactTotalChange(" 220 ")
            c.next()
            c.onGranularityChange(GranularityChoice.HALF_DAY)
            c.next()
            c.onActivityStartDateChange(" 2026-07-01 ")
            c.next()
            c.onModeChange(ModeChoice.AUTO_DETECT)
            c.next()
            c.onReminderChange(true)
            c.next()
            advanceUntilIdle()
            val expected =
                Settings(
                    canton = "VD",
                    employmentRate = 75,
                    denominatorKind = "EXACT",
                    exactTotalWorkDays = 220,
                    granularity = "HALF_DAY",
                    activityStartDate = "2026-07-01",
                    name = "Alex Dupont",
                    loggingMode = "AUTO_DETECT",
                    detectionConsent = true,
                )
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertEquals(listOf(pinBody(expected)), saver.bodies)
            assertEquals(expected, store.saved)
        }

    @Test
    fun eachServerOutcomeLandsInItsPhaseAndOnlyOkWritesTheStore() =
        runTest {
            val cases =
                listOf(
                    PostOutcome.Ok(200, "{}") to OnboardingPhase.READY,
                    PostOutcome.SessionEnded to OnboardingPhase.SESSION_ENDED,
                    PostOutcome.NoSession to OnboardingPhase.SESSION_ENDED,
                    PostOutcome.SessionExpired to OnboardingPhase.NETWORK_ERROR,
                    PostOutcome.NetworkError to OnboardingPhase.NETWORK_ERROR,
                )
            cases.forEach { (outcome, phase) ->
                val saver = PinSaver(outcome)
                val store = PinStore()
                val c = pinController(this, saver, store)
                c.answerUpToThePeriod(null)
                c.next()
                c.next()
                advanceUntilIdle()
                assertEquals(phase, c.state.value.phase, "outcome $outcome")
                assertEquals(1, saver.bodies.size, "outcome $outcome")
                assertEquals(if (phase == OnboardingPhase.READY) MANUAL_WHOLE_YEAR else null, store.saved)
            }
        }

    @Test
    fun eachStepRefusesWhatItRefusesAndStaysPut() =
        runTest {
            val c = pinController(this, PinSaver(PostOutcome.Ok(200, "{}")), PinStore())
            c.onNameChange("   ")
            c.next()
            assertEquals(OnboardingError.NAME_MISSING to OnboardingStep.NOM, c.errorAndStep())
            c.onNameChange("Camille")
            assertNull(c.state.value.error, "an edit clears the error")
            c.next()
            c.next()
            assertEquals(OnboardingError.CANTON_MISSING to OnboardingStep.CANTON, c.errorAndStep())
            c.onCantonChange(Canton.GE)
            c.next()
            listOf("huit", "", " ", "7.5", "80%").forEach { rate ->
                c.onCustomRateChange(rate)
                c.next()
                assertEquals(OnboardingError.RATE_INVALID to OnboardingStep.TAUX, c.errorAndStep())
            }
            c.onRateChoiceChange(RateChoice.R100)
            c.next()
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.next()
            assertEquals(OnboardingError.EXACT_TOTAL_MISSING, c.state.value.error)
            c.onExactTotalChange("deux cents")
            c.next()
            assertEquals(OnboardingError.EXACT_TOTAL_INVALID to OnboardingStep.METHODE, c.errorAndStep())
            c.onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
            c.next()
            c.next()
            assertEquals(OnboardingStep.PERIODE, c.state.value.step)
            c.onAllYearChange(false)
            c.next()
            assertEquals(OnboardingError.START_DATE_INVALID to OnboardingStep.PERIODE, c.errorAndStep())
        }

    @Test
    fun thePeriodStepRefusesEveryStartDateTheCheckRefusesAndTakesTheTrimmedOne() =
        runTest {
            val refused =
                listOf(
                    "",
                    " ",
                    "2024-02-30",
                    "2023-02-29",
                    "2026-13-01",
                    "2026-00-10",
                    "2026-01-00",
                    "2026-01-32",
                    "2026-1-5",
                    "2026-01-5",
                    "2026-1-05",
                    "26-01-05",
                    "2026/01/05",
                    "05.01.2026",
                    "20260105",
                    "2026-01-05T00:00",
                    "2026-01-05Z",
                    "2026-01",
                    "2026",
                    "abc",
                    "+2026-01-05",
                    "10000-01-01",
                    "02026-01-05",
                    "2026-W01-1",
                    "2026-005",
                )
            refused.forEach { start ->
                val c = pinController(this, PinSaver(PostOutcome.Ok(200, "{}")), PinStore())
                c.answerUpToThePeriod(start)
                assertEquals(
                    OnboardingError.START_DATE_INVALID to OnboardingStep.PERIODE,
                    c.errorAndStep(),
                    "start <$start>",
                )
            }
            listOf("2026-07-01", " 2026-07-01 ", "\t2026-01-01\n", "2026-12-31").forEach { start ->
                val c = pinController(this, PinSaver(PostOutcome.Ok(200, "{}")), PinStore())
                c.answerUpToThePeriod(start)
                assertEquals(null to OnboardingStep.MODE, c.errorAndStep(), "start <$start>")
            }
        }

    @Test
    fun theEngineJudgesTheRangeAtTheSaveAndNothingIsSent() =
        runTest {
            val cases =
                listOf(
                    "0" to OnboardingError.RATE_INVALID,
                    "101" to OnboardingError.RATE_INVALID,
                    "-5" to OnboardingError.RATE_INVALID,
                )
            cases.forEach { (rate, error) ->
                val saver = PinSaver(PostOutcome.Ok(200, "{}"))
                val c = pinController(this, saver, PinStore())
                c.onNameChange("Camille")
                c.next()
                c.onCantonChange(Canton.GE)
                c.next()
                c.onCustomRateChange(rate)
                repeat(ALL_STEPS.size) { c.next() }
                advanceUntilIdle()
                assertEquals(error to OnboardingPhase.EDITING, c.errorAndPhase(), "rate $rate")
                assertTrue(saver.bodies.isEmpty(), "rate $rate sent nothing")
            }
            // A start after the tax year leaves no period: refused at the save. A start BEFORE it is the whole year
            // to the engine (the remaining fraction is 1) and is saved as entered - today's behaviour, pinned as is.
            val after = PinSaver(PostOutcome.Ok(200, "{}"))
            val late = pinController(this, after, PinStore())
            late.answerUpToThePeriod("2027-01-01")
            late.next()
            late.next()
            advanceUntilIdle()
            assertEquals(OnboardingError.PERIOD_INVALID to OnboardingPhase.EDITING, late.errorAndPhase())
            assertTrue(after.bodies.isEmpty(), "a start after the tax year sent nothing")
            val before = PinSaver(PostOutcome.Ok(200, "{}"))
            val early = pinController(this, before, PinStore())
            early.answerUpToThePeriod("2025-12-31")
            early.next()
            early.next()
            advanceUntilIdle()
            assertEquals(OnboardingPhase.READY, early.state.value.phase)
            assertEquals(listOf(pinBody(MANUAL_WHOLE_YEAR.copy(activityStartDate = "2025-12-31"))), before.bodies)
            val saver = PinSaver(PostOutcome.Ok(200, "{}"))
            val c = pinController(this, saver, PinStore())
            c.onNameChange("Camille")
            c.next()
            c.onCantonChange(Canton.GE)
            c.next()
            c.next()
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.onExactTotalChange("0")
            repeat(ALL_STEPS.size) { c.next() }
            advanceUntilIdle()
            assertEquals(OnboardingError.EXACT_TOTAL_INVALID, c.state.value.error)
            assertTrue(saver.bodies.isEmpty())
        }

    @Test
    fun backKeepsEverythingAndStopsAtTheFirstStep() =
        runTest {
            val c = pinController(this, PinSaver(PostOutcome.Ok(200, "{}")), PinStore())
            c.back()
            assertEquals(OnboardingStep.NOM, c.state.value.step)
            c.answerUpToThePeriod("2026-03-02")
            assertEquals(OnboardingStep.MODE, c.state.value.step)
            c.back()
            c.back()
            assertEquals(OnboardingStep.GRANULARITY, c.state.value.step)
            val s = c.state.value
            assertEquals(
                listOf("Camille Martin", "GE", "80", "2026-03-02"),
                listOf(s.name, s.canton?.name, s.employmentRate, s.activityStartDate),
            )
            assertEquals(false, s.allYear)
        }

    @Test
    fun aRestoredSnapshotReopensItsStepAndAPlanOfOneStepSavesAfterIt() =
        runTest {
            val twoSteps = listOf(OnboardingStep.NOM, OnboardingStep.TAUX)
            val stray =
                pinController(
                    this,
                    PinSaver(PostOutcome.Ok(200, "{}")),
                    PinStore(),
                    OnboardingSnapshot(step = OnboardingStep.MODE, steps = twoSteps),
                )
            assertEquals(OnboardingStep.NOM to twoSteps, stray.state.value.step to stray.state.value.steps)
            val empty =
                pinController(
                    this,
                    PinSaver(PostOutcome.Ok(200, "{}")),
                    PinStore(),
                    OnboardingSnapshot(steps = emptyList()),
                )
            assertEquals(ALL_STEPS, empty.state.value.steps)

            val saver = PinSaver(PostOutcome.Ok(200, "{}"))
            val store = PinStore()
            val partial =
                pinController(
                    this,
                    saver,
                    store,
                    OnboardingSnapshot(
                        step = OnboardingStep.NOM,
                        canton = Canton.GE,
                        rateChoice = RateChoice.R80,
                        steps = listOf(OnboardingStep.NOM),
                    ),
                )
            partial.onNameChange("Alex Dupont")
            partial.next()
            advanceUntilIdle()
            assertEquals(OnboardingPhase.READY, partial.state.value.phase)
            assertEquals(listOf(pinBody(MANUAL_WHOLE_YEAR.copy(name = "Alex Dupont"))), saver.bodies)
        }

    @Test
    fun thePlanForAMeViewIsTheFullFlowTheMissingStepsOrNothing() {
        // AN-SIGNIN-RESOLVE (R1161): onboardingPlanFor no longer takes null. "No body could be read" is not an answer
        // that the settings are absent, so it never reaches a plan - StartupDecider makes it Unresolved instead.
        assertEquals(OnboardingSnapshot(step = OnboardingStep.NOM, steps = ALL_STEPS), freshOnboardingSnapshot())
        val complete = MeView("Camille", "GE", 80, "SIMPLIFIED240", null, "DAY", null)
        assertEquals(OnboardingPlan.Complete, onboardingPlanFor(complete))
        val noCanton = MeView("Camille", null, 60, "EXACT", 200, "HALF_DAY", "2026-04-01")
        assertEquals(
            OnboardingPlan.Onboard(
                OnboardingSnapshot(
                    step = OnboardingStep.NOM,
                    name = "Camille",
                    canton = null,
                    rateChoice = RateChoice.R60,
                    customRate = "",
                    denominator = DenominatorChoice.EXACT,
                    exactTotalWorkDays = "200",
                    allYear = false,
                    activityStartDate = "2026-04-01",
                    mode = ModeChoice.MANUAL,
                    reminder = false,
                    granularity = GranularityChoice.HALF_DAY,
                    steps = ALL_STEPS,
                ),
            ),
            onboardingPlanFor(noCanton),
        )
        val partial = MeView(null, "VD", 75, "EXACT", null, null, null)
        assertEquals(
            OnboardingPlan.Onboard(
                OnboardingSnapshot(
                    step = OnboardingStep.NOM,
                    name = "",
                    canton = Canton.VD,
                    rateChoice = RateChoice.OTHER,
                    customRate = "75",
                    denominator = DenominatorChoice.EXACT,
                    exactTotalWorkDays = "",
                    allYear = true,
                    activityStartDate = "",
                    mode = ModeChoice.MANUAL,
                    reminder = false,
                    granularity = GranularityChoice.DAY,
                    steps = listOf(OnboardingStep.NOM, OnboardingStep.METHODE, OnboardingStep.GRANULARITY),
                ),
            ),
            onboardingPlanFor(partial),
        )
    }
}

// AN-SIGNIN-RESOLVE (R1162, PARK-E3): onboarding's automatic choice reaches the phone - AFTER the server accepted it.
@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingModeSavedPinTest {
    private fun OnboardingController.answerTheModeAndSave(mode: ModeChoice) {
        answerUpToThePeriod(startDate = null)
        onModeChange(mode)
        next()
        next()
    }

    @Test
    fun anAcceptedAutomaticChoiceIsHandedOnOnceAfterThePatchAndBeforeTheSettingsAreCached() =
        runTest {
            val writes = mutableListOf<String>()
            val store =
                object : SettingsStore {
                    private var saved: Settings? = null

                    override fun load(): Settings? = saved

                    override fun save(settings: Settings) {
                        writes += "settings"
                        saved = settings
                    }

                    override fun clear() {
                        saved = null
                    }
                }
            val saver = PinSaver(PostOutcome.Ok(200, "{}"))
            val c = pinController(this, saver, store, onModeSaved = { writes += "mode:$it" })
            c.answerTheModeAndSave(ModeChoice.AUTO_DETECT)
            advanceUntilIdle()
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertEquals(1, saver.bodies.size)
            // The mode first: cached settings are what send the next launch straight to the shell, past RESOLVING.
            assertEquals(listOf("mode:AUTO_DETECT", "settings"), writes)
        }

    @Test
    fun aManualChoiceHandsNothingOnTheServerKeepsItsValueAndResolvingRestoredIt() =
        runTest {
            val modes = mutableListOf<LoggingMode>()
            val c = pinController(this, PinSaver(PostOutcome.Ok(200, "{}")), PinStore(), onModeSaved = { modes += it })
            c.answerTheModeAndSave(ModeChoice.MANUAL)
            advanceUntilIdle()
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertEquals(emptyList(), modes)
        }

    @Test
    fun anAutomaticChoiceTheServerDidNotAcceptHandsNothingOn() =
        runTest {
            listOf(PostOutcome.NetworkError, PostOutcome.SessionEnded, PostOutcome.Ok(400, "{}")).forEach { outcome ->
                val modes = mutableListOf<LoggingMode>()
                val c = pinController(this, PinSaver(outcome), PinStore(), onModeSaved = { modes += it })
                c.answerTheModeAndSave(ModeChoice.AUTO_DETECT)
                advanceUntilIdle()
                assertEquals(emptyList(), modes, "outcome $outcome")
            }
        }
}

private fun OnboardingController.errorAndStep() = state.value.error to state.value.step

private fun OnboardingController.errorAndPhase() = state.value.error to state.value.phase

/** The Mode step's manual answer, the way the host wires it (onChooseManual -> onModeChange(MANUAL)). */
private fun OnboardingController.onChooseManualForPin() = onModeChange(ModeChoice.MANUAL)
