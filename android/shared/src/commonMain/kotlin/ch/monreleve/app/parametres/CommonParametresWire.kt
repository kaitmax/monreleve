package ch.monreleve.app.parametres

import ch.monreleve.app.data.remote.wireJson
import ch.monreleve.app.push.reminderOptInBody
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.mePatchBody
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

// IOS-SHELL-1 (R1329, iOS Ruling 12 Q1). THE PARAMETRES WIRE, ONCE, IN COMMON CODE.
//
// MainGraph.build REQUIRES a ParametresWire (IOS-MOVE-GRAPH R1310), so the iOS graph needs one. The members whose
// bodies are platform-free are written here once, on M2's /me codec and kotlinx.serialization's tree (data/remote/
// WireJson.kt - no new dependency):
//   patchBody      Settings.mePatchBody (settings/MeWire.kt) - already common since IOS-MOVE-ME (R1270).
//   reminderBody   reminderOptInBody (push/ReminderOptIn.kt) - moved from :app by this task (Android Ruling 19 Q2).
//   deleteBody     accountDeleteBody, below - the body :app's org.json wire writes, byte for byte.
//   parseReceipt   parseDeleteReceipt, below - org.json's optJSONObject / optInt / optBoolean reproduced, value for
//                  value, on every receipt ParametresWirePinTest pins.
// THE ONE PLATFORM MEMBER is the detection consent: detection stays Android's (Android Ruling 19 Q2), so its body
// (:app's settings/DetectionMode.kt detectionConsentBody) is handed in. iOS v1 is manual-only (iOS Ruling 2) and its
// composition hands in a body that refuses to be built (IosParametresWire's, iosMain); a test proves the iOS
// composition never asks for it.
//
// ANDROID KEEPS ITS org.json WIRE (orgJsonParametresWire, :app). R1329 lets Android switch only when this one is
// byte-equal on EVERY pin, and one pin cannot be: a MALFORMED receipt throws out of org.json's JSONObject(body) as a
// JSONException, which ParametresWirePinTest asserts by class; here it throws kotlinx.serialization's exception. The
// outcome the person sees is the same (no outcome, nothing erased), the exception class is not, so the pin would have
// to change - and R1329 says the pins stay unedited. CommonParametresWireGoldenTest records that divergence by name.

/** The bodies ParametresController sends and the receipt it parses, in common code; [consentBody] is the platform's. */
class CommonParametresWire(
    private val consentBody: (Boolean) -> String,
) : ParametresWire {
    override fun patchBody(settings: Settings): String = settings.mePatchBody()

    override fun consentBody(enable: Boolean): String = consentBody.invoke(enable)

    override fun reminderBody(enable: Boolean): String = reminderOptInBody(enable)

    override fun deleteBody(): String = accountDeleteBody()

    override fun parseReceipt(body: String): DeleteOutcome.Done = parseDeleteReceipt(body)
}

/** The POST /api/v1/account/delete body: DELETE_CONFIRMATION sent as `confirm` (SPEC 14). */
fun accountDeleteBody(): String = buildJsonObject { put("confirm", DELETE_CONFIRMATION) }.toString()

/** The delete receipt (SPEC 14.1), read as org.json read it; a body that is not a JSON object throws. */
fun parseDeleteReceipt(body: String): DeleteOutcome.Done {
    // org.json `JSONObject(body)`: a body that is not a JSON object throws (the declared divergence: its class).
    val json = wireJson.parseToJsonElement(body).jsonObject
    // §14.1: `removed` is a map (read as one, never a fixed record); alertSubscriptionRemains is surfaced (§14.3).
    val removed = json["removed"] as? JsonObject
    return DeleteOutcome.Done(
        removedEntries = removed?.get("Entry").optInt(),
        alertSubscriptionRemains = json["alertSubscriptionRemains"].optBoolean(),
    )
}

/**
 * org.json `optInt(key, 0)`: a JSON number as Number.intValue() reads it (a fraction truncated); a JSON string read
 * as a decimal number and truncated the same way; anything else - absent, null, a boolean, an object, an unreadable
 * string - the default 0. A JSON boolean or null is a primitive whose text is not a number, so it falls to 0 too.
 */
private fun JsonElement?.optInt(): Int {
    val text = (this as? JsonPrimitive)?.content
    return text?.toIntOrNull()
        ?: text?.toLongOrNull()?.toInt()
        ?: text?.toDoubleOrNull()?.takeIf { it.isFinite() }?.toInt()
        ?: 0
}

/**
 * org.json `optBoolean(key, false)`: a JSON boolean as it is; a JSON string "true" or "false" in any case read as that
 * boolean; anything else the default false.
 */
private fun JsonElement?.optBoolean(): Boolean {
    val primitive = this as? JsonPrimitive ?: return false
    return primitive.content.equals("true", ignoreCase = true)
}
