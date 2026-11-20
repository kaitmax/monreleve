package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.json.JSONObject

// AN-ONBOARD. The onboarding WIZARD: per-step validation, navigation, and the save. Validation delegates the
// range, the exact-total iff and the period to the engine (R196: no third copy), so these tests drive the real
// engine through the real aggregation. The save now carries the NAME (chain-critical) and - only when the
// person chose automatic after the disclosure - loggingMode + detectionConsent; manual sends neither.

private const val TAX_YEAR = 2026

private class FakeSaver(private val outcome: PostOutcome = PostOutcome.Ok(200, "{}")) : SettingsSaver {
    var lastBody: String? = null
    var callCount = 0

    override suspend fun saveSettings(body: String): PostOutcome {
        lastBody = body
        callCount += 1
        return outcome
    }
}

private class FakeStore : SettingsStore {
    var saved: Settings? = null

    override fun load(): Settings? = saved

    override fun save(settings: Settings) {
        saved = settings
    }

    override fun clear() {
        saved = null
    }
}

private fun controller(
    scope: CoroutineScope,
    saver: SettingsSaver = FakeSaver(),
    store: SettingsStore = FakeStore(),
): OnboardingController = OnboardingController(saver, store, TAX_YEAR, scope, onModeSaved = {}, onReminderSaved = {})

