package ch.monreleve.app.auth

import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.data.local.MemoryDossierCache
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.AccountEvent
import ch.monreleve.app.parametres.DeleteOutcome
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-SESSION-END (R1181, R1182). THE "SESSION ENDED" SEAM, PATH BY PATH - the two the PERSON takes.
//
// Each test crosses the real entry point - ParametresController's confirmSignOut / confirmDelete, the screen's own
// calls - over a REAL DeviceLocalStore inside the SessionEndingStore the app's one construction returns
// (account/DeviceLocalStores.kt), with the seam built as the app builds it (deviceSessionEndSeam) over a spy of the one
// stop. So "the sampler was cancelled" is asserted at the end of the path a tap starts, not of a function called by
// hand (R204). The SERVER's endings - every cause R521/R522 lists - are asserted in ForcedSignOutTest, whose device
// ends its session through the same store (assertTookTheForcedPath / assertTriesLater).
//
// BOTH SIDES (R1182, R196's shape): beside each ending, the nearest thing that is NOT an ending - a sign-out cancelled,
// a deletion the server refused or never answered - leaves the sampler running.
//
// WHAT THE JVM CANNOT PROVE: that the composition root hands the screen this store, and that DetectionScheduling's stop
// cancels the unique work. The emulator walkthrough closes that (REPORT-AN-SESSION-END.txt, R1183).

private const val TAX_YEAR = 2026
private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)
private const val RECEIPT_JSON =
    """{"status":"ok","removed":{"User":1,"Entry":2,"EntryEvent":2},"alertSubscriptionRemains":true}"""

private class SeamNoopSaver : SettingsSaver {
    override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
}

private class SeamNoPendingSignIn : PendingSignInStore {
    override fun remember(email: String) = Unit

    override fun pending(): String? = null

    override fun clear() = Unit
}

/** One signed-in phone in automatic mode, its Parametres screen holding the device's store as the app hands it. */
private class SeamPhone(
    scope: TestScope,
    deleteAnswer: PostOutcome = PostOutcome.Ok(200, RECEIPT_JSON),
) {
    val tokens = OneTokenStore(TokenPair("access", "refresh", "0", "0"))
    val settings = InMemorySettingsStore(SETTINGS)
    val mode = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
    var recordCleared = false

    /** The one stop, spied: what DetectionScheduling.stopSampling is in the app. */
    var samplerStops = 0
    val paths = mutableListOf<SessionEndPath>()
    private val appSeam = deviceSessionEndSeam(stopSampling = { samplerStops += 1 })
    val store =
        SessionEndingStore(
            DeviceLocalStore(
                tokenStore = tokens,
                settingsStore = settings,
                dossierCache = MemoryDossierCache(),
                pendingSignIn = SeamNoPendingSignIn(),
                accountStore = MemoryAccountStore("acct-tag"),
                detectionModeStore = mode,
                clearRecord = { recordCleared = true },
                cancelSync = {},
                clearExports = {},
            ),
            SessionEndSeam { path ->
                paths += path
                appSeam.sessionEnded(path)
            },
        )
    val parametres =
        ParametresController(
            SeamNoopSaver(),
            settings,
            LocalEntryRepository(FakeEntryDao(), CLOCK),
            TAX_YEAR,
            scope,
            revokeServer = {},
            localStore = store,
            authenticatedPost = { _, _ -> deleteAnswer },
            modeStore = mode,
        )
}

