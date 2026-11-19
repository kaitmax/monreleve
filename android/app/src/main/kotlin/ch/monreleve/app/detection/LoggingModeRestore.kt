package ch.monreleve.app.detection

import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.LoggingMode

// AN-SIGNIN-RESOLVE (R1162, PARK-E3). THE MODE THE PHONE HOLDS FOR THE MODE THE SERVER HOLDS, decided in ONE place for
// the two moments the phone learns it: RESOLVING after a sign-in (StartupDecider's restoreMode, from GET /me read
// fail-closed by parseLoggingMode) and onboarding's accepted automatic choice (OnboardingController's onModeSaved).
// Until this task neither reached the phone: Parametres was the only writer of the cache, so a person who chose
// automatic at onboarding, or signed back in to an automatic account, was shown manual and nothing sampled.
//
// The server is the CONSENT authority; the OS is the PERMISSION authority. AUTO_DETECT on the phone needs both, so
// where the location permission is not held the phone shows MANUAL and the sampler is stopped - nothing samples
// silently, and nothing pretends to. Nothing is sent to the server: a missing permission is not a withdrawal of
// consent (R316's revocation path makes the same choice - the person may grant it again).

/** R1162: AUTO_DETECT only when the server holds it AND the OS grants what sampling needs; MANUAL otherwise. */
fun phoneLoggingMode(
    serverMode: LoggingMode,
    locationFullyGranted: Boolean,
): LoggingMode =
    if (serverMode == LoggingMode.AUTO_DETECT && locationFullyGranted) LoggingMode.AUTO_DETECT else LoggingMode.MANUAL

/** R1162: save [phoneLoggingMode] on the phone, start the sampler for AUTO_DETECT and stop it otherwise. */
fun applyServerLoggingMode(
    serverMode: LoggingMode,
    locationFullyGranted: Boolean,
    store: DetectionModeStore,
    startSampling: () -> Unit,
    stopSampling: () -> Unit,
): LoggingMode {
    val mode = phoneLoggingMode(serverMode, locationFullyGranted)
    store.save(mode)
    if (mode == LoggingMode.AUTO_DETECT) startSampling() else stopSampling()
    return mode
}
