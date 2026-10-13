package ch.monreleve.app.ui.screens.releve

// AN11. The Releve screen's callbacks, gathered so the screen stays stateless (the CalendarActions
// precedent). The exports are fire-and-forget: the controller fetches the server render and emits an event
// the composition root hands to the platform share sheet (AC2 / R136).

data class ReleveActions(
    val onRetry: () -> Unit,
    val onExportPdf: () -> Unit,
    val onExportCsv: () -> Unit,
    // PARKAN-26: switch the releve to another tax year the selector offers (read-only, R328). Defaulted so the
    // screenshot fixtures and any caller that does not drive the switch need not name it.
    val onSelectYear: (Int) -> Unit = {},
    // AN-RECON: open the employer comparison for the year on screen (wired in increment 3). Defaulted for the
    // same reason - the year-switch baseline fixtures do not drive it.
    val onCompareEmployer: () -> Unit = {},
)
