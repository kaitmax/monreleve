package ch.monreleve.app.auth

import android.content.Context
import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.detection.DetectionScheduling
import ch.monreleve.app.push.endPushOnThisPhone
import ch.monreleve.app.reminder.FallbackReminderScheduling

// AN-SESSION-END (R1181). THE "SESSION ENDED" SEAM: ONE POINT EVERY ENDING PASSES, WHERE THE PHONE STOPS WORKING FOR
// THE PERSON WHOSE SESSION IT WAS.
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
// THE ONE STOP IS REUSED, NOT DUPLICATED (Android Ruling 9). The seam cancels the sampler through
// DetectionScheduling.stopSampling - the same function the Parametres switch, the OS-permission revocation and A9's
// LoggingModeRestore (a MANUAL restore) are wired to. Automatic -> manual is NOT a session ending and does not pass
// here: those three call the stop directly, because what attaches here next (the push token, the fallback reminder)
// must not be dropped by a mode change.
//
// ATTACH HERE (A8, A7). [deviceSessionEndSeam] is the body: A8's push token and A7's fallback reminder each add their
// line there, beside the sampler's. Each attachment must be IDEMPOTENT: a server ending can be reported more than once
// for one ending (SessionManager.onEnded), and a sign-out after a forced ending ends nothing new.
//
// WHAT NO SEAM CAN SEE. A Keystore blob that no longer decrypts is dropped by KeystoreTokenStore.load - no call ends
// the session, it is simply gone. SamplingWorker's guard (R1180) is the stop for that one; it is the backstop for every
// path here as well.

/** R1181: which path ended the session - each names itself to the seam. */
internal enum class SessionEndPath {
    /** The person signed out (Parametres, R295). */
    SIGNED_OUT,

    /** The person deleted the account, and the server confirmed it (Parametres, R289). */
    DELETED,

    /** The server ended the session (SessionManager.onEnded, R520/R521). */
    ENDED_BY_SERVER,
}

/** R1181: THE "SESSION ENDED" SEAM - told once per ending, whichever path ended it. */
internal fun interface SessionEndSeam {
    fun sessionEnded(path: SessionEndPath)
}

/**
 * R1181: what THIS phone stops when a session ends - the seam's body, built once for the app ([processSessionEndSeam])
 * and the same way by the tests: the background sampler, then push (AN-FCM-CLIENT), then the 19:00 fallback (A7).
 */
internal fun deviceSessionEndSeam(
    stopSampling: () -> Unit,
    endPush: (SessionEndPath) -> Unit,
    endFallbackReminder: () -> Unit,
): SessionEndSeam =
    SessionEndSeam {
        // The one stop (DetectionScheduling.stopSampling in the app). Idempotent: cancelling cancelled work is nothing.
        stopSampling()
        // AN-FCM-CLIENT (R1152, Android Ruling 8's SIGNED-OUT row): push on this phone ends with the session - the
        // "push available" record forgotten, the install's token invalidated (push/PushRuntime.kt endPushOnThisPhone).
        // THE SAME FOR EVERY PATH - the path is passed (Android Ruling 11 Q4) and none needs another answer: a
        // voluntary sign-out and a server-ended session both leave the server's Device row alive (no DELETE route,
        // api-v1 10.4), and the invalidated token is what gets it pruned on the next send; a deletion already
        // removed the row (D11) and invalidating the token costs nothing. Idempotent (a second ending finds nothing
        // to forget), and AFTER the sampler, inside its own runCatching, so it can neither skip the stop nor throw
        // into the clear.
        runCatching { endPush(it) }
        // AN-MANUAL-REMINDER (R1141, Android Ruling 8's SIGNED-OUT row): the 19:00 fallback is unscheduled -
        // signed out, nothing is scheduled (reminder/FallbackReminderRuntime.kt FallbackReminderScheduling.cancel).
        // The same for every path, idempotent (cancelling cancelled work is nothing), last and in its own runCatching
        // for push's reason. Its wake checks the session too: the backstop for an ending no seam sees.
        runCatching { endFallbackReminder() }
    }

/** The app's seam: the sampler stopped through DetectionScheduling's one stop, on the application context. */
internal fun processSessionEndSeam(context: Context): SessionEndSeam {
    val app = context.applicationContext
    return deviceSessionEndSeam(
        stopSampling = { DetectionScheduling.stopSampling(app) },
        endPush = { endPushOnThisPhone(app) },
        endFallbackReminder = { FallbackReminderScheduling.cancel(app) },
    )
}

/**
 * R1181: THE DEVICE'S LocalStore AS THE APP HOLDS IT - each of DeviceLocalStore's three scopes, through the seam. The
 * one construction (account/DeviceLocalStores.kt) returns this, so whoever is handed the device's store cannot clear
 * an account without ending its session here. The seam is a required argument: no construction can forget it.
 *
 * THE SEAM RUNS FIRST, THE CLEAR IN A finally. The sampler is stopped before anything that can throw, and the clear -
 * the privacy half - runs whether the seam returned or threw.
 */
internal class SessionEndingStore(
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
