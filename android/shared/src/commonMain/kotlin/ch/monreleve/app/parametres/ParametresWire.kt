package ch.monreleve.app.parametres

import ch.monreleve.app.settings.Settings

// IOS-2e R826. THE /api/v1 WIRE SITES ParametresController REACHES (four; AN-MANUAL-REMINDER R1146 added reminderBody),
// HANDED IN AS ONE PARAMETER - IOS-2b R778's
// codec-as-parameter shape, as one small interface rather than four lambdas because the constructor already lists
// sixteen seams. The controller builds and reads no JSON itself: Android hands in its implementation (:app's
// OrgJsonParametres.kt, through the factory named like the controller), and an iOS host hands in its own (REPORT-IOS-2e
// R839). Each member is exactly the body or parse the controller made before. IOS-MOVE-ME (R1270): patchBody's encoder,
// Settings.mePatchBody, is common now (settings/MeWire.kt); the other four sites are still org.json in :app.

/** The bodies ParametresController sends and the one response it parses, encoded by the platform. */
interface ParametresWire {
    /** The PATCH /api/v1/me body carrying the six manual settings (commonMain settings/MeWire.kt's mePatchBody). */
    fun patchBody(settings: Settings): String

    /** The PATCH /api/v1/me body turning automatic detection on, with consent, or off (DetectionMode.kt). */
    fun consentBody(enable: Boolean): String

    /**
     * AN-MANUAL-REMINDER (R1146): the PATCH /api/v1/me body turning the evening reminder on or off - reminderEnabled
     * alone (Android: push/PushRegistration.kt reminderOptInBody, the one encoder A8's registration pass uses too).
     */
    fun reminderBody(enable: Boolean): String

    /** The POST /api/v1/account/delete body: DELETE_CONFIRMATION sent as `confirm` (SPEC 14). */
    fun deleteBody(): String

    /**
     * The delete receipt (SPEC 14.1): the removed entry count and alertSubscriptionRemains. Android's throws on a
     * malformed body, before the device is erased - the behaviour the controller had (ParametresWirePinTest).
     */
    fun parseReceipt(body: String): DeleteOutcome.Done
}
