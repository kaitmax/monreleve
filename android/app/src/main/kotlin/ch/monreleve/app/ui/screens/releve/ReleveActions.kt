package ch.monreleve.app.ui.screens.releve

// AN11. The Releve screen's callbacks, gathered so the screen stays stateless (the CalendarActions
// precedent). Increment 1 carries retry; the export callbacks join in increment 4.

data class ReleveActions(
    val onRetry: () -> Unit,
)