/** Fill every step with a valid draft (GE, 80 %, simplified, whole year, manual) and trigger the save. */
private fun OnboardingController.saveValidDraft(
    mode: ModeChoice = ModeChoice.MANUAL,
    reminder: Boolean = false,
) {
    onNameChange("Camille Martin")
    next() // NOM -> CANTON
    onCantonChange(Canton.GE)
    next() // CANTON -> TAUX
    onRateChoiceChange(RateChoice.R80)
    next() // TAUX -> METHODE
    onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
    next() // METHODE -> GRANULARITY
    onGranularityChange(GranularityChoice.DAY)
    next() // GRANULARITY -> PERIODE
    onAllYearChange(true)
    next() // PERIODE -> MODE
    onModeChange(mode)
    next() // MODE -> RAPPEL
    onReminderChange(reminder)
    next() // RAPPEL -> save
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingControllerTest : FunSpec({
    test("step 1 refuses a blank name (NAME_MISSING) and does not advance") {
        runTest {
            val c = controller(this)
            c.next()
            c.state.value.error shouldBe OnboardingError.NAME_MISSING
            c.state.value.step shouldBe OnboardingStep.NOM
        }
    }

    test("step 2 refuses no canton (CANTON_MISSING)") {
        runTest {
            val c = controller(this)
            c.onNameChange("Camille")
            c.next() // -> CANTON
            c.next() // no canton
            c.state.value.error shouldBe OnboardingError.CANTON_MISSING
            c.state.value.step shouldBe OnboardingStep.CANTON
        }
    }

    test("step 3 refuses a non-numeric rate (RATE_INVALID)") {
        runTest {
            val c = controller(this)
            c.onNameChange("Camille")
            c.next()
            c.onCantonChange(Canton.GE)
            c.next() // -> TAUX
            c.onCustomRateChange("huit")
            c.next()
            c.state.value.error shouldBe OnboardingError.RATE_INVALID
        }
    }

    test("step 4 EXACT with a blank total fails (EXACT_TOTAL_MISSING)") {
        runTest {
            val c = controller(this)
            c.onNameChange("Camille")
            c.next()
            c.onCantonChange(Canton.GE)
            c.next()
            c.onRateChoiceChange(RateChoice.R100)
            c.next() // -> METHODE
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.next()
            c.state.value.error shouldBe OnboardingError.EXACT_TOTAL_MISSING
        }
    }

    test("a valid draft saves with the NAME, caches locally, and reaches READY") {
        runTest {
            val saver = FakeSaver()
            val store = FakeStore()
            val c = controller(this, saver, store)
            c.saveValidDraft()
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.READY
            saver.callCount shouldBe 1
            store.saved?.name shouldBe "Camille Martin"
            store.saved?.canton shouldBe "GE"
            store.saved?.employmentRate shouldBe 80
            val body = JSONObject(saver.lastBody.shouldNotBeNull())
            body.getString("name") shouldBe "Camille Martin"
            // R336: the granularity step is now part of the flow; whole days by default.
            body.getString("granularity") shouldBe "DAY"
            // Manual: no mode/consent sent (the server's MANUAL default stands).
            body.has("loggingMode") shouldBe false
            body.has("detectionConsent") shouldBe false
        }
    }

    // AN-MANUAL-REMINDER (R1145, R1147): the full flow ASKS the evening reminder, so its answer travels in the same
    // PATCH as reminderEnabled - the server then holds what the person chose, and RESOLVING reads it back next time.
    test("R1145: the full onboarding's PATCH carries the evening answer as reminderEnabled, yes and no") {
        runTest {
            listOf(true, false).forEach { answer ->
                val saver = FakeSaver()
                controller(this, saver).saveValidDraft(reminder = answer)
                advanceUntilIdle()
                JSONObject(saver.lastBody.shouldNotBeNull()).let {
                    it.has("reminderEnabled") shouldBe true
                    it.getBoolean("reminderEnabled") shouldBe answer
                }
            }
        }
    }

    test("R336: choosing demi-journée at the granularity step sends granularity HALF_DAY") {
        runTest {
            val saver = FakeSaver()
            val c = controller(this, saver)
            c.onNameChange("Camille")
            c.next() // NOM -> CANTON
            c.onCantonChange(Canton.GE)
            c.next() // CANTON -> TAUX
            c.onRateChoiceChange(RateChoice.R100)
            c.next() // TAUX -> METHODE
            c.onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
            c.next() // METHODE -> GRANULARITY
            c.state.value.step shouldBe OnboardingStep.GRANULARITY
            c.onGranularityChange(GranularityChoice.HALF_DAY)
            c.next() // GRANULARITY -> PERIODE
            c.onAllYearChange(true)
            c.next() // PERIODE -> MODE
            c.onModeChange(ModeChoice.MANUAL)
            c.next() // MODE -> RAPPEL
            c.onReminderChange(false)
            c.next() // save
            advanceUntilIdle()
            JSONObject(saver.lastBody.shouldNotBeNull()).getString("granularity") shouldBe "HALF_DAY"
        }
    }

    test("R335: a plan of only [NOM] asks one step, saves the prefilled values, and never re-sends the mode") {
        runTest {
            val saver = FakeSaver()
            val store = FakeStore()
            val c =
                OnboardingController(
                    saver,
                    store,
                    TAX_YEAR,
                    this,
                    onModeSaved = {},
                    onReminderSaved = {},
                    restored =
                        OnboardingSnapshot(
                            step = OnboardingStep.NOM,
                            name = "",
                            canton = Canton.GE,
                            rateChoice = RateChoice.R80,
                            denominator = DenominatorChoice.SIMPLIFIED240,
                            granularity = GranularityChoice.DAY,
                            steps = listOf(OnboardingStep.NOM),
                        ),
                )
            c.state.value.steps shouldBe listOf(OnboardingStep.NOM)
            c.onNameChange("Alex Dupont")
            c.next() // the only step -> save
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.READY
            store.saved?.name shouldBe "Alex Dupont"
            store.saved?.canton shouldBe "GE"
            store.saved?.employmentRate shouldBe 80
            val body = JSONObject(saver.lastBody.shouldNotBeNull())
            // A partial onboarding leaves the server's detection mode untouched.
            body.has("loggingMode") shouldBe false
            body.has("detectionConsent") shouldBe false
            // AN-MANUAL-REMINDER (R1145): ...and its reminderEnabled - the question was never asked.
            body.has("reminderEnabled") shouldBe false
        }
    }

    test("choosing automatic sends loggingMode and detectionConsent together") {
        runTest {
            val saver = FakeSaver()
            val c = controller(this, saver)
            c.saveValidDraft(mode = ModeChoice.AUTO_DETECT)
            advanceUntilIdle()
            val body = JSONObject(saver.lastBody.shouldNotBeNull())
            body.getString("loggingMode") shouldBe "AUTO_DETECT"
            body.getBoolean("detectionConsent") shouldBe true
        }
    }

    test("a server-ended session does not cache and reaches SESSION_ENDED") {
        runTest {
            val store = FakeStore()
            val c = controller(this, FakeSaver(PostOutcome.SessionEnded), store)
            c.saveValidDraft()
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.SESSION_ENDED
            store.saved shouldBe null
        }
    }

    test("Back returns to the previous step keeping what was entered") {
        runTest {
            val c = controller(this)
            c.onNameChange("Camille Martin")
            c.next() // -> CANTON
            c.onCantonChange(Canton.VD)
            c.back() // -> NOM
            c.state.value.step shouldBe OnboardingStep.NOM
            c.state.value.name shouldBe "Camille Martin"
            c.state.value.canton shouldBe Canton.VD
        }
    }

    test("a restored snapshot reopens the entered values and the step (R310)") {
        runTest {
            val c =
                OnboardingController(
                    FakeSaver(),
                    FakeStore(),
                    TAX_YEAR,
                    this,
                    onModeSaved = {},
                    onReminderSaved = {},
                    restored =
                        OnboardingSnapshot(
                            step = OnboardingStep.METHODE,
                            name = "Alex Dupont",
                            canton = Canton.VD,
                            rateChoice = RateChoice.OTHER,
                            customRate = "75",
                        ),
                )
            c.state.value.step shouldBe OnboardingStep.METHODE
            c.state.value.name shouldBe "Alex Dupont"
            c.state.value.canton shouldBe Canton.VD
            c.state.value.employmentRate shouldBe "75"
        }
    }
})
