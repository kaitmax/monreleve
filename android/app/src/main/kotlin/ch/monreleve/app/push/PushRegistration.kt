package ch.monreleve.app.push

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.data.remote.ME_PATH
import org.json.JSONObject

// AN-FCM-CLIENT (R1151, R1153). REGISTRATION: WHAT THE PHONE TELLS THE SERVER SO THAT A PUSH CAN REACH IT, AND THE
// ONE NAMED STATE THAT SAYS WHETHER ONE WILL.
//
// THE CONTRACT IS READ, NOT RETYPED (R181). docs/api-v1.md section 10: POST /api/v1/devices takes { fcmToken,
// platform?, appVersion? }, is idempotent per token, reassigns the row to whoever is signed in, and is "made after
// sign-in and on every launch afterwards". The bodies below are the ones fixtures/push-client-cases.json holds, and
// web/tests/db/push-client-join.test.ts posts that same fixture to the real route (R204).
//
// NO `platform` IN THE BODY, ON PURPOSE. It is optional with default "android", and the route refuses it: the
// coordinate refusal (web/lib/entries/no-coordinates.ts) matches banned keys as substrings, and "platform" contains
// "lat" - so naming it answers 400 coordinates_refused. NOTICED in the report; the app takes the default.
//
// A TOKEN THE SERVER NEVER SENDS TO IS NOT PUSH. The daily job (web/lib/reminders/job.ts) selects people by
// User.reminderEnabled, and before this task nothing in the app wrote it - a registered token would have received
// nothing, ever. SPEC section 8: "reminderEnabled - true only after push permission granted"; SPEC 13.3: opt-in. So
// the phone writes it: TRUE when this phone is registered and the person has opted in to the evening reminder (the
// one opt-in the app has, R323/R339); FALSE when they opt out or push cannot work here (no config, no Play services,
// no notification permission) - and FALSE only when this phone is the one that turned it on, so a phone that never
// held it does not switch off another's. A transient failure (no token, a refused or unreachable registration)
// changes nothing on the server: one bad network moment must not cost the person their reminders.
//
// "PUSH AVAILABLE" (R1153) IS THEREFORE FOUR FACTS AND ONE RECORD: configured, Play services present, notification
// permission granted, and - for the account signed in now - a registration the server accepted (2xx) AND the
// server holding reminderEnabled = true because this phone wrote it. A7's 19:00 fallback reads it
// ([pushAvailable], and PushAvailability.isPushAvailable on the device): when it is false, the server will not
// remind this person on this phone, and the fallback may.
//
// AN OK IS AN ANSWER, NOT AN ACCEPTANCE (R1191). Only a 2xx counts; a 4xx is a refusal, and is recorded as one.

internal const val DEVICES_PATH = "/api/v1/devices"
internal const val KEY_FCM_TOKEN = "fcmToken"
internal const val KEY_APP_VERSION = "appVersion"
internal const val KEY_REMINDER_ENABLED = "reminderEnabled"

/** R1151: the POST /api/v1/devices body for [token] - fixtures/push-client-cases.json's registration.body. */
internal fun registrationBody(
    token: String,
    appVersion: String,
): String = JSONObject().put(KEY_FCM_TOKEN, token).put(KEY_APP_VERSION, appVersion).toString()

/** The PATCH /api/v1/me body that sets the server's opt-in - fixtures/push-client-cases.json's optIn.body. */
internal fun reminderOptInBody(enabled: Boolean): String = JSONObject().put(KEY_REMINDER_ENABLED, enabled).toString()

/** What this phone last established with the server, for ONE account (R1153). Never the token itself. */
internal data class PushRecord(
    val account: String,
    /** POST /api/v1/devices answered 2xx on the last pass. */
    val registered: Boolean,
    /** The reminderEnabled this phone last saw the server accept (2xx), or null when this phone never wrote it. */
    val serverReminderEnabled: Boolean?,
)

internal interface PushRecordStore {
    fun load(): PushRecord?

    fun save(record: PushRecord)

    fun clear()
}

internal class InMemoryPushRecordStore(
    private var record: PushRecord? = null,
) : PushRecordStore {
    override fun load(): PushRecord? = record

    override fun save(record: PushRecord) {
        this.record = record
    }

    override fun clear() {
        record = null
    }
}

/** The registration token's source: Firebase on a device, a fake in every JVM test. */
internal interface PushTokens {
    /** The current registration token, or null when none can be had (no network, no Play services...). */
    suspend fun current(): String?

    /** Invalidate this install's token (session end). Fire-and-forget; never throws. */
    fun discard()
}

/** The two calls registration makes, as the session makes them (refresh-once-and-replay included). */
internal interface PushServer {
    suspend fun register(body: String): PostOutcome

    suspend fun setReminderEnabled(body: String): PostOutcome
}

/** Why push is or is not available on this phone after a pass (R1153). Logged by name; never a token. */
internal enum class PushStatus {
    SIGNED_OUT,
    NOT_CONFIGURED,
    NO_PLAY_SERVICES,
    NO_PERMISSION,
    NO_TOKEN,
    REGISTRATION_REFUSED,
    REGISTERED_NOT_OPTED_IN,
    AVAILABLE,
}

