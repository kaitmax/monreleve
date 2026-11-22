package ch.monreleve.app.ios

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEnds
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.remote.HttpBytesResponse
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.TimeZone
import platform.Foundation.NSLock
import platform.Foundation.NSUserDefaults
import platform.UserNotifications.UNNotificationRequest
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-SHELL-1 (R1321, R1323, R1324, R1329), IOS-SHELL-2 (R1330-R1339). THE DOUBLES THE SHELL'S iosTests DRIVE
// startIosShell WITH.
//
// The iosTest process has no app bundle (AppHostProbeIosTest's header): the Keychain and the notification centre cannot
// be reached from it, so the composition takes each as a parameter and these stand in - every store read and write
// written to ONE ordered event log, so a test asserts the ORDER of the start path, not only its outcome (R1321). The
// database, the dossier cache, the export directory and - since IOS-SHELL-2 - the detection file's NSUserDefaults
// (a suite of the test's own, R1337) are the REAL iOS ones, in a fresh temporary place. Nothing here holds a real
// token or address: the domain is .invalid.
//
// IOS-SHELL-2: the rig can RELAUNCH (a new startIosShell over the same persistent stores, as a new process would),
// hands the root a lifecycle owner the test moves (the foreground, R1332), records what was opened and shared, and its
// centre keeps the requests themselves (their category, R1330) and can answer the authorization LATE, as the system
// does, so a plan that does not wait for the answer is caught.

internal const val SHELL_BASE_URL = "https://monreleve.invalid"
internal const val SHELL_ADDRESS = "ios-shell-1@monreleve.invalid"

/** Monday 2026-11-16 10:00Z - a working day, so the evening plan holds requests. */
internal const val SHELL_NOW = "2026-11-16T10:00:00Z"

/** SHELL_NOW's day in Paris - the day "recording today" removes from the plan. */
internal const val SHELL_TODAY = "2026-11-16"

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

/**
 * A centre that HOLDS the pending set as the system would, so a test reads it before and after (R1323), and keeps the
 * requests themselves (R1330: their category). [grants] answers both the prompt and the read; with [late], the read is
 * answered after LATE_MILLIS on another thread, as the system answers on a queue of its own (R1330's fresh read).
 */
internal class RecordingCentre(
    var grants: Boolean = true,
    private val late: Boolean = false,
) : IosNotificationCentre {
    // The plans run on the rig's background scope while the test reads on its own thread: every access holds the lock.
    private val lock = NSLock()
    val pending = linkedSetOf<String>()
    val requests = mutableListOf<UNNotificationRequest>()
    var removeAllCalls = 0
    var authorizationAsks = 0

    private fun <T> locked(block: () -> T): T {
        lock.lock()
        try {
            return block()
        } finally {
            lock.unlock()
        }
    }

    /** The pending identifiers now, copied under the lock. */
    fun pendingNow(): Set<String> = locked { pending.toSet() }

    /** Every request ever added, copied under the lock. */
    fun requestsNow(): List<UNNotificationRequest> = locked { requests.toList() }

    /** Empties the pending set, as if nothing had been planned - so a trigger's refill is ITS observable (R1330). */
    fun forgetPending() = locked { pending.clear() }

    override fun removePending(identifiers: List<String>) =
        locked {
            pending -= identifiers.toSet()
            Unit
        }

    override fun add(request: UNNotificationRequest) =
        locked {
            requests += request
            pending += request.identifier
            Unit
        }

    override fun removeAllPending() =
        locked {
            removeAllCalls += 1
            pending.clear()
        }

    override fun requestAuthorization(onAnswer: (granted: Boolean) -> Unit) {
        authorizationAsks += 1
        onAnswer(grants)
    }

    override fun readAuthorization(onAnswer: (permitted: Boolean) -> Unit) {
        val answer = grants
        if (late) {
            CoroutineScope(Dispatchers.Default).launch {
                delay(LATE_MILLIS)
                onAnswer(answer)
            }
        } else {
            onAnswer(answer)
        }
    }

    override fun deliveredIdentifiers(onAnswer: (List<String>) -> Unit) = onAnswer(emptyList())

    companion object {
        const val LATE_MILLIS = 300L
    }
}

/**
 * Answers every request from [answer] and records "METHOD /path" in order; a binary request (an export) is answered
 * by [bytesAnswer], and FAILS loudly when none is given (HttpTransport's own default).
 */
internal class RecordingTransport(
    private val bytesAnswer: ((path: String) -> HttpBytesResponse)? = null,
    private val answer: (method: String, path: String) -> HttpResponse,
) : HttpTransport {
    // The drain and the controllers call from background threads while the test reads: both sides hold the lock.
    private val lock = NSLock()
    private val recorded = mutableListOf<String>()

    /** Every request so far, "METHOD /path", in order - a copy taken under the lock. */
    val requests: List<String>
        get() {
            lock.lock()
            try {
                return recorded.toList()
            } finally {
                lock.unlock()
            }
        }

    private fun record(request: HttpRequest): String {
        val path = request.url.removePrefix(SHELL_BASE_URL).substringBefore('?')
        lock.lock()
        try {
            recorded += "${request.method} $path"
        } finally {
            lock.unlock()
        }
        return path
    }

    override suspend fun execute(request: HttpRequest): HttpResponse {
        val path = record(request)
        return answer(request.method.name, path)
    }

    override suspend fun executeForBytes(request: HttpRequest): HttpBytesResponse {
        val path = record(request)
        val respond = bytesAnswer ?: throw UnsupportedOperationException("no binary answer in this test")
        return respond(path)
    }
}

