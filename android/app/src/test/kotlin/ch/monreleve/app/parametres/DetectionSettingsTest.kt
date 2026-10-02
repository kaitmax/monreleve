package ch.monreleve.app.parametres

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.detectionConsentBody
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-AUTO increment 2 (R315). The automatic-detection setting: opt-in, labelled beta, manual by default, with
// consent timestamped BOTH WAYS through /api/v1/me (FW26). Turning it off stops sampling at once and is never a
// confirmation dialog away (SPEC 13). The server is the consent authority (it stamps/clears detectionConsentAt
// and forces MANUAL on revoke, SPEC 9.3); this proves the CLIENT sends the right body each way and reflects it.

private const val AUTO_TAX_YEAR = 2026
private val AUTO_CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun autoSettings(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

private class ModeStoreFake(initial: LoggingMode = LoggingMode.MANUAL) : DetectionModeStore {
    var mode: LoggingMode = initial

    override fun load(): LoggingMode = mode

    override fun save(mode: LoggingMode) {
        this.mode = mode
    }

    override fun clear() {
        mode = LoggingMode.MANUAL
    }
}

private class AutoSettingsStoreFake(private val initial: Settings) : SettingsStore {
    override fun load(): Settings = initial

    override fun save(settings: Settings) = Unit

    override fun clear() = Unit
}

private class AutoRecordingSaver(private val outcome: PostOutcome = PostOutcome.Ok(200, "{}")) : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return outcome
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class DetectionSettingsTest : FunSpec({
    test("R315: detectionConsentBody(true) enables auto mode with consent in one PATCH") {
        val body = detectionConsentBody(enable = true)
        body.contains("\"loggingMode\":\"AUTO_DETECT\"").shouldBeTrue()
        body.contains("\"detectionConsent\":true").shouldBeTrue()
        // Never the server-assigned stamp (SPEC 9.3): the client sends the boolean, never a timestamp.
        body.contains("detectionConsentAt").shouldBeFalse()
    }

    test("R315: detectionConsentBody(false) revokes consent; the server forces MANUAL, the client does not send it") {
        val body = detectionConsentBody(enable = false)
        body.contains("\"detectionConsent\":false").shouldBeTrue()
        // Revocation forcing MANUAL is the server's (SPEC 9.3); the client need not and does not send loggingMode.
        body.contains("loggingMode").shouldBeFalse()
    }

    test("R315: turning auto detection ON PATCHes the enable body, stores AUTO_DETECT, starts sampling, no dialog") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), AUTO_CLOCK)
            val saver = AutoRecordingSaver()
            val modeStore = ModeStoreFake()
            var sampleStarts = 0
            var sampleStops = 0
            val controller =
                ParametresController(
                    saver = saver,
                    store = AutoSettingsStoreFake(autoSettings()),
                    repository = repo,
                    taxYear = AUTO_TAX_YEAR,
                    scope = this,
                    modeStore = modeStore,
                    startSampling = { sampleStarts++ },
                    stopSampling = { sampleStops++ },
                )
            advanceUntilIdle()

            controller.setAutoDetection(true)
            advanceUntilIdle()

            saver.bodies.single() shouldBe detectionConsentBody(true)
            modeStore.mode shouldBe LoggingMode.AUTO_DETECT
            controller.state.value.autoDetectionEnabled.shouldBeTrue()
            // Enabling starts sampling and never stops it.
            sampleStarts shouldBe 1
            sampleStops shouldBe 0
            // SPEC 13: toggling is never a confirmation dialog away - no pending prompts are raised.
            controller.state.value.pendingRateChange.shouldBeNull()
            controller.state.value.signOutPrompt.shouldBeNull()
        }
    }

    test("R315: turning auto detection OFF PATCHes the disable body, stores MANUAL, stops sampling at once") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), AUTO_CLOCK)
            val saver = AutoRecordingSaver()
            val modeStore = ModeStoreFake(LoggingMode.AUTO_DETECT)
            var sampleStops = 0
            val controller =
                ParametresController(
                    saver = saver,
                    store = AutoSettingsStoreFake(autoSettings()),
                    repository = repo,
                    taxYear = AUTO_TAX_YEAR,
                    scope = this,
                    modeStore = modeStore,
                    stopSampling = { sampleStops++ },
                )
            advanceUntilIdle()

            controller.setAutoDetection(false)
            advanceUntilIdle()

            saver.bodies.single() shouldBe detectionConsentBody(false)
            modeStore.mode shouldBe LoggingMode.MANUAL
            controller.state.value.autoDetectionEnabled.shouldBeFalse()
            // SPEC 13: off stops sampling AT ONCE (not on the next window, not after a dialog).
            sampleStops shouldBe 1
        }
    }

    test("R315: the controller opens reflecting the stored mode (manual by default)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), AUTO_CLOCK)
            val def =
                ParametresController(
                    saver = AutoRecordingSaver(),
                    store = AutoSettingsStoreFake(autoSettings()),
                    repository = repo,
                    taxYear = AUTO_TAX_YEAR,
                    scope = this,
                    modeStore = ModeStoreFake(LoggingMode.MANUAL),
                )
            advanceUntilIdle()
            def.state.value.autoDetectionEnabled.shouldBeFalse()
        }
    }
})
