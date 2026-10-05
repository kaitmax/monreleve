package ch.monreleve.app.ui.screens.calendrier

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.calendar.SlotEdit

// AN10 increment 2. The calendar screen's callbacks, bundled (the OnboardingActions precedent) so the
// stateless screen takes state + actions rather than a long parameter list. A data class, so it names
// its own file (detekt MatchingDeclarationName) and is exempt from the parameter-count rule.
//
// AN-CAL2: the multi-day selection callbacks join it - entering selection (the button or a long press), a
// tap while selecting, the action panel's choice, the confirmation's Confirmer/Annuler, and leaving selection.

data class CalendarActions(
    val onPreviousMonth: () -> Unit,
    val onNextMonth: () -> Unit,
    val onDayClick: (String) -> Unit,
    val onSave: (String, List<SlotEdit>) -> Unit,
    val onDismissSheet: () -> Unit,
    // AN-CAL2 (section 2):
    val onStartSelection: () -> Unit,
    val onStartSelectionWithDay: (String) -> Unit,
    val onToggleDay: (String) -> Unit,
    val onCancelSelection: () -> Unit,
    val onChooseBulk: (RecordedKind, AbsenceChoice?) -> Unit,
    val onConfirmBulk: () -> Unit,
    val onCancelConfirmation: () -> Unit,
)
