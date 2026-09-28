package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.json.JSONObject

// AN5b increment 1. The onboarding controller's validation and save paths. Validation delegates the
// range and the period to the engine (R196: no third copy of 1-100), so these tests drive the real
// engine through the real increment-2 aggregation - the settings are valid iff calculateTelework
// accepts what they produce.
//
// R282 is asserted directly: the PATCH body carries the six manual fields and NONE of loggingMode,
// detectionConsent, reminderTime or reminderEnabled - a field the manual product does not offer is
// not sent.

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
): OnboardingController = OnboardingController(saver, store, TAX_YEAR, scope)

/** A fully-valid draft: GE, 80%, simplified, full days, whole year. */
private fun OnboardingController.fillValid() {
    onCantonChange(Canton.GE)
    onEmploymentRateChange("80")
    onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
    onGranularityChange(GranularityChoice.DAY)
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingControllerTest : FunSpec({
    test("no canton chosen fails with CANTON_MISSING and never calls the server") {
        runTest {
            val saver = FakeSaver()
            val c = controller(this, saver)
            c.onEmploymentRateChange("80")
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.CANTON_MISSING
            saver.callCount shouldBe 0
        }
    }

    test("a non-numeric rate fails with RATE_INVALID") {
        runTest {
            val c = controller(this)
            c.onCantonChange(Canton.GE)
            c.onEmploymentRateChange("huit")
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.RATE_INVALID
        }
    }

    test("a rate out of range is rejected by the engine, not a third copy of the bound (RATE_INVALID)") {
        runTest {
            val c = controller(this)
            c.onCantonChange(Canton.GE)
            c.onEmploymentRateChange("150")
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.RATE_INVALID
        }
    }

    test("EXACT method with a blank total fails with EXACT_TOTAL_MISSING") {
        runTest {
            val c = controller(this)
            c.onCantonChange(Canton.GE)
            c.onEmploymentRateChange("100")
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.EXACT_TOTAL_MISSING
        }
    }

    test("EXACT method with a zero total is rejected by the engine (EXACT_TOTAL_INVALID)") {
        runTest {
            val c = controller(this)
            c.onCantonChange(Canton.GE)
            c.onEmploymentRateChange("100")
            c.onDenominatorChange(DenominatorChoice.EXACT)
            c.onExactTotalChange("0")
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.EXACT_TOTAL_INVALID
        }
    }

    test("an unparseable start date fails with START_DATE_INVALID") {
        runTest {
            val c = controller(this)
            c.fillValid()
            c.onActivityStartDateChange("31/12/2026")
            c.submit()
            advanceUntilIdle()
            c.state.value.error shouldBe OnboardingError.START_DATE_INVALID
        }
    }

    test("valid settings save to the server then cache locally and reach SAVED") {
        runTest {
            val saver = FakeSaver()
            val store = FakeStore()
            val c = controller(this, saver, store)
            c.fillValid()
            c.submit()
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.SAVED
            saver.callCount shouldBe 1
            store.saved.shouldNotBeNull()
            store.saved?.canton shouldBe "GE"
            store.saved?.employmentRate shouldBe 80
        }
    }

    test("the PATCH body carries the six manual fields and NOTHING the manual product lacks (R282)") {
        runTest {
            val saver = FakeSaver()
            val c = controller(this, saver)
            c.fillValid()
            c.submit()
            advanceUntilIdle()
            val body = JSONObject(saver.lastBody.shouldNotBeNull())
            body.keys().asSequence().toList().shouldContainExactlyInAnyOrder(
                "canton",
                "employmentRate",
                "denominatorKind",
                "exactTotalWorkDays",
                "granularity",
                "activityStartDate",
            )
            body.has("loggingMode") shouldBe false
            body.has("detectionConsent") shouldBe false
            body.has("reminderTime") shouldBe false
            body.has("reminderEnabled") shouldBe false
        }
    }

    test("SIMPLIFIED240 sends a null exact total; a blank start date sends a null date (whole year)") {
        runTest {
            val saver = FakeSaver()
            val c = controller(this, saver)
            c.fillValid()
            c.submit()
            advanceUntilIdle()
            val body = JSONObject(saver.lastBody.shouldNotBeNull())
            body.isNull("exactTotalWorkDays") shouldBe true
            body.isNull("activityStartDate") shouldBe true
        }
    }

    test("a server-ended session does not cache locally and reaches SESSION_ENDED") {
        runTest {
            val saver = FakeSaver(PostOutcome.SessionEnded)
            val store = FakeStore()
            val c = controller(this, saver, store)
            c.fillValid()
            c.submit()
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.SESSION_ENDED
            store.saved shouldBe null
        }
    }

    test("a network failure does not cache locally and reaches NETWORK_ERROR") {
        runTest {
            val saver = FakeSaver(PostOutcome.NetworkError)
            val store = FakeStore()
            val c = controller(this, saver, store)
            c.fillValid()
            c.submit()
            advanceUntilIdle()
            c.state.value.phase shouldBe OnboardingPhase.NETWORK_ERROR
            store.saved shouldBe null
        }
    }
})