/** What a pass reads from the phone, each read when the pass runs (R423). */
internal class PushConditions(
    val config: PushConfig,
    val signedIn: () -> Boolean,
    val account: () -> String?,
    val playServices: () -> Boolean,
    val permission: () -> Boolean,
    val optedIn: () -> Boolean,
)

/**
 * R1153 - THE ONE NAMED STATE. True only when this phone will be reminded by the server today: signed in,
 * configured, Play services present, notification permission granted, and the [record] for the account signed in
 * now shows an accepted registration AND the server's reminderEnabled set true by this phone.
 */
@Suppress("LongParameterList")
internal fun pushAvailable(
    record: PushRecord?,
    account: String?,
    signedIn: Boolean,
    configured: Boolean,
    playServices: Boolean,
    permission: Boolean,
): Boolean {
    val facts = listOf(signedIn, account != null, configured, playServices, permission)
    return facts.all { it } &&
        record != null &&
        record.account == account &&
        record.registered &&
        record.serverReminderEnabled == true
}

/** R1151: one registration pass - see the header. Safe to run on every launch, opt-in change and token refresh. */
internal class PushSync(
    private val conditions: PushConditions,
    private val tokens: PushTokens,
    private val server: PushServer,
    private val store: PushRecordStore,
    private val appVersion: String,
) {
    suspend fun sync(): PushStatus {
        val who = conditions.account()
        if (!conditions.signedIn() || who == null) return PushStatus.SIGNED_OUT

        val prior = store.load()?.takeIf { it.account == who } ?: PushRecord(who, registered = false, null)
        val blocked = blockedBy()
        val registration = if (blocked == null) register() else blocked
        val registered = registration == null
        val serverOn = writeOptIn(wantedOptIn(registered, blocked), prior.serverReminderEnabled)
        store.save(PushRecord(who, registered, serverOn))

        return registration ?: if (serverOn == true) PushStatus.AVAILABLE else PushStatus.REGISTERED_NOT_OPTED_IN
    }

    /** Why push cannot work on this phone at all, or null. Read in order: an unconfigured build asks nothing else. */
    private fun blockedBy(): PushStatus? =
        when {
            conditions.config !is PushConfig.Configured -> PushStatus.NOT_CONFIGURED
            !conditions.playServices() -> PushStatus.NO_PLAY_SERVICES
            !conditions.permission() -> PushStatus.NO_PERMISSION
            else -> null
        }

    /** What the server's reminderEnabled should become, or null to leave it as it is (see the header). */
    private fun wantedOptIn(
        registered: Boolean,
        blocked: PushStatus?,
    ): Boolean? {
        val optedIn = conditions.optedIn()
        return when {
            registered -> optedIn
            blocked != null || !optedIn -> false
            else -> null // a transient failure: no token, a refused or unreachable registration
        }
    }

    /** POST the current token; null when the server accepted it (2xx), else why not. */
    private suspend fun register(): PushStatus? {
        val token = tokens.current() ?: return PushStatus.NO_TOKEN
        val answer = server.register(registrationBody(token, appVersion))
        return if (answer.accepted()) null else PushStatus.REGISTRATION_REFUSED
    }

    /**
     * Write [wanted] when it changes what the server holds: TRUE whenever the server does not already hold it from
     * this phone; FALSE only when this phone is the one that turned it on. Returns what the server now holds as far
     * as this phone knows - unchanged when the write was not needed or not accepted.
     */
    private suspend fun writeOptIn(
        wanted: Boolean?,
        serverOn: Boolean?,
    ): Boolean? {
        val target = wanted?.takeIf { (it && serverOn != true) || (!it && serverOn == true) } ?: return serverOn
        return if (server.setReminderEnabled(reminderOptInBody(target)).accepted()) target else serverOn
    }
}

/** R1191: an answer is an acceptance only when it is a 2xx. */
private fun PostOutcome.accepted(): Boolean = this is PostOutcome.Ok && status in HTTP_OK_RANGE

private val HTTP_OK_RANGE = 200..299

/**
 * R1152 / Android Ruling 8: what ending a session does to push on this phone, whichever path ended it. The record is
 * forgotten first (so "push available" is false at once, and A7's fallback is not silenced for nobody), then the
 * install's token is invalidated, so the server's next send for the old account answers 404 and its row is pruned
 * (docs/api-v1.md 10.4: no DELETE route; "pruned when the service reports it dead"). Never throws.
 */
internal fun pushSessionEnded(
    store: PushRecordStore,
    tokens: PushTokens,
) {
    store.clear()
    // Fire-and-forget, and never through the seam: a phone where Firebase cannot be reached still ends its session.
    runCatching { tokens.discard() }
}

/** The [PushServer] the app uses: the process's session, so a 401 refreshes once and replays (R210). */
internal class SessionPushServer(
    private val session: SessionManager,
) : PushServer {
    override suspend fun register(body: String): PostOutcome = session.authenticatedPost(DEVICES_PATH, body)

    override suspend fun setReminderEnabled(body: String): PostOutcome = session.authenticatedPatch(ME_PATH, body)
}
