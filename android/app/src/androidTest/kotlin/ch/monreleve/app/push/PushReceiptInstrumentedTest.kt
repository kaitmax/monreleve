package ch.monreleve.app.push

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

// AN-FCM-CLIENT (R1154). A PUSH DELIVERED TO THE APP'S REAL FirebaseMessagingService ENTRY POINT, on a device.
//
// No Firebase project exists, so no real message can be sent. What FCM's own receiver does on a real delivery is start
// the app's MESSAGING_EVENT service with the c2dm RECEIVE intent and the message's data as extras; this test does
// exactly that, to MonRelevePushService, so the path under test is the SDK's handleIntent -> onMessageReceived ->
// maybeRemindFromPush -> the R339 evening notification, with nothing replaced but the clock (a fixed Friday, 17:31 in
// Paris, so the working-day gate is deterministic). The data is the server's: fixtures/push-client-cases.json's shape,
// web/lib/push/message.ts's keys.
//
// The person is "signed in" by a token pair in the real Keystore store (the session's isSignedIn reads it); the pair
// is never sent anywhere - receipt makes no network call. Provenance: emulator API 36 (MonReleve_API36), never the S9.

private const val TODAY = "2026-11-20"
private const val YESTERDAY = "2026-11-19"
private const val EVENING_CHANNEL = "monreleve.evening.proposal"
private const val EVENING_ID = 1001
private const val WAIT_MS = 10_000L
private const val SETTLE_MS = 3_000L
private const val POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS"
private const val FAR_FUTURE = "2099-01-01T00:00:00Z"

@RunWith(AndroidJUnit4::class)
class PushReceiptInstrumentedTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context = instrumentation.targetContext
    private val notifications = context.getSystemService(NotificationManager::class.java)
    private val tokens = KeystoreTokenStore(context)
    private val evening = SharedPrefsEveningNotificationStore(context)
    private var messages = 0

    @Before
    fun setUp() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            instrumentation.uiAutomation.grantRuntimePermission(context.packageName, POST_NOTIFICATIONS)
        }
        MonRelevePushService.clock = Clock.fixed(Instant.parse("2026-11-20T16:31:00Z"), ZoneOffset.UTC)
        notifications.cancelAll()
        context.getSharedPreferences("monreleve.detection", Context.MODE_PRIVATE).edit().clear().commit()
        evening.setEnabled(true)
        tokens.save(TokenPair("instrumented-access", "instrumented-refresh", FAR_FUTURE, FAR_FUTURE))
    }

    @After
    fun tearDown() {
        tokens.clear()
        notifications.cancelAll()
        context.getSharedPreferences("monreleve.detection", Context.MODE_PRIVATE).edit().clear().commit()
        MonRelevePushService.clock = Clock.systemUTC()
    }

    /** What FCM's receiver hands the app's service for a data-only message. */
    private fun deliver(data: Map<String, String>) {
        messages += 1
        val intent =
            Intent("com.google.android.c2dm.intent.RECEIVE")
                .setComponent(ComponentName(context, MonRelevePushService::class.java))
                .putExtra("google.message_id", "instrumented-$messages-${SystemClock.elapsedRealtime()}")
                .putExtra("from", "instrumented")
        data.forEach { (key, value) -> intent.putExtra(key, value) }
        context.startService(intent)
    }

    private fun reminder(day: String = TODAY) = mapOf("kind" to "daily_reminder", "day" to day, "mode" to "MANUAL")

    private fun eveningShown(waitMs: Long): android.service.notification.StatusBarNotification? {
        val deadline = SystemClock.elapsedRealtime() + waitMs
        while (SystemClock.elapsedRealtime() < deadline) {
            notifications.activeNotifications.firstOrNull { it.id == EVENING_ID }?.let { return it }
            SystemClock.sleep(POLL_MS)
        }
        return null
    }

    @Test
    fun aPushedReminderPostsTheExistingEveningNotification() {
        deliver(reminder())

        val shown = eveningShown(WAIT_MS)
        assertNotNull("the reminder reached onMessageReceived and posted R339's notification", shown)
        val notification = shown!!.notification
        assertEquals("R339's channel, not a new one", EVENING_CHANNEL, notification.channelId)
        assertNotNull("R339's lock-screen public version", notification.publicVersion)
        assertEquals("R339's two record buttons and Autre", 3, notification.actions?.size)
        assertEquals("the day is taken", TODAY, evening.lastNotifiedDay())
        assertEquals("exactly one Mon Releve notification", 1, notifications.activeNotifications.size)
    }

    @Test
    fun aSecondReminderTheSameDayShowsNothing() {
        deliver(reminder())
        assertNotNull(eveningShown(WAIT_MS))
        notifications.cancelAll()

        deliver(reminder())

        assertNull("Android Ruling 7: never a second one the same day", eveningShown(SETTLE_MS))
    }

    @Test
    fun signedOutAPushShowsNothing() {
        tokens.clear()

        deliver(reminder())

        assertNull("Android Ruling 8: the SIGNED-OUT row", eveningShown(SETTLE_MS))
        assertNull(evening.lastNotifiedDay())
    }

    @Test
    fun aLateReminderForYesterdayShowsNothing() {
        deliver(reminder(day = YESTERDAY))

        assertNull(eveningShown(SETTLE_MS))
    }

    private companion object {
        const val POLL_MS = 200L
    }
}
