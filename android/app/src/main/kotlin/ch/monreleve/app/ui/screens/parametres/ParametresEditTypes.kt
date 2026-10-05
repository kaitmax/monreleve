package ch.monreleve.app.ui.screens.parametres

// AN-PARAMS. The small types the settings screen passes between its composables, grouped in one file (so none is
// a file's single top-level declaration - detekt's MatchingDeclarationName - and so ParametresScreen.kt carries
// only functions, as it did before this task). All are UI-layer holders, the codebase's callback-bundle idiom
// (ParametresActions, CalendarActions), which keeps every ui/ composable at or below five parameters without a
// @Suppress whose String argument the no-inline-string fence (Fence 4) forbids in ui/.

/** Which « Situation professionnelle » setting the open edit sheet is editing. */
enum class EditTarget { CANTON, RATE, METHOD, GRANULARITY, START_DATE }

/**
 * The chrome every edit sheet shows: the error (if the last save in this sheet failed), whether a save is in
 * flight, and its own Enregistrer / Annuler. Bundled so each sheet composable stays at or below five parameters.
 */
internal data class EditSheetFrame(
    val error: String?,
    val saving: Boolean,
    val onSave: () -> Unit,
    val onCancel: () -> Unit,
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
