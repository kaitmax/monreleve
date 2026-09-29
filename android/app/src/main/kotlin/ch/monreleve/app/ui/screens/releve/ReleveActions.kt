package ch.monreleve.app.ui.screens.releve

// AN11. The Releve screen's callbacks, gathered so the screen stays stateless (the CalendarActions
// precedent). The exports are fire-and-forget: the controller fetches the server render and emits an event
// the composition root hands to the platform share sheet (AC2 / R136).

data class ReleveActions(
    val onRetry: () -> Unit,
    val onExportPdf: () -> Unit,
    val onExportCsv: () -> Unit,
)
