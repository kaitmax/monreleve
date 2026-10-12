package ch.monreleve.app.ui.screens.parametres

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.LegalPage

// AN12 increment 1. The Parametres screen's callbacks, bundled so the screen signature stays flat as later
// increments add account actions (export, sign-out, deletion). The screen is stateless (fence 5): it reads a
// ParametresState and calls these; the controller behind them holds the store, the session seam and the
// engine path for R290's before/after.

data class ParametresActions(
    val onCantonChange: (Canton) -> Unit,
    val onEmploymentRateChange: (String) -> Unit,
    val onDenominatorChange: (DenominatorChoice) -> Unit,
    val onExactTotalChange: (String) -> Unit,
    val onGranularityChange: (GranularityChoice) -> Unit,
    val onActivityStartDateChange: (String) -> Unit,
    val onSave: () -> Unit,
    /** R290: the person saw the before/after and confirmed the consequential change. */
    val onConfirmRateChange: () -> Unit,
    /** R290: the person saw the before/after and kept the current value. */
    val onCancelRateChange: () -> Unit,
    /** AC2: export the complete record (JSON) or the entries (CSV) to the platform share sheet. */
    val onExportJson: () -> Unit,
    val onExportCsv: () -> Unit,
    /** PARKAN-27: raise the sign-out confirmation (which names the unsynced days that will be lost). */
    val onRequestSignOut: () -> Unit,
    /** R295: the person confirmed; revoke the session and wipe the local store. */
    val onConfirmSignOut: () -> Unit,
    /** PARKAN-27: the person kept the session; dismiss the confirmation. */
    val onCancelSignOut: () -> Unit,
    /** R289: raise the deletion confirmation (names what is destroyed and requires the typed word). */
    val onRequestDelete: () -> Unit,
    /** R289: the person typed the word and confirmed; erase server then device. */
    val onConfirmDelete: () -> Unit,
    /** R289: the person backed out; nothing is destroyed. */
    val onCancelDelete: () -> Unit,
    /** R289: the person read the outcome; leave for a first-run state (on success) or dismiss. */
    val onAcknowledgeDelete: () -> Unit,
    /** AN12 increment 4: open a legal page in the browser from the configured site URL. */
    val onOpenLegal: (LegalPage) -> Unit,
    /** R315: turn automatic detection (beta) on or off. Off stops sampling at once; neither way is a dialog. */
    val onToggleAutoDetection: (Boolean) -> Unit,
    /** R323: turn the evening proposal notification on or off. ON asks the notification permission (Android 13+). */
    val onToggleEveningNotification: (Boolean) -> Unit,
    /** AN-ALERT: turn the threshold alert on or off. ON asks the notification permission (Android 13+). */
    val onToggleThresholdAlert: (Boolean) -> Unit = {},
    /** AN-FORECAST: open the weekly-rhythm editor (« Votre rythme habituel »), reached from the settings list. */
    val onOpenRhythm: () -> Unit = {},
)
