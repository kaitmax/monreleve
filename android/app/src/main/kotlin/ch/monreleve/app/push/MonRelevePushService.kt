package ch.monreleve.app.push

import androidx.annotation.VisibleForTesting
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.runBlocking
import java.time.Clock

// AN-FCM-CLIENT (R1151, R1152). THE APP'S FirebaseMessagingService - the one entry point FCM delivers to.
//
// Declared in src/main/AndroidManifest.xml, exported="false" (FCM's own receiver hands it the message; nothing outside
// the app can start it). Both callbacks run on the service's own background executor, so blocking there is what FCM
// expects; runBlocking keeps the work inside the callback, which is how long FCM keeps the process for it.
//
//   onMessageReceived  a data-only daily reminder (web/lib/push/fcm.ts) -> maybeRemindFromPush: R339's evening
//                      notification or nothing (PushReceipt.kt's rules and the one-a-day rule).
//   onNewToken         the install's token changed -> one registration pass (docs/api-v1.md section 10: the new
//                      token replaces the old by being registered). The token argument is not used or kept: the
//                      pass asks FirebaseMessaging for the current one, and nothing here prints it.
class MonRelevePushService : FirebaseMessagingService() {
    override fun onCreate() {
        // FCM can start this process with no activity: Firebase is built here when configured (PushRuntime.kt).
        firebaseReady(this)
        super.onCreate()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        runBlocking { maybeRemindFromPush(applicationContext, clock, message.data) }
    }

    override fun onNewToken(token: String) {
        runBlocking { syncPush(applicationContext) }
    }

    internal companion object {
        /** The clock receipt reads "today" from - the system's, replaced only by an instrumented test. */
        @VisibleForTesting
        @Volatile
        internal var clock: Clock = Clock.systemUTC()
    }
}
