package ch.monreleve.app.onboarding

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test

/**
 * AN-PLAY-PACK (R1124). THE ONBOARDING'S DETECTION ENTRY POINT IS ITS MODE STEP - a choice between « Manuellement »
 * and « Automatiquement », whose info line promises the person can switch later. A build without detection (the
 * manual-only fallback) cannot offer either half honestly, so it does not ask the step at all: the plan loses MODE,
 * the mode stays MANUAL, and every other step keeps its order and its prefill. A detection build is untouched.
 */
class ManualOnlyOnboardingTest {
    private val fullFlow = OnboardingSnapshot(name = "Camille", steps = DEFAULT_STEPS)

    @Test
    fun aDetectionBuildKeepsTheSeedAsItIs() {
        assertSame(fullFlow, onboardingSeedFor(fullFlow, detectionAvailable = true))
        assertEquals(null, onboardingSeedFor(null, detectionAvailable = true))
    }

    @Test
    fun withoutDetectionTheModeStepIsNotAskedAndTheRestKeepsItsOrder() {
        val seed = onboardingSeedFor(fullFlow.copy(mode = ModeChoice.AUTO_DETECT), detectionAvailable = false)!!
        assertFalse(OnboardingStep.MODE in seed.steps)
        assertEquals(DEFAULT_STEPS.filter { it != OnboardingStep.MODE }, seed.steps)
        assertEquals(ModeChoice.MANUAL, seed.mode)
        assertEquals("Camille", seed.name)
        assertEquals(OnboardingStep.NOM, seed.step)
    }

    @Test
    fun withoutDetectionAMissingSeedBecomesTheFreshFlowWithoutTheModeStep() {
        val seed = onboardingSeedFor(null, detectionAvailable = false)!!
        assertEquals(freshOnboardingSnapshot().steps.filter { it != OnboardingStep.MODE }, seed.steps)
        assertEquals(seed.steps.first(), seed.step)
    }

    @Test
    fun aSeedRestoredOnTheModeStepMovesToTheStepAfterIt() {
        val seed = onboardingSeedFor(fullFlow.copy(step = OnboardingStep.MODE), detectionAvailable = false)!!
        val after = DEFAULT_STEPS[DEFAULT_STEPS.indexOf(OnboardingStep.MODE) + 1]
        assertEquals(after, seed.step)
    }

    @Test
    fun aPartialPlanWithoutTheModeStepIsUnchangedInItsSteps() {
        val partial = OnboardingSnapshot(step = OnboardingStep.CANTON, steps = listOf(OnboardingStep.CANTON))
        val seed = onboardingSeedFor(partial, detectionAvailable = false)!!
        assertEquals(listOf(OnboardingStep.CANTON), seed.steps)
        assertEquals(OnboardingStep.CANTON, seed.step)
    }
}
