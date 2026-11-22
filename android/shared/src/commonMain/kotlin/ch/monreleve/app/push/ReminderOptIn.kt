package ch.monreleve.app.push

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// IOS-SHELL-1 (R1329; Android Ruling 19 Q2, iOS Ruling 8 Q2). THE EVENING SWITCH'S PATCH /api/v1/me BODY, ONCE, IN
// COMMON CODE. It was :app's org.json encoder (push/PushRegistration.kt, AN-FCM-CLIENT R1151 / AN-MANUAL-REMINDER
// R1146): the one body both writers of reminderEnabled send - A8's registration pass and the Parametres switch. iOS v1
// has the reminder and must send the same body, so it moves here, under the package it always had, so every :app
// caller and pin (PushClientFixtureTest, PushSyncTest, ParametresWirePinTest) compiles against it unedited.
//
// BYTE-EQUAL, NOT A TASTE: org.json's JSONObject().put("reminderEnabled", b).toString() wrote `{"reminderEnabled":b}`;
// a one-key buildJsonObject writes the same text. CommonParametresWireGoldenTest pins both values on the JVM and the
// iOS simulator against the literals ParametresWirePinTest pins on :app's org.json wire.

/** The /api/v1/me key the evening opt-in travels under - fixtures/push-client-cases.json's optIn.body. */
const val KEY_REMINDER_ENABLED = "reminderEnabled"

/** The PATCH /api/v1/me body that sets the server's opt-in - fixtures/push-client-cases.json's optIn.body. */
fun reminderOptInBody(enabled: Boolean): String = buildJsonObject { put(KEY_REMINDER_ENABLED, enabled) }.toString()
