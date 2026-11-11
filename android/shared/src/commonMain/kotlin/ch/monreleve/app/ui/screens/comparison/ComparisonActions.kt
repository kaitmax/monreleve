package ch.monreleve.app.ui.screens.comparison

// AN-RECON (the comparison). The screen's callbacks, defaulted so the screenshot fixtures and any caller that
// does not drive them need not name each one.
data class ComparisonActions(
    /** The person edited the attestation field (raw text; the overlay parses and persists it, R342). */
    val onInputChange: (String) -> Unit = {},
    /** « Voir mes journées jour par jour » and each cause row: open the day-by-day record. */
    val onViewDays: () -> Unit = {},
    val onBack: () -> Unit = {},
)
