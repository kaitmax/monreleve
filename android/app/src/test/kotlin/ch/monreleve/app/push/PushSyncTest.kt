package ch.monreleve.app.push

import ch.monreleve.app.auth.OneTokenStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.remote.TransportException
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-FCM-CLIENT (R1151, R1153). REGISTRATION THROUGH A FAKE TRANSPORT. The pass runs over the REAL SessionManager and
// AuthApi (the bearer header, the 2xx reading), with only the HTTP seam replaced - so what is asserted is what would
// leave the phone, request by request.

private const val BASE = "http://127.0.0.1:3980"
private const val ACCOUNT = "account-camille"
private const val VERSION = "0.1.0"

/** The fake's tokens: visibly not registrations (fixtures/push-client-cases.json registration.fakeToken's shape). */
internal class FakePushTokens(
    var token: String? = "fake-fcm-token-from-the-test-transport-not-a-registration",
) : PushTokens {
    var discards = 0

    override suspend fun current(): String? = token

    override fun discard() {
        discards += 1
    }
}

/** Records every request; answers each path with a scripted status (200 unless told), or throws when unreachable. */
internal class FakeHttp : HttpTransport {
    val requests = mutableListOf<HttpRequest>()
    val status = mutableMapOf<String, Int>()
    var unreachable = false

    override suspend fun execute(request: HttpRequest): HttpResponse {
        requests += request
        if (unreachable) throw TransportException("the fake is unreachable")
        val path = request.url.removePrefix(BASE)
        return HttpResponse(status[path] ?: 200, "{}")
    }

    fun to(path: String): List<HttpRequest> = requests.filter { it.url == BASE + path }
}

class PushSyncTest {
    private val http = FakeHttp()
    private val tokens = FakePushTokens()
    private val store = InMemoryPushRecordStore()
    private val pair = TokenPair("access-1", "refresh-1", "2099-01-01T00:00:00Z", "2099-01-01T00:00:00Z")
    private val session = SessionManager(AuthApi(http, BASE), OneTokenStore(pair))

    private var signedIn = true
    private var account: String? = ACCOUNT
    private var config: PushConfig = pushConfigOf("p", "1:1:android:1", "k", "1")
    private var playServices = true
    private var permission = true
    private var optedIn = true

    private fun sync(): PushStatus =
        kotlinx.coroutines.runBlocking {
            PushSync(
                PushConditions(
                    config = config,
                    signedIn = { signedIn },
                    account = { account },
                    playServices = { playServices },
                    permission = { permission },
                    optedIn = { optedIn },
                ),
                tokens,
                SessionPushServer(session),
                store,
                VERSION,
            ).sync()
        }

    private fun available(): Boolean =
        pushAvailable(store.load(), account, signedIn, config is PushConfig.Configured, playServices, permission)

    @Test
    fun aSignedInOptedInPhoneRegistersItsTokenThenWritesTheOptIn() {
        assertEquals(PushStatus.AVAILABLE, sync())

        val register = http.to(DEVICES_PATH).single()
        assertEquals(HttpMethod.POST, register.method)
        assertEquals("Bearer access-1", register.headers["Authorization"])
        val body = JSONObject(register.body!!)
        assertEquals(tokens.token, body.getString(KEY_FCM_TOKEN))
        assertEquals(VERSION, body.getString(KEY_APP_VERSION))
        assertFalse("the route refuses `platform` (it contains `lat`)", body.has("platform"))

        val optIn = http.to(ME_PATH).single()
        assertEquals(HttpMethod.PATCH, optIn.method)
        assertEquals(true, JSONObject(optIn.body!!).getBoolean(KEY_REMINDER_ENABLED))
        // Registration first: the opt-in is written only for a phone the server can reach.
        assertTrue(http.requests.indexOf(register) < http.requests.indexOf(optIn))

        assertEquals(PushRecord(ACCOUNT, registered = true, serverReminderEnabled = true), store.load())
        assertTrue("R1153: registered, opted in, permitted -> push available", available())
    }

    @Test
    fun everyLaunchReRegistersButTheOptInIsWrittenOnce() {
        sync()
        sync()
        assertEquals("api-v1 section 10: one call on every launch", 2, http.to(DEVICES_PATH).size)
        assertEquals("the server already holds the opt-in this phone wrote", 1, http.to(ME_PATH).size)
    }

    @Test
    fun nothingLeavesThePhoneWhenPushIsNotConfigured() {
        config = PushConfig.NotConfigured
        assertEquals(PushStatus.NOT_CONFIGURED, sync())
        assertTrue("R1150: an unconfigured build sends nothing at all", http.requests.isEmpty())
        assertFalse(available())
    }

