package ch.monreleve.app.ui.screens.calendrier

import ch.monreleve.app.calendar.SlotEdit

// AN10 increment 2. The calendar screen's callbacks, bundled (the OnboardingActions precedent) so the
// stateless screen takes state + actions rather than a long parameter list. A data class, so it names
// its own file (detekt MatchingDeclarationName) and is exempt from the parameter-count rule.

data class CalendarActions(
    val onPreviousMonth: () -> Unit,
    val onNextMonth: () -> Unit,
    val onDayClick: (String) -> Unit,
    val onSave: (String, List<SlotEdit>) -> Unit,
    val onDismissSheet: () -> Unit,
)
