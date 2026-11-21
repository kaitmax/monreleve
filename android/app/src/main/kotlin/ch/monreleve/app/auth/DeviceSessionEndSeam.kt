package ch.monreleve.app.auth

import android.content.Context
import ch.monreleve.app.detection.DetectionScheduling
import ch.monreleve.app.push.endPushOnThisPhone
import ch.monreleve.app.reminder.FallbackReminderScheduling

// AN-SESSION-END (R1181). WHAT THIS ANDROID PHONE STOPS WHEN A SESSION ENDS - the body of the "session ended" seam.
//
// IOS-MOVE-SEAM (R1280): the seam's contract (SessionEndPath, SessionEndSeam) and the wrapper that runs it
// (SessionEndingStore) moved to :shared commonMain, auth/SessionEndSeam.kt, package unchanged - its header tells the
// whole story of the seam. What stayed here is Android's: processSessionEndSeam reads the application Context
// (WorkManager, FCM), so it cannot compile in commonMain, and deviceSessionEndSeam is the Android body it builds -
// the sampler, push and the 19:00 fallback, the attachments A11, A8 and A7 made. This file holds the two, unchanged,
// under a name of its own (MovedTwinsFenceTest refuses a :app file named after a moved one).

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
