package ch.monreleve.app.ui.screens.parametres

import androidx.compose.runtime.Composable

// AN-PARAMS. The small types the settings screen passes between its composables, grouped in one file (so none is
// a file's single top-level declaration - detekt's MatchingDeclarationName - and so ParametresScreen.kt carries
// only functions, as it did before this task). All are UI-layer holders, the codebase's callback-bundle idiom
// (ParametresActions, CalendarActions), which keeps every ui/ composable at or below five parameters without a
// @Suppress whose String argument the no-inline-string fence (Fence 4) forbids in ui/.

/**
 * IOS-2e R830: the « Début d'activité » picker, supplied by the host (R776's seam, with an initial date). Composed
 * while the picker is asked for, with the current value as an ISO day (yyyy-MM-dd) or null; it calls onPicked with
 * the chosen ISO day and then onDismiss to close - or onDismiss alone to cancel. Android's is Material 3's dialog.
 */
typealias ParametresDatePicker =
    @Composable (initialIsoDay: String?, onPicked: (isoDay: String) -> Unit, onDismiss: () -> Unit) -> Unit

/** Which « Situation professionnelle » setting the open edit sheet is editing. */
enum class EditTarget { CANTON, RATE, METHOD, GRANULARITY, START_DATE }

/**
 * The chrome every edit sheet shows: the error (if the last save in this sheet failed), whether a save is in
 * flight, and its own Enregistrer / Annuler. Bundled so each sheet composable stays at or below five parameters.
 * IOS-2e R830: and the host's date picker, which only the « Début d'activité » sheet composes - carried here rather
 * than as a sixth parameter of ParametresOverlays (the no-inline-string fence forbids the @Suppress that would need).
 */
internal data class EditSheetFrame(
    val error: String?,
    val saving: Boolean,
    val onSave: () -> Unit,
    val onCancel: () -> Unit,
    val startDatePicker: ParametresDatePicker,
)

/**
 * The settings list's navigation callbacks, bundled so ParametresSettingsColumn stays flat: open a setting's edit
 * sheet, open « En savoir plus », open the export chooser, open the licences screen. Sign-out, delete and the
 * legal pages come straight from ParametresActions, so they are not repeated here.
 */
internal data class ParametresListCallbacks(
    val onEdit: (EditTarget) -> Unit,
    val onLearnMore: () -> Unit,
    val onExport: () -> Unit,
    val onOpenLicences: () -> Unit,
)

/**
 * The two information sheets the list opens (« En savoir plus » and the export chooser): whether each is shown
 * and how each is dismissed. Bundled so ParametresOverlays stays at or below five parameters without a @Suppress
 * whose String argument the no-inline-string fence (Fence 4) forbids in ui/. The edit sheet's own dismiss is
 * EditSheetFrame.onCancel, so it is not repeated here.
 */
internal data class InfoSheets(
    val showLearnMore: Boolean,
    val showExport: Boolean,
    val onDismissLearnMore: () -> Unit,
    val onDismissExport: () -> Unit,
)
