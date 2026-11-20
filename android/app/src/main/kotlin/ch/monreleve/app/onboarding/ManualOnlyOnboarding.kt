package ch.monreleve.app.onboarding

// AN-PLAY-PACK (R1124). ONBOARDING'S DETECTION ENTRY POINT IS ITS MODE STEP: « Manuellement » or
// « Automatiquement », under a line promising the person can switch later. A build without detection (the
// manual-only fallback) can offer neither half honestly, so it does not ask the step: the plan loses MODE, the mode
// stays MANUAL, and every other step keeps its order and its /me prefill. A detection build gets its seed back
// untouched. Applied by the composition root to the seed the RESOLVING step computed (StartupDecider), so
// :shared's wizard is unchanged.

/** The onboarding seed for this build: [seed] as it is with detection; without it, the same plan minus MODE. */
fun onboardingSeedFor(
    seed: OnboardingSnapshot?,
    detectionAvailable: Boolean,
): OnboardingSnapshot? = if (detectionAvailable) seed else withoutModeStep(seed ?: freshOnboardingSnapshot())

private fun withoutModeStep(base: OnboardingSnapshot): OnboardingSnapshot {
    val steps = base.steps.filter { it != OnboardingStep.MODE }
    // A seed restored ON the mode step moves to the step that followed it (or the last one left).
    val step =
        if (base.step != OnboardingStep.MODE) {
            base.step
        } else {
            base.steps.drop(base.steps.indexOf(OnboardingStep.MODE) + 1).firstOrNull() ?: steps.last()
        }
    return base.copy(steps = steps, step = step, mode = ModeChoice.MANUAL)
}
