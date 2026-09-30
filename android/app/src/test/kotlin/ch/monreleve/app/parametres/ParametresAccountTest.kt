package ch.monreleve.app.parametres

import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN12 increment 2. « Exporter mes données » and the R295 sign-out. The sign-out is proven two ways: the
// controller flow (revoke + local wipe + SignedOut), and end to end - a real SessionManager sharing the token
// store finds NO session on the next call, because the LocalStore cleared it (R295, R204's flow shape).

private const val TAX_YEAR = 2026
private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

private class MutableSettingsStore(private var current: Settings? = SETTINGS) : SettingsStore {
    override fun load(): Settings? = current

    override fun save(settings: Settings) {
        current = settings
    }

    override fun clear() {
        current = null
    }
}

private class MutableTokenStore(private var pair: TokenPair? = TokenPair("a", "r", "0", "0")) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

private class FakeDossierCache(private var body: String? = "{}") : DossierCache {
    override fun load(year: Int): String? = body

    override fun save(
        year: Int,
        body: String,
    ) {
        this.body = body
    }

    override fun clear() {
        body = null
    }
}

private class FakePendingSignIn(private var email: String? = "camille@example.fr") : PendingSignInStore {
    override fun remember(email: String) {
        this.email = email
    }

    override fun pending(): String? = email

    override fun clear() {
        email = null
    }
}

/** Answers any request 200: the revoke POST is all this transport needs to satisfy. */
private class StubTransport : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse = HttpResponse(200, "{}")
}

private class NoopSaver : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
}

// A §14.1 receipt: `removed` is a map (two entries, an event), and alertSubscriptionRemains is present (§14.3).
private const val RECEIPT_JSON =
    """{"status":"ok","removed":{"User":1,"Entry":2,"EntryEvent":2},"alertSubscriptionRemains":true}"""

private class SpyLocalStore : LocalStore {
    var signOutCleared = false
    var deletionCleared = false

    override suspend fun clearForSignOut() {
        signOutCleared = true
    }

    override suspend fun clearForDeletion() {
        deletionCleared = true
    }
}