    @Test
    fun nothingLeavesThePhoneWhenSignedOut() {
        signedIn = false
        assertEquals(PushStatus.SIGNED_OUT, sync())
        assertTrue(http.requests.isEmpty())
        assertNull(store.load())
    }

    @Test
    fun withoutPermissionOrPlayServicesThereIsNoRegistration() {
        permission = false
        assertEquals(PushStatus.NO_PERMISSION, sync())
        permission = true
        playServices = false
        assertEquals(PushStatus.NO_PLAY_SERVICES, sync())
        assertTrue(http.to(DEVICES_PATH).isEmpty())
        assertFalse(available())
    }

    @Test
    fun aRefusedRegistrationIsNotAvailableAndDoesNotTouchTheOptIn() {
        http.status[DEVICES_PATH] = 400
        assertEquals("R1191: a 4xx is an answer, not an acceptance", PushStatus.REGISTRATION_REFUSED, sync())
        assertTrue("nothing to remind through: the opt-in is not written", http.to(ME_PATH).isEmpty())
        assertFalse(available())
    }

    @Test
    fun aTransientFailureLeavesTheServerOptInAsItWas() {
        sync() // the phone wrote reminderEnabled = true
        http.requests.clear()
        http.status[DEVICES_PATH] = 503
        assertEquals(PushStatus.REGISTRATION_REFUSED, sync())
        assertTrue("a bad moment must not switch the person's reminders off", http.to(ME_PATH).isEmpty())
        assertEquals(true, store.load()?.serverReminderEnabled)
        assertFalse("but the phone does not claim push either", available())

        http.requests.clear()
        tokens.token = null
        assertEquals(PushStatus.NO_TOKEN, sync())
        assertTrue(http.to(ME_PATH).isEmpty())
    }

    @Test
    fun anUnreachableServerIsNotARegistration() {
        http.unreachable = true
        assertEquals(PushStatus.REGISTRATION_REFUSED, sync())
        assertFalse(available())
    }

    @Test
    fun optingOutWritesFalseOnlyBecauseThisPhoneWroteTrue() {
        sync()
        http.requests.clear()
        optedIn = false
        assertEquals(PushStatus.REGISTERED_NOT_OPTED_IN, sync())
        assertEquals(false, JSONObject(http.to(ME_PATH).single().body!!).getBoolean(KEY_REMINDER_ENABLED))
        assertEquals(false, store.load()?.serverReminderEnabled)
        assertFalse("opted out: the server will not remind, so push is not available", available())
    }

    @Test
    fun aPhoneThatNeverWroteTheOptInDoesNotSwitchItOff() {
        optedIn = false
        assertEquals(PushStatus.REGISTERED_NOT_OPTED_IN, sync())
        assertTrue("another phone's opt-in is not this phone's to clear", http.to(ME_PATH).isEmpty())
    }

    @Test
    fun losingThePermissionSwitchesOffTheOptInThisPhoneWrote() {
        sync()
        http.requests.clear()
        permission = false
        assertEquals(PushStatus.NO_PERMISSION, sync())
        assertEquals(false, JSONObject(http.to(ME_PATH).single().body!!).getBoolean(KEY_REMINDER_ENABLED))
    }

    @Test
    fun aRefusedOptInIsNotAvailable() {
        http.status[ME_PATH] = 400
        assertEquals(PushStatus.REGISTERED_NOT_OPTED_IN, sync())
        assertNull(store.load()?.serverReminderEnabled)
        assertFalse(available())
    }

    @Test
    fun theRecordBelongsToOneAccount() {
        sync()
        account = "account-dominique"
        assertFalse("another account's record never makes push available", available())
        http.requests.clear()
        sync()
        assertEquals("the new account's opt-in is written for it", 1, http.to(ME_PATH).size)
        assertEquals("account-dominique", store.load()?.account)
    }

    @Test
    fun sessionEndForgetsTheRecordAndDiscardsTheToken() {
        sync()
        pushSessionEnded(store, tokens)
        assertNull(store.load())
        assertEquals(1, tokens.discards)
        assertFalse(available())
    }

    @Test
    fun sessionEndNeverThrowsEvenWhenTheTokenCannotBeDiscarded() {
        sync()
        val throwing =
            object : PushTokens {
                override suspend fun current(): String? = null

                override fun discard() = error("firebase is not there")
            }
        pushSessionEnded(store, throwing)
        assertNull(store.load())
    }

    @Test
    fun theServerSeamIsTheSessionsTwoVerbs() =
        runTest {
            val server = SessionPushServer(session)
            assertTrue(server.register(registrationBody("t", VERSION)) is PostOutcome.Ok)
            assertTrue(server.setReminderEnabled(reminderOptInBody(true)) is PostOutcome.Ok)
            assertEquals(listOf(HttpMethod.POST, HttpMethod.PATCH), http.requests.map { it.method })
        }
}
