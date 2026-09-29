package ch.monreleve.app.parametres

import ch.monreleve.app.account.DeviceLocalStore
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
            // ...and R295/PARKAN-28: the settings survived (a re-sign-in need not re-onboard).
            (settings.load() != null).shouldBeTrue()
        }
    }
})
