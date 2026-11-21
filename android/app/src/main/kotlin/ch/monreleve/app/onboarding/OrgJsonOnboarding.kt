package ch.monreleve.app.onboarding

import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.mePatchBody
import kotlinx.coroutines.CoroutineScope

// IOS-2b R778. :app's HALF OF THE ONBOARDING CONTROLLER, and it decides nothing - IOS-1b-A R602d's
// JavaTimeAujourdhui shape.
//
// The controller moved to :shared commonMain, where org.json cannot follow it; it takes its PATCH /me encoder as
// `patchBody`. The composition root (MainActivity's OnboardingRoute) and the controller's JVM tests still construct it
// with (saver, store, taxYear, scope, restored), so this factory, named like the class, keeps every one of those call
// sites unedited and hands in Settings.mePatchBody. IOS-MOVE-ME (R1270): that encoder is no longer org.json - it moved
// to :shared commonMain (settings/MeWire.kt, kotlinx.serialization), same package, same keys, same values; the file
// keeps its name so the history reads.

// LongParameterList: AN-SIGNIN-RESOLVE (R1162) added onModeSaved, the sixth - the class's own constructor, mirrored;
// AN-MANUAL-REMINDER (R1145) onReminderSaved, the seventh, likewise.

/** The shared OnboardingController, saving through the common PATCH /me body (commonMain settings/MeWire.kt). */
@Suppress("FunctionNaming", "ktlint:standard:function-naming", "LongParameterList")
fun OnboardingController(
    saver: SettingsSaver,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    restored: OnboardingSnapshot? = null,
    onModeSaved: (LoggingMode) -> Unit,
    onReminderSaved: (Boolean) -> Unit,
): OnboardingController =
    OnboardingController(
        saver = saver,
        store = store,
        taxYear = taxYear,
        scope = scope,
        restored = restored,
        patchBody = { settings, reminderEnabled -> settings.mePatchBody(reminderEnabled) },
        onModeSaved = onModeSaved,
        onReminderSaved = onReminderSaved,
    )
