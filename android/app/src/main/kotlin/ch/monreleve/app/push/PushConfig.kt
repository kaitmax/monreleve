package ch.monreleve.app.push

import ch.monreleve.app.BuildConfig

// AN-FCM-CLIENT (R1150). WHETHER THIS BUILD CAN RECEIVE A PUSH AT ALL - read from the four FCM_ANDROID_* build
// properties (app/build.gradle.kts), never from a committed google-services.json.
//
// UNSET IS THE SHIPPED STATE TODAY, AND IT IS INERT. No Firebase project values exist in this repository or on the
// machine that wrote it; the operator supplies them (REPORT-AN-FCM-CLIENT.txt, WHAT THE OPERATOR MUST SUPPLY). With
// any of the four empty the answer is NotConfigured: FirebaseApp is never built, no token is ever asked for, Play
// services are never consulted, and the app runs exactly as it did before this task. Fail closed for push, open for
// the app.
//
// ALL FOUR OR NOTHING. Three values and a blank is not "mostly configured": FirebaseOptions would build, and the
// first token request would fail somewhere the person cannot see. A partial set is NotConfigured, the same as none.

/** The four values FirebaseOptions is built from (Firebase console, the Android app's config). */
internal data class FirebaseValues(
    val projectId: String,
    val applicationId: String,
    val apiKey: String,
    val senderId: String,
) {
    // The API key is not a secret in Firebase's model (it ships inside every app), but nothing here prints it.
    override fun toString(): String = "FirebaseValues(<redacted>)"
}

internal sealed interface PushConfig {
    data class Configured(val values: FirebaseValues) : PushConfig

    data object NotConfigured : PushConfig
}

/** R1150: Configured only when all four values are present after trimming; otherwise NotConfigured. */
internal fun pushConfigOf(
    projectId: String,
    applicationId: String,
    apiKey: String,
    senderId: String,
): PushConfig {
    val values = FirebaseValues(projectId.trim(), applicationId.trim(), apiKey.trim(), senderId.trim())
    val all = listOf(values.projectId, values.applicationId, values.apiKey, values.senderId)
    return if (all.any { it.isEmpty() }) PushConfig.NotConfigured else PushConfig.Configured(values)
}

/** This build's push configuration, from the BuildConfig fields the four FCM_ANDROID_* properties fill. */
internal fun buildPushConfig(): PushConfig =
    pushConfigOf(
        projectId = BuildConfig.FCM_ANDROID_PROJECT_ID,
        applicationId = BuildConfig.FCM_ANDROID_APPLICATION_ID,
        apiKey = BuildConfig.FCM_ANDROID_API_KEY,
        senderId = BuildConfig.FCM_ANDROID_SENDER_ID,
    )
