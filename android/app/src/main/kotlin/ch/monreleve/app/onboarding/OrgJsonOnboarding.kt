package ch.monreleve.app.onboarding

import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.mePatchBody
import kotlinx.coroutines.CoroutineScope

// IOS-2b R778. :app's HALF OF THE ONBOARDING CONTROLLER, and it decides nothing - IOS-1b-A R602d's
// JavaTimeAujourdhui shape.
//
// The controller moved to :shared commonMain, where org.json cannot follow it; it takes its PATCH /me encoder as
// `patchBody`. The composition root (MainActivity's OnboardingRoute) and the controller's JVM tests still construct it
// with (saver, store, taxYear, scope, restored), so this factory, named like the class, keeps every one of those call
// sites unedited and hands in the same org.json Settings.mePatchBody the controller called before - the same function,
// so the same bytes on the wire (MeWire.kt, PARK-D3). Named for what it holds, not OnboardingController.kt.

// LongParameterList: AN-SIGNIN-RESOLVE (R1162) added onModeSaved, the sixth - the class's own constructor, mirrored.

/** The shared OnboardingController, saving through org.json's PATCH /me body (MeWire.kt). */
@Suppress("FunctionNaming", "ktlint:standard:function-naming", "LongParameterList")
fun OnboardingController(
    saver: SettingsSaver,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    restored: OnboardingSnapshot? = null,
    onModeSaved: (LoggingMode) -> Unit,
): OnboardingController =
    OnboardingController(
        saver = saver,
        store = store,
        taxYear = taxYear,
        scope = scope,
        restored = restored,
        patchBody = Settings::mePatchBody,
        onModeSaved = onModeSaved,
    )