private fun localStore(
    tokens: TokenStore,
    settings: SettingsStore,
): DeviceLocalStore =
    DeviceLocalStore(
        tokenStore = tokens,
        settingsStore = settings,
        dossierCache = FakeDossierCache(),
        pendingSignIn = FakePendingSignIn(),
        clearRecord = {},
        cancelSync = {},
        clearExports = {},
    )

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresAccountTest : FunSpec({
    test("AC2: export hands the server's JSON record to the platform as a Ready event") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val bytes = byteArrayOf(1, 2, 3)
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    exportBytes = { BytesOutcome.Ok(200, ExportBytes(bytes, "mon-releve.json")) },
                )
            advanceUntilIdle()

            controller.exportData(AccountExportKind.JSON)
            advanceUntilIdle()

            controller.exportEvents.first() shouldBe
                ExportEvent.Ready(bytes = bytes, filename = "mon-releve.json", mimeType = "application/json")
        }
    }

    test("AC2: the CSV export requests the ?format=csv path") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val paths = mutableListOf<String>()
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    exportBytes = { path ->
                        paths += path
                        BytesOutcome.Ok(200, ExportBytes(byteArrayOf(9), null))
                    },
                )
            advanceUntilIdle()

            controller.exportData(AccountExportKind.CSV)
            advanceUntilIdle()

            paths.single() shouldBe "/api/v1/account/export?format=csv"
        }
    }

    test("export with no connectivity is RequiresConnectivity, a server refusal is Failed (SPEC 13.2)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val offline =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    exportBytes = { BytesOutcome.NetworkError },
                )
            advanceUntilIdle()
            offline.exportData(AccountExportKind.JSON)
            advanceUntilIdle()
            offline.exportEvents.first() shouldBe ExportEvent.RequiresConnectivity

            val refused =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    exportBytes = { BytesOutcome.Ok(503, ExportBytes(byteArrayOf(), null)) },
                )
            advanceUntilIdle()
            refused.exportData(AccountExportKind.JSON)
            advanceUntilIdle()
            refused.exportEvents.first() shouldBe ExportEvent.Failed
        }
    }

    test("PARKAN-27: the sign-out confirmation names how many recorded days have not yet synced") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            for (day in 1..3) repo.record(RecordCommand(dayDate = "2026-03-0$day", kind = EntryKind.HOME))
            val controller = ParametresController(NoopSaver(), MutableSettingsStore(), repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.requestSignOut()

            // Three days recorded, none synced (no drain ran): the confirmation must name all three.
            controller.state.value.signOutPrompt shouldBe SignOutPrompt(unsyncedDays = 3)
        }
    }

    test("cancelling sign-out clears the prompt and revokes nothing") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            var revoked = false
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    revokeServer = { revoked = true },
                    localStore = localStore(MutableTokenStore(), MutableSettingsStore()),
                )
            advanceUntilIdle()

            controller.requestSignOut()
            controller.cancelSignOut()
            advanceUntilIdle()

            controller.state.value.signOutPrompt shouldBe null
            revoked shouldBe false
        }
    }

    test("R295: confirming sign-out revokes the session and the next authenticated call is refused") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val tokens = MutableTokenStore()
            val settings = MutableSettingsStore()
            // A real session sharing the token store, so "next call refused" is proven through the real gateway.
            val session = SessionManager(AuthApi(StubTransport(), "http://10.0.2.2:3000"), tokens)
            val controller =
                ParametresController(
                    NoopSaver(),
                    settings,
                    repo,
                    TAX_YEAR,
                    this,
                    revokeServer = session::revokeServerSession,
                    localStore = localStore(tokens, settings),
                )
            advanceUntilIdle()

            controller.requestSignOut()
            controller.confirmSignOut()
            advanceUntilIdle()

            controller.accountEvents.first() shouldBe AccountEvent.SignedOut
            // R295: the LocalStore cleared the token, so the next call has no session...
            session.authenticatedGet("/api/v1/me") shouldBe AuthedOutcome.NoSession
            // ...and R297 (reverses PARKAN-28): the settings were cleared too. A re-sign-in restores them from
            // GET /api/v1/me before the onboarding decision, so nothing of one person's setup outlives the next.
            (settings.load() == null).shouldBeTrue()
        }
    }

    test("R289: the delete confirmation names the recorded days and, separately, the unsynced ones") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            for (day in 1..4) repo.record(RecordCommand(dayDate = "2026-03-0$day", kind = EntryKind.HOME))
            val controller = ParametresController(NoopSaver(), MutableSettingsStore(), repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.requestDelete()

            // Four recorded, none synced: both counts named for the confirmation.
            controller.state.value.deletePrompt shouldBe DeletePrompt(recordedDays = 4, unsyncedDays = 4)
        }
    }

    test("R289: confirming deletion sends SUPPRIMER, erases the device, surfaces the receipt, leaves for first-run") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val spy = SpyLocalStore()
            val posts = mutableListOf<Pair<String, String>>()
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    localStore = spy,
                    authenticatedPost = { path, body ->
                        posts += path to body
                        PostOutcome.Ok(200, RECEIPT_JSON)
                    },
                )
            advanceUntilIdle()

            controller.requestDelete()
            controller.confirmDelete()
            advanceUntilIdle()

            posts.single().first shouldBe "/api/v1/account/delete"
            posts.single().second.contains("SUPPRIMER").shouldBeTrue()
            // Device erased only after the server accepted (R289 / SPEC 14.2).
            spy.deletionCleared.shouldBeTrue()
            // The receipt is surfaced, alertSubscriptionRemains included (SPEC 14.3).
            controller.state.value.deleteOutcome shouldBe
                DeleteOutcome.Done(removedEntries = 2, alertSubscriptionRemains = true)

            controller.acknowledgeDelete()
            advanceUntilIdle()
            controller.accountEvents.first() shouldBe AccountEvent.Deleted
        }
    }

    test("R289: a server refusal is a partial-free failure - the device keeps its data (SPEC 14.2)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val spy = SpyLocalStore()
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    localStore = spy,
                    authenticatedPost = { _, _ -> PostOutcome.Ok(400, "{}") },
                )
            advanceUntilIdle()

            controller.requestDelete()
            controller.confirmDelete()
            advanceUntilIdle()

            controller.state.value.deleteOutcome shouldBe DeleteOutcome.Refused
            spy.deletionCleared shouldBe false
        }
    }

    test("R289 / SPEC 14.6: a call that did not complete keeps the device intact and cannot claim the server") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val spy = SpyLocalStore()
            val controller =
                ParametresController(
                    NoopSaver(),
                    MutableSettingsStore(),
                    repo,
                    TAX_YEAR,
                    this,
                    localStore = spy,
                    authenticatedPost = { _, _ -> PostOutcome.NetworkError },
                )
            advanceUntilIdle()

            controller.requestDelete()
            controller.confirmDelete()
            advanceUntilIdle()

            controller.state.value.deleteOutcome shouldBe DeleteOutcome.Unknown
            spy.deletionCleared shouldBe false
        }
    }

    test("R289 negative sweep: after a real deletion, nothing of the account remains on the device") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            // Every device store seeded non-null: presence is proven before the sweep asserts absence (FW26's shape).
            val tokens = MutableTokenStore()
            val settings = MutableSettingsStore()
            val cache = FakeDossierCache()
            val pending = FakePendingSignIn()
            var recordCleared = false
            var exportsCleared = false
            val real =
                DeviceLocalStore(
                    tokenStore = tokens,
                    settingsStore = settings,
                    dossierCache = cache,
                    pendingSignIn = pending,
                    clearRecord = { recordCleared = true },
                    cancelSync = {},
                    clearExports = { exportsCleared = true },
                )
            val controller =
                ParametresController(
                    NoopSaver(),
                    settings,
                    repo,
                    TAX_YEAR,
                    this,
                    localStore = real,
                    authenticatedPost = { _, _ -> PostOutcome.Ok(200, RECEIPT_JSON) },
                )
            advanceUntilIdle()

            controller.requestDelete()
            controller.confirmDelete()
            advanceUntilIdle()

            recordCleared.shouldBeTrue()
            exportsCleared.shouldBeTrue()
            tokens.load() shouldBe null
            settings.load() shouldBe null
            cache.load(TAX_YEAR) shouldBe null
            pending.pending() shouldBe null
        }
    }
})