/** The answers a signed-in shell meets: /me for a complete account, everything else an empty 200. */
internal fun completeAccountServer(bytesAnswer: ((path: String) -> HttpBytesResponse)? = null): RecordingTransport =
    RecordingTransport(bytesAnswer) { method, path ->
        when {
            method == "GET" && path == "/api/v1/me" -> HttpResponse(200, SHELL_COMPLETE_ME)
            else -> HttpResponse(200, "{}")
        }
    }

/** R1333: what the shell asked to open; [canOpenMail] is this "phone"'s canOpenURL answer for message://. */
internal class RecordingUrlOpener(
    private val canOpenMail: Boolean,
    private val opens: Boolean = true,
) : IosUrlOpener {
    val opened = mutableListOf<String>()

    override fun canOpen(url: String): Boolean = url == MAIL_APP_URL && canOpenMail

    override fun open(
        url: String,
        onResult: (opened: Boolean) -> Unit,
    ) {
        opened += url
        onResult(opens)
    }
}

/** R1332: a lifecycle the test moves - CREATED is "in the background", RESUMED "in the foreground". */
internal class TestLifecycleOwner(
    initial: Lifecycle.State,
) : LifecycleOwner {
    private val registry = LifecycleRegistry.createUnsafe(this).also { it.currentState = initial }

    override val lifecycle: Lifecycle get() = registry

    fun moveTo(state: Lifecycle.State) {
        registry.currentState = state
    }
}

/** Everything one test's shell is built from, with the doubles above and fresh places for the real stores. */
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
    canOpenMail: Boolean = false,
    opensUrls: Boolean = true,
    foreground: Lifecycle.State = Lifecycle.State.RESUMED,
) {
    val log = EventLog()
    val tokens = LoggedTokens(log, pair)
    val pending = LoggedPending(log, pendingAddress)
    val account = LoggedAccount(log, account)
    val marker = LoggedMarker(log, marked)
    val settings = InMemorySettingsStore(settings)
    val consentAsked = mutableListOf<Boolean>()
    val directory = freshTempDirectory()
    private val suite = uniqueName("ios-shell-2.detection")
    var database: MonReleveDatabase = buildIosDatabase(directory)
        private set
    val logLines = mutableListOf<String>()
    val urls = RecordingUrlOpener(canOpenMail, opensUrls)
    val shared = mutableListOf<String>()
    val taps = IosNotificationTaps()
    val lifecycle = TestLifecycleOwner(foreground)

    /** The detection file's storage, read as a relaunch reads it: a NEW NSUserDefaults over the test's own suite. */
    fun defaults(): NSUserDefaults = NSUserDefaults(suiteName = suite)

    /** The evening opt-in as persisted (R1337) - read through a fresh instance, never the shell's. */
    val evening: UserDefaultsEveningNotificationStore get() = UserDefaultsEveningNotificationStore(defaults())

    init {
        evening.setEnabled(eveningOptedIn)
    }

    private val uncaught = CoroutineExceptionHandler { _, e -> logLines += "uncaught: $e" }

    // ONE opt-in for the whole rig (the ExperimentalTime allowlist counts this file at 1): the builder below is the ONE
    // place startIosShell is called and the fixed clock named.
    @OptIn(ExperimentalTime::class) // KMP-DT R590: the fixed kotlin.time.Clock it hands in - on the allowlist.
    private val build: () -> IosShell = {
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
            detectionDefaults = defaults(),
            urlOpener = urls,
            presentShare = { path -> shared += path },
            taps = taps,
            consentBody = { enable ->
                consentAsked += enable
                detectionConsentUnreachableOnIos(enable)
            },
            reportUnowned = {},
            log = { logLines += it },
            sessionEnds = SessionEnds(),
            // A stray failure in a launched plan is LOGGED, never left to end the test process (Kotlin/Native ends it
            // on an unhandled coroutine exception - every later test would be lost, as run B's SIGSEGV lost them).
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + uncaught),
            clock =
                object : Clock {
                    override fun now(): Instant = Instant.parse(SHELL_NOW)
                },
            zone = TimeZone.of("Europe/Paris"),
        )
    }

    var shell: IosShell = build()
        private set

    /**
     * R1337: a RELAUNCH - the record's database reopened from its file and a new startIosShell over the same persistent
     * stores (the suite, the Keychain doubles, the database file), as a new process builds it. Nothing of the previous
     * shell's memory is handed over.
     */
    fun relaunch(): IosShell {
        database.close()
        database = buildIosDatabase(directory)
        shell = build()
        return shell
    }

    fun close() {
        database.close()
        removeDirectory(directory)
        NSUserDefaults.standardUserDefaults.removePersistentDomainForName(suite)
    }
}

/** The shell's root, as the app hosts it, under the rig's own lifecycle owner (the app's comes from its controller). */
@OptIn(ExperimentalTestApi::class)
internal fun ComposeUiTest.setShellContent(rig: ShellRig) {
    setContent { CompositionLocalProvider(LocalLifecycleOwner provides rig.lifecycle) { IosShellRoot(rig.shell) } }
}
