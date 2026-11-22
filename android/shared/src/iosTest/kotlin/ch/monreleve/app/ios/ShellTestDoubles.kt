package ch.monreleve.app.ios

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEnds
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.datetime.TimeZone
import platform.UserNotifications.UNNotificationRequest
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-SHELL-1 (R1321, R1323, R1324, R1329). THE DOUBLES THE SHELL'S iosTests DRIVE startIosShell WITH.
//
// The iosTest process has no app bundle (AppHostProbeIosTest's header): the Keychain, UserDefaults and the notification
// centre cannot all be reached from it, so the composition takes each as a parameter and these stand in - every read
// and write written to ONE ordered event log, so a test asserts the ORDER of the start path, not only its outcome
// (R1321). The database, the dossier cache and the export directory are the REAL iOS ones, in a fresh temporary
// directory. Nothing here holds a real token or address: the domain is .invalid.

internal const val SHELL_BASE_URL = "https://monreleve.invalid"
internal const val SHELL_ADDRESS = "ios-shell-1@monreleve.invalid"

/** Monday 2026-11-16 10:00Z - a working day, so the evening plan holds requests. */
internal const val SHELL_NOW = "2026-11-16T10:00:00Z"

internal val SHELL_PAIR = TokenPair("acc", "ref", "2099-06-15T11:00:00Z", "2099-09-13T10:00:00Z")

// fixtures/me-cases.json's "route: complete, simplified basis, manual".
internal const val SHELL_COMPLETE_ME =
    """{"name":"Camille Rey","canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240",""" +
        """"exactTotalWorkDays":null,"granularity":"DAY","activityStartDate":null,"reminderTime":"17:30",""" +
        """"reminderEnabled":false,"loggingMode":"MANUAL","detectionConsentAt":null}"""

internal val SHELL_COMPLETE_SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille Rey")

/** One ordered log of every store and marker call the start path makes. */
internal class EventLog {
    val events = mutableListOf<String>()

    fun add(event: String) {
        events += event
    }

    /** The index of the first event equal to [event], or -1. */
    fun first(event: String): Int = events.indexOf(event)
}

internal class LoggedTokens(
    private val log: EventLog,
    var pair: TokenPair?,
) : TokenStore {
    override fun save(pair: TokenPair) {
        log.add("tokens.save")
        this.pair = pair
    }

    override fun load(): TokenPair? = pair.also { log.add("tokens.load") }

    override fun clear() {
        log.add("tokens.clear")
        pair = null
    }
}

internal class LoggedPending(
    private val log: EventLog,
    var value: String?,
) : PendingSignInStore {
    override fun remember(email: String) {
        log.add("pending.remember")
        value = email
    }

    override fun pending(): String? = value.also { log.add("pending.read") }

    override fun clear() {
        log.add("pending.clear")
        value = null
    }
}

internal class LoggedAccount(
    private val log: EventLog,
    var tag: String?,
) : AccountStore {
    override fun current(): String? = tag.also { log.add("account.read") }

    override fun setCurrent(tag: String) {
        log.add("account.set")
        this.tag = tag
    }

    override fun clear() {
        log.add("account.clear")
        tag = null
    }
}

internal class LoggedMarker(
    private val log: EventLog,
    var marked: Boolean,
) : FirstLaunchMarker {
    override fun isSet(): Boolean = marked.also { log.add("marker.read") }

    override fun set() {
        log.add("marker.set")
        marked = true
    }
}

/** A centre that HOLDS the pending set as the system would, so a test reads it before and after (R1323). */
internal class RecordingCentre(
    private val grants: Boolean = true,
) : IosNotificationCentre {
    val pending = linkedSetOf<String>()
    var removeAllCalls = 0
    var authorizationAsks = 0

    override fun removePending(identifiers: List<String>) {
        pending -= identifiers.toSet()
    }

    override fun add(request: UNNotificationRequest) {
        pending += request.identifier
    }

    override fun removeAllPending() {
        removeAllCalls += 1
        pending.clear()
    }

    override fun requestAuthorization(onAnswer: (granted: Boolean) -> Unit) {
        authorizationAsks += 1
        onAnswer(grants)
    }

    override fun readAuthorization(onAnswer: (permitted: Boolean) -> Unit) = onAnswer(grants)

    override fun deliveredIdentifiers(onAnswer: (List<String>) -> Unit) = onAnswer(emptyList())
}

/** Answers every request from [answer] and records "METHOD /path" in order. */
internal class RecordingTransport(
    private val answer: (method: String, path: String) -> HttpResponse,
) : HttpTransport {
    val requests = mutableListOf<String>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        val path = request.url.removePrefix(SHELL_BASE_URL).substringBefore('?')
        val line = "${request.method} $path"
        requests += line
        return answer(request.method.name, path)
    }
}

/** The answers a signed-in shell meets: /me for a complete account, everything else an empty 200. */
internal fun completeAccountServer(): RecordingTransport =
    RecordingTransport { method, path ->
        when {
            method == "GET" && path == "/api/v1/me" -> HttpResponse(200, SHELL_COMPLETE_ME)
            else -> HttpResponse(200, "{}")
        }
    }

/** Everything one test's shell is built from, with the doubles above and a fresh directory for the real stores. */
@Suppress("LongParameterList")
internal class ShellRig(
    marked: Boolean,
    pair: TokenPair?,
    pendingAddress: String?,
    account: String?,
    settings: Settings?,
    val transport: RecordingTransport = completeAccountServer(),
    val centre: RecordingCentre = RecordingCentre(),
    eveningOptedIn: Boolean = false,
) {
    val log = EventLog()
    val tokens = LoggedTokens(log, pair)
    val pending = LoggedPending(log, pendingAddress)
    val account = LoggedAccount(log, account)
    val marker = LoggedMarker(log, marked)
    val settings = InMemorySettingsStore(settings)
    val evening = InMemoryEveningNotificationStore().also { it.setEnabled(eveningOptedIn) }
    val consentAsked = mutableListOf<Boolean>()
    val directory = freshTempDirectory()
    val database = buildIosDatabase(directory)
    val logLines = mutableListOf<String>()

    @OptIn(ExperimentalTime::class) // KMP-DT R590: the fixed kotlin.time.Clock it hands in - on the allowlist.
    val shell: IosShell =
        startIosShell(
            apiBaseUrl = SHELL_BASE_URL,
            appVersion = "0.1.0 (1)",
            transport = transport,
            tokenStore = tokens,
            pending = pending,
            accountStore = this.account,
            settingsStore = this.settings,
            dossierCache = FileDossierCache("$directory/dossier"),
            marker = marker,
            database = { database },
            exportFiles = { IosExportFiles("$directory/exports") },
            centre = centre,
            eveningStore = evening,
            consentBody = { enable ->
                consentAsked += enable
                detectionConsentUnreachableOnIos(enable)
            },
            reportUnowned = {},
            log = { logLines += it },
            sessionEnds = SessionEnds(),
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
            clock =
                object : Clock {
                    override fun now(): Instant = Instant.parse(SHELL_NOW)
                },
            zone = TimeZone.of("Europe/Paris"),
        )

    fun close() {
        database.close()
        removeDirectory(directory)
    }
}
