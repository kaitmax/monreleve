package ch.monreleve.app.parametres

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.push.reminderOptInBody
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.InMemoryThresholdAlertStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.ThresholdAlertStore
import ch.monreleve.app.settings.detectionConsentBody
import ch.monreleve.app.settings.mePatchBody
import kotlinx.coroutines.CoroutineScope
import org.json.JSONObject

// IOS-2e R826. :app's HALF OF THE PARAMETRES CONTROLLER: its org.json wire, and it decides nothing - IOS-2b R778's
// OrgJsonOnboarding shape.
//
// The controller takes its four wire sites as `wire` (ParametresWire) so that it can live where org.json cannot follow
// it. The composition root (MainGraph) and every JVM test still construct it with the parameters they always passed, so
// this factory, named like the class, keeps every one of those call sites unedited and hands in the code the controller
// ran before: Settings.mePatchBody and DetectionMode.kt's detectionConsentBody by reference, and the delete body and
// receipt parse moved here from the controller unchanged, line for line (ParametresWirePinTest pins them, on the JVM
// org.json library - not Android's). IOS-MOVE-ME (R1270): mePatchBody is no longer org.json - it moved to :shared
// commonMain (settings/MeWire.kt, kotlinx.serialization); the other four sites here still are.

/**
 * The wire sites, Android's implementation: four in org.json, and patchBody through the common mePatchBody
 * (IOS-MOVE-ME, R1270). AN-MANUAL-REMINDER (R1146) added the fifth, the evening switch's body - the encoder A8's
 * registration pass already sends (R206).
 */
private object OrgJsonParametresWire : ParametresWire {
    override fun patchBody(settings: Settings): String = settings.mePatchBody()

    override fun consentBody(enable: Boolean): String = detectionConsentBody(enable)

    override fun reminderBody(enable: Boolean): String = reminderOptInBody(enable)

    override fun deleteBody(): String = JSONObject().put("confirm", DELETE_CONFIRMATION).toString()

    // §14.1: `removed` is a map (parse as one, never a fixed record); alertSubscriptionRemains is surfaced
    // (§14.3). The entry count is the figure worth showing a person; the rest of the receipt is not printed.
    override fun parseReceipt(body: String): DeleteOutcome.Done {
        val json = JSONObject(body)
        val removed = json.optJSONObject("removed")
        return DeleteOutcome.Done(
            removedEntries = removed?.optInt("Entry", 0) ?: 0,
            alertSubscriptionRemains = json.optBoolean("alertSubscriptionRemains", false),
        )
    }
}

/**
 * IOS-MOVE-GRAPH (R1310): the same object, for the composition root (ShellState.kt), which hands it to
 * MainGraph.build - the graph builds the controller with it. The object stays private, so this file's one declared
 * type is still the one its name matches.
 */
internal val orgJsonParametresWire: ParametresWire = OrgJsonParametresWire

/**
 * The ParametresController, its wire in org.json. The parameters, their order and their defaults are the class's own
 * before IOS-2e - every default copied from it, NoOpLocalStore included - so a call that compiled against the class
 * compiles against this unchanged and builds the same controller.
 */
@Suppress("FunctionNaming", "ktlint:standard:function-naming", "LongParameterList")
fun ParametresController(
    saver: SettingsSaver,
    store: SettingsStore,
    repository: EntryRepository,
    taxYear: Int,
    scope: CoroutineScope,
    exportBytes: suspend (String) -> BytesOutcome = { BytesOutcome.NoSession },
    revokeServer: suspend () -> Unit = {},
    syncNow: suspend () -> Unit = {},
    localStore: LocalStore = NoOpLocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome = { _, _ -> PostOutcome.NoSession },
    modeStore: DetectionModeStore = InMemoryDetectionModeStore(),
    startSampling: () -> Unit = {},
    stopSampling: () -> Unit = {},
    eveningNotificationStore: EveningNotificationStore = InMemoryEveningNotificationStore(),
    thresholdAlertStore: ThresholdAlertStore = InMemoryThresholdAlertStore(),
    restored: ParametresSnapshot? = null,
): ParametresController =
    ParametresController(
        saver = saver,
        store = store,
        repository = repository,
        taxYear = taxYear,
        scope = scope,
        exportBytes = exportBytes,
        revokeServer = revokeServer,
        syncNow = syncNow,
        localStore = localStore,
        authenticatedPost = authenticatedPost,
        modeStore = modeStore,
        startSampling = startSampling,
        stopSampling = stopSampling,
        eveningNotificationStore = eveningNotificationStore,
        thresholdAlertStore = thresholdAlertStore,
        restored = restored,
        wire = OrgJsonParametresWire,
    )
