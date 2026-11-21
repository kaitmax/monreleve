package ch.monreleve.app.auth

import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.account.LocalStore

// AN-SESSION-END (R1181). THE "SESSION ENDED" SEAM: ONE POINT EVERY ENDING PASSES, WHERE THE PHONE STOPS WORKING FOR
// THE PERSON WHOSE SESSION IT WAS.
//
// IOS-MOVE-SEAM (R1280): THIS IS THE SEAM'S PURE PART - the contract and the wrapper that runs it - moved from :app to
// :shared commonMain, package unchanged, so both platforms end a session through the SAME lines of code. What each
// platform STOPS stays on its platform, behind the contract:
//   Android   :app auth/DeviceSessionEndSeam.kt - deviceSessionEndSeam (the sampler, push, the 19:00 fallback) and
//             processSessionEndSeam (WorkManager / FCM on the application Context); built into the store by the one
//             construction, account/DeviceLocalStores.kt.
//   iOS       iosMain ios/IosSessionEndSeam.kt - this app's PENDING local notification requests removed (R1281); built
//             into the store by the one construction, ios/IosLocalStores.kt (iosDeviceLocalStore).
// The moved file was split, not bent: processSessionEndSeam reads android.content.Context and cannot compile here, so
// it - and the Android body it builds - stayed in :app under a new file name. Every moved declaration lost `internal`
// (:app is another module); nothing else in them changed.
//
// WHAT WAS WRONG (A3's N3, emulator API 36). A sign-out emptied the detection file but left the background sampler
// scheduled, and nothing else that runs on the person's behalf had a place to be stopped from either. The three ways a
// session ends on this phone already meet in ONE class - DeviceLocalStore's three scopes (R295/R289/R521) - so the seam
// sits on that class's way out, as the store the app holds:
//
//   the person signs out     Parametres confirmSignOut -> clearForSignOut     -> sessionEnded(SIGNED_OUT)
//   the person deletes       Parametres runDelete (2xx) -> clearForDeletion   -> sessionEnded(DELETED)
//   the server ends it       SessionManager.onEnded -> onServerEndedSession
//                            -> clearForSessionEnd                            -> sessionEnded(ENDED_BY_SERVER)
//                            (every cause R521/R522 lists: a refused refresh, a replay, revoke-all, a 401 the refresh
//                            cannot recover, an account deleted elsewhere - all three of SessionManager's end() sites)
//
// THE ONE STOP IS REUSED, NOT DUPLICATED (Android Ruling 9). On Android the seam cancels the sampler through
// DetectionScheduling.stopSampling - the same function the Parametres switch, the OS-permission revocation and A9's
// LoggingModeRestore (a MANUAL restore) are wired to. Automatic -> manual is NOT a session ending and does not pass
// here: those three call the stop directly, because what attaches here next (the push token, the fallback reminder)
// must not be dropped by a mode change.
//
// ATTACH HERE (A8, A7). Each platform's seam body is where an attachment adds its line. Each attachment must be
// IDEMPOTENT: a server ending can be reported more than once for one ending (SessionManager.onEnded), and a sign-out
// after a forced ending ends nothing new.
//
// WHAT NO SEAM CAN SEE. A Keystore blob that no longer decrypts is dropped by KeystoreTokenStore.load - no call ends
// the session, it is simply gone. SamplingWorker's guard (R1180) is the stop for that one; it is the backstop for every
// path here as well.

/** R1181: which path ended the session - each names itself to the seam. */
enum class SessionEndPath {
    /** The person signed out (Parametres, R295). */
    SIGNED_OUT,

    /** The person deleted the account, and the server confirmed it (Parametres, R289). */
    DELETED,

    /** The server ended the session (SessionManager.onEnded, R520/R521). */
    ENDED_BY_SERVER,
}

/** R1181: THE "SESSION ENDED" SEAM - told once per ending, whichever path ended it. */
fun interface SessionEndSeam {
    fun sessionEnded(path: SessionEndPath)
}

/**
 * R1181: THE DEVICE'S LocalStore AS THE APP HOLDS IT - each of DeviceLocalStore's three scopes, through the seam. Each
 * platform's one construction (Android's account/DeviceLocalStores.kt, iOS's ios/IosLocalStores.kt) returns this, so
 * whoever is handed the device's store cannot clear an account without ending its session here. The seam is a
 * required argument: no construction can forget it.
 *
 * THE SEAM RUNS FIRST, THE CLEAR IN A finally. The platform's stop runs before anything that can throw, and the clear -
 * the privacy half - runs whether the seam returned or threw; a seam's failure then reaches the caller.
 */
class SessionEndingStore(
    private val store: DeviceLocalStore,
    private val seam: SessionEndSeam,
) : LocalStore {
    override suspend fun clearForSignOut() = ending(SessionEndPath.SIGNED_OUT) { store.clearForSignOut() }

    override suspend fun clearForDeletion() = ending(SessionEndPath.DELETED) { store.clearForDeletion() }

    /** R521's scope for a session the SERVER ended - onServerEndedSession's one call. */
    suspend fun clearForSessionEnd() = ending(SessionEndPath.ENDED_BY_SERVER) { store.clearForSessionEnd() }

    private suspend fun ending(
        path: SessionEndPath,
        clear: suspend () -> Unit,
    ) {
        try {
            seam.sessionEnded(path)
        } finally {
            clear()
        }
    }
}