@OptIn(ExperimentalCoroutinesApi::class)
class SessionEndSeamTest : FunSpec({
    test("R1181 SIGN-OUT: confirmed -> the session ends through the seam, the sampler cancelled") {
        runTest {
            val phone = SeamPhone(this)
            advanceUntilIdle()

            phone.parametres.requestSignOut()
            advanceUntilIdle()
            phone.parametres.confirmSignOut()
            advanceUntilIdle()

            phone.paths shouldBe listOf(SessionEndPath.SIGNED_OUT)
            phone.samplerStops shouldBe 1
            // The clear still ran, whole: the seam is in front of R295's wipe, never instead of it.
            phone.tokens.load() shouldBe null
            phone.recordCleared shouldBe true
            phone.parametres.accountEvents.first() shouldBe AccountEvent.SignedOut
        }
    }

    test("R1182 the other side: a sign-out CANCELLED ends nothing - the sampler keeps running") {
        runTest {
            val phone = SeamPhone(this)
            advanceUntilIdle()

            phone.parametres.requestSignOut()
            advanceUntilIdle()
            phone.parametres.cancelSignOut()
            advanceUntilIdle()

            phone.paths shouldBe emptyList()
            phone.samplerStops shouldBe 0
            phone.tokens.load() shouldBe TokenPair("access", "refresh", "0", "0")
            phone.mode.load() shouldBe LoggingMode.AUTO_DETECT
        }
    }

    test("R1181 DELETION: the server confirms it -> the session ends through the seam, the sampler cancelled") {
        runTest {
            val phone = SeamPhone(this)
            advanceUntilIdle()

            phone.parametres.requestDelete()
            phone.parametres.confirmDelete()
            advanceUntilIdle()

            phone.paths shouldBe listOf(SessionEndPath.DELETED)
            phone.samplerStops shouldBe 1
            phone.tokens.load() shouldBe null
            phone.recordCleared shouldBe true
        }
    }

    test("R1182 the other side: a deletion REFUSED, or never answered, ends nothing - the sampler keeps running") {
        runTest {
            listOf(PostOutcome.Ok(409, "{}"), PostOutcome.NetworkError).forEach { answer ->
                val phone = SeamPhone(this, deleteAnswer = answer)
                advanceUntilIdle()

                phone.parametres.requestDelete()
                phone.parametres.confirmDelete()
                advanceUntilIdle()

                phone.parametres.state.value.deleteOutcome shouldBe
                    if (answer is PostOutcome.Ok) DeleteOutcome.Refused else DeleteOutcome.Unknown
                phone.paths shouldBe emptyList()
                phone.samplerStops shouldBe 0
                phone.tokens.load() shouldBe TokenPair("access", "refresh", "0", "0")
            }
        }
    }

    test("R1181: the seam runs FIRST - a clear that throws has already cancelled the sampler") {
        runTest {
            var stops = 0
            val failing =
                DeviceLocalStore(
                    tokenStore = OneTokenStore(TokenPair("access", "refresh", "0", "0")),
                    settingsStore = InMemorySettingsStore(SETTINGS),
                    dossierCache = MemoryDossierCache(),
                    pendingSignIn = SeamNoPendingSignIn(),
                    accountStore = MemoryAccountStore("acct-tag"),
                    detectionModeStore = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT),
                    clearRecord = { error("the Room clear failed") },
                    cancelSync = {},
                    clearExports = {},
                )
            val store = SessionEndingStore(failing, deviceSessionEndSeam(stopSampling = { stops += 1 }))

            shouldThrow<IllegalStateException> { store.clearForSignOut() }

            stops shouldBe 1
        }
    }

    test("R1181: the clear runs in a finally - a seam that throws still leaves the device cleared") {
        runTest {
            val tokens = OneTokenStore(TokenPair("access", "refresh", "0", "0"))
            val settings = InMemorySettingsStore(SETTINGS)
            val store =
                SessionEndingStore(
                    DeviceLocalStore(
                        tokenStore = tokens,
                        settingsStore = settings,
                        dossierCache = MemoryDossierCache(),
                        pendingSignIn = SeamNoPendingSignIn(),
                        accountStore = MemoryAccountStore("acct-tag"),
                        detectionModeStore = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT),
                        clearRecord = {},
                        cancelSync = {},
                        clearExports = {},
                    ),
                    SessionEndSeam { error("WorkManager is not initialised") },
                )

            shouldThrow<IllegalStateException> { store.clearForSessionEnd() }

            tokens.load() shouldBe null
            settings.load() shouldBe null
        }
    }

    test("R1181: each path names itself, once - deletion is not also reported as a sign-out") {
        runTest {
            val told = mutableListOf<SessionEndPath>()

            fun store() =
                SessionEndingStore(
                    DeviceLocalStore(
                        tokenStore = OneTokenStore(null),
                        settingsStore = InMemorySettingsStore(null),
                        dossierCache = MemoryDossierCache(),
                        pendingSignIn = SeamNoPendingSignIn(),
                        accountStore = MemoryAccountStore(null),
                        detectionModeStore = InMemoryDetectionModeStore(),
                        clearRecord = {},
                        cancelSync = {},
                        clearExports = {},
                    ),
                    SessionEndSeam { told += it },
                )
            store().clearForSignOut()
            store().clearForDeletion()
            store().clearForSessionEnd()

            told shouldBe listOf(SessionEndPath.SIGNED_OUT, SessionEndPath.DELETED, SessionEndPath.ENDED_BY_SERVER)
        }
    }
})
