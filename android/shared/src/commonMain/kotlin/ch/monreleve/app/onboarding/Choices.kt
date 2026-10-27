package ch.monreleve.app.onboarding

import ch.monreleve.app.data.repo.DayGranularity

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. toChoice is public now:
// :app's CalendarController reads it across the module boundary, where `internal` would not reach.

// The settings-vocabulary choice enums, shared across onboarding, Paramètres, Aujourd'hui and the calendar.
// They live here (same package, so no import moves) rather than inside a controller, because AN-ONBOARD
// replaced the single-form OnboardingController with a wizard and these enums outlived that change - they are
// the method and granularity vocabulary, not that one controller's state.

enum class DenominatorChoice { SIMPLIFIED240, EXACT }

enum class GranularityChoice { DAY, HALF_DAY }

/**
 * AN-GRANULARITY (R490): the record path's granularity (:shared, DayGranularity.kt) in the screens' vocabulary - ONE
 * mapping, read by the calendar and Aujourd'hui alike. An enum `when` the compiler checks, not copy.
 */
fun DayGranularity.toChoice(): GranularityChoice =
    when (this) {
        DayGranularity.WHOLE_DAY -> GranularityChoice.DAY
        DayGranularity.HALF_DAYS -> GranularityChoice.HALF_DAY
    }
