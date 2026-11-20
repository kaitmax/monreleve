package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.sync.BASE_URL
import ch.monreleve.app.data.sync.InMemoryTokenStore
import ch.monreleve.app.data.sync.RecordingTransport
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// AN-STATUS-HONESTY (R1191). A REFUSED OR FAILED ANSWER IS NEVER SHOWN AS SUCCESS.
//
// The onboarding save used to treat ANY PostOutcome.Ok as saved: a 4xx or a 5xx to PATCH /api/v1/me still cached the
// settings and moved to READY ("Tout est prêt"), so the person believed a setting saved that the server had refused -
// and the Relevé is built from the SERVER's settings. A non-2xx is now what ParametresController.persist already made
// it: nothing cached, nothing handed on, EDITING with SAVE_REFUSED, which OnboardingScreen renders as
// OnboardingCopy.ERROR_SAVE_REFUSED (by reference, R206 - no new copy).
//
// Every refusal case sits beside its 2xx positive (R196: a save that refused EVERYTHING would pass the refusal half
// perfectly), and the retry after a refusal is asserted to land. One case crosses the real entry (R204): the real
// SessionSettingsSaver over the real SessionManager and AuthApi, the transport answering the PATCH itself.
// commonTest, so the iOS simulator runs it too.

private const val TAX_YEAR = 2026

/** A saver that answers from a script, one outcome per call, and keeps every body it was handed. */
private class ScriptedSaver(vararg answers: PostOutcome) : SettingsSaver {
    private val script = ArrayDeque(answers.toList())
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return script.removeFirst()
    }
}

private class RecordingStore : SettingsStore {
    var saved: Settings? = null
    var saves = 0

    override fun load(): Settings? = saved

    override fun save(settings: Settings) {
        saves += 1
        saved = settings
    }

    override fun clear() {
        saved = null
    }
}

private fun statusController(
    scope: CoroutineScope,
    saver: SettingsSaver,
    store: SettingsStore,
    modes: MutableList<LoggingMode>,
): OnboardingController =
    OnboardingController(
        saver,
        store,
        TAX_YEAR,
        scope,
        patchBody = { settings -> "patch:$settings" },
        onModeSaved = { modes += it },
    )

/** Walk the eight steps with valid answers and AUTOMATIC at the Mode step; the last next() is the save. */
private fun OnboardingController.answerEverythingAutomatic() {
    onNameChange("Camille Martin")
    next()
    onCantonChange(Canton.GE)
    next()
    onRateChoiceChange(RateChoice.R80)
    next()
    onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
    next()
    onGranularityChange(GranularityChoice.DAY)
    next()
    onAllYearChange(true)
    next()
    onModeChange(ModeChoice.AUTO_DETECT)
    next()
    // RAPPEL -> save
    next()
}

private val AUTOMATIC_WHOLE_YEAR =
    Settings(
        canton = "GE",
        employmentRate = 80,
        denominatorKind = "SIMPLIFIED240",
        exactTotalWorkDays = null,
        granularity = "DAY",
        activityStartDate = null,
        name = "Camille Martin",
        loggingMode = "AUTO_DETECT",
        detectionConsent = true,
    )

/** Statuses a server answers that are not "taken": refusals, conflicts, validation, and its own failures. */
private val NOT_TAKEN = listOf(400, 403, 404, 409, 422, 500, 502, 503)

