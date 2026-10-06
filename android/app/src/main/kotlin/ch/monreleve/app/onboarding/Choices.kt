package ch.monreleve.app.onboarding

// The settings-vocabulary choice enums, shared across onboarding, Paramètres, Aujourd'hui and the calendar.
// They live here (same package, so no import moves) rather than inside a controller, because AN-ONBOARD
// replaced the single-form OnboardingController with a wizard and these enums outlived that change - they are
// the method and granularity vocabulary, not that one controller's state.

enum class DenominatorChoice { SIMPLIFIED240, EXACT }

enum class GranularityChoice { DAY, HALF_DAY }