/** Statuses that mean the server took the PATCH. */
private val TAKEN = listOf(200, 201, 204)

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingSaveStatusTest {
    @Test
    fun aRefusedOrFailedSaveCachesNothingHandsNothingOnAndIsNeverReady() =
        runTest {
            for (status in NOT_TAKEN) {
                val saver = ScriptedSaver(PostOutcome.Ok(status, """{"status":"error","code":"x"}"""))
                val store = RecordingStore()
                val modes = mutableListOf<LoggingMode>()
                val c = statusController(this, saver, store, modes)

                c.answerEverythingAutomatic()
                advanceUntilIdle()

                // Positive control: the save WAS attempted - an absence below is not a save that never ran.
                assertEquals(1, saver.bodies.size, "status $status: the PATCH was sent")
                assertEquals(OnboardingPhase.EDITING, c.state.value.phase, "status $status")
                assertEquals(OnboardingError.SAVE_REFUSED, c.state.value.error, "status $status")
                assertEquals(OnboardingStep.RAPPEL, c.state.value.step, "status $status: the person stays on the step")
                assertNull(store.saved, "status $status: nothing cached")
                assertEquals(0, store.saves, "status $status: the store was never written")
                assertEquals(emptyList(), modes, "status $status: the mode is not handed on")
            }
        }

    @Test
    fun everySuccessStatusCachesTheSettingsAndIsReady() =
        runTest {
            for (status in TAKEN) {
                val saver = ScriptedSaver(PostOutcome.Ok(status, "{}"))
                val store = RecordingStore()
                val modes = mutableListOf<LoggingMode>()
                val c = statusController(this, saver, store, modes)

                c.answerEverythingAutomatic()
                advanceUntilIdle()

                assertEquals(OnboardingPhase.READY, c.state.value.phase, "status $status")
                assertNull(c.state.value.error, "status $status")
                assertEquals(AUTOMATIC_WHOLE_YEAR, store.saved, "status $status")
                assertEquals(listOf(LoggingMode.AUTO_DETECT), modes, "status $status")
            }
        }

    @Test
    fun theRetryAfterARefusalSendsTheSameSettingsAndLands() =
        runTest {
            val saver =
                ScriptedSaver(PostOutcome.Ok(422, """{"status":"error","code":"x"}"""), PostOutcome.Ok(200, "{}"))
            val store = RecordingStore()
            val modes = mutableListOf<LoggingMode>()
            val c = statusController(this, saver, store, modes)

            c.answerEverythingAutomatic()
            advanceUntilIdle()
            assertEquals(OnboardingError.SAVE_REFUSED, c.state.value.error)
            assertNull(store.saved)

            // The RAPPEL step's button is the retry: the same next() the person tapped the first time.
            c.next()
            advanceUntilIdle()

            assertEquals(2, saver.bodies.size)
            assertEquals(saver.bodies[0], saver.bodies[1], "the retry sends exactly what was refused")
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertNull(c.state.value.error)
            assertEquals(AUTOMATIC_WHOLE_YEAR, store.saved)
            assertEquals(1, store.saves)
            assertEquals(listOf(LoggingMode.AUTO_DETECT), modes, "handed on once, by the save that was taken")
        }

    @Test
    fun throughTheRealSessionA422IsRefusedAndTheNext200IsReady() =
        runTest {
            // R204: the real SessionSettingsSaver -> SessionManager.authenticatedPatch -> AuthApi -> the transport.
            var answer = HttpResponse(422, """{"status":"error","code":"validation_failed","message":"x"}""")
            val transport = RecordingTransport { answer }
            val session = SessionManager(AuthApi(transport, BASE_URL), InMemoryTokenStore())
            val store = RecordingStore()
            val modes = mutableListOf<LoggingMode>()
            val c = statusController(this, SessionSettingsSaver(session), store, modes)

            c.answerEverythingAutomatic()
            advanceUntilIdle()

            assertEquals(
                listOf(HttpMethod.PATCH to "$BASE_URL/api/v1/me"),
                transport.requests.map { it.method to it.url },
            )
            assertEquals(OnboardingPhase.EDITING, c.state.value.phase)
            assertEquals(OnboardingError.SAVE_REFUSED, c.state.value.error)
            assertNull(store.saved)
            assertEquals(emptyList(), modes)

            answer = HttpResponse(200, """{"status":"ok"}""")
            c.next()
            advanceUntilIdle()

            assertEquals(2, transport.requests.size)
            assertEquals(OnboardingPhase.READY, c.state.value.phase)
            assertEquals(AUTOMATIC_WHOLE_YEAR, store.saved)
            assertEquals(listOf(LoggingMode.AUTO_DETECT), modes)
        }
}
