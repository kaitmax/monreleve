package ch.monreleve.app.startup

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DEFAULT_STEPS
import ch.monreleve.app.onboarding.OnboardingStep
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.test.runTest

// R297 / R335. The start decision consults GET /api/v1/me and keys on COMPLETENESS (every field the releve
// needs), not on canton alone. A complete account is restored and goes to the main shell; an incomplete one goes
// to onboarding carrying the prefill of ONLY the steps it is missing. Proven over fakes; the wire fetch is a seam.

private class FakeSettingsStore(private var settings: Settings? = null) : SettingsStore {
    override fun load(): Settings? = settings

    override fun save(settings: Settings) {
        this.settings = settings
    }

    override fun clear() {
        settings = null
    }
}

// Full GET /api/v1/me bodies (SPEC 9.1's ten fields; the decision reads the releve-relevant ones).
private const val ME_COMPLETE =
    """{"name":"Camille Martin","canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240",
        "exactTotalWorkDays":null,"granularity":"DAY","activityStartDate":null,"reminderTime":"17:30",
        "reminderEnabled":false,"loggingMode":"MANUAL","detectionConsentAt":null}"""

// Settings on the server, but no name (the Q1 case: lands on Aujourd'hui today, PDF refused).
private const val ME_NO_NAME =
    """{"name":null,"canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
        "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
        "loggingMode":"MANUAL","detectionConsentAt":null}"""

// Name + settings, but no granularity (the field R336's step now writes).
private const val ME_NO_GRANULARITY =
    """{"name":"Camille Martin","canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240",
        "exactTotalWorkDays":null,"granularity":null,"activityStartDate":null,"reminderTime":"17:30",
        "reminderEnabled":false,"loggingMode":"MANUAL","detectionConsentAt":null}"""

// Missing several: no name and no granularity.
private const val ME_SEVERAL =
    """{"name":null,"canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
        "granularity":null,"activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
        "loggingMode":"MANUAL","detectionConsentAt":null}"""

// A brand-new account: no canton (the one field with no server default).
private const val ME_BRAND_NEW =
    """{"name":null,"canton":null,"employmentRate":100,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
        "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
        "loggingMode":"MANUAL","detectionConsentAt":null}"""

class StartupDeciderTest : FunSpec({
    test("R335: a complete account -> Main, restored (name included)") {
        runTest {
            val store = FakeSettingsStore()
            decideStartAfterSignIn({ MeFetch.Ok(ME_COMPLETE) }, store) shouldBe StartDecision.Main
            store.load() shouldBe Settings("GE", 80, "SIMPLIFIED240", null, "DAY", null, name = "Camille Martin")
        }
    }

    test("R335: settings but no name -> Onboard asking ONLY the name, prefilled, nothing saved locally (Q1 fix)") {
        runTest {
            val store = FakeSettingsStore()
            val onboard =
                decideStartAfterSignIn({ MeFetch.Ok(ME_NO_NAME) }, store)
                    .shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.NOM)
            onboard.prefill.step shouldBe OnboardingStep.NOM
            onboard.prefill.canton shouldBe Canton.GE
            onboard.prefill.name shouldBe ""
            store.load() shouldBe null
        }
    }

    test("R335/R336: no granularity -> Onboard asking ONLY the granularity step") {
        runTest {
            val onboard =
                decideStartAfterSignIn({ MeFetch.Ok(ME_NO_GRANULARITY) }, FakeSettingsStore())
                    .shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.GRANULARITY)
            onboard.prefill.name shouldBe "Camille Martin"
            onboard.prefill.canton shouldBe Canton.GE
        }
    }

    test("R335: missing several -> Onboard asking those steps in onboarding order") {
        runTest {
            val onboard =
                decideStartAfterSignIn({ MeFetch.Ok(ME_SEVERAL) }, FakeSettingsStore())
                    .shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.NOM, OnboardingStep.GRANULARITY)
        }
    }

    test("R335: a brand-new account (no canton) -> Onboard the full eight steps") {
        runTest {
            val onboard =
                decideStartAfterSignIn({ MeFetch.Ok(ME_BRAND_NEW) }, FakeSettingsStore())
                    .shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe DEFAULT_STEPS
            onboard.prefill.steps.size shouldBe 8
        }
    }

    test("R297: a gone session goes to sign-in, not onboarding (no PATCH-into-401 loop)") {
        runTest {
            val store = FakeSettingsStore()
            decideStartAfterSignIn({ MeFetch.SessionGone }, store) shouldBe StartDecision.SignIn
            store.load() shouldBe null
        }
    }

    test("R297: an unreachable server runs the full flow, nothing prefilled (a save retries when online)") {
        runTest {
            val onboard =
                decideStartAfterSignIn({ MeFetch.Unreachable }, FakeSettingsStore())
                    .shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe DEFAULT_STEPS
            onboard.prefill.name shouldBe ""
            onboard.prefill.canton shouldBe null
        }
    }
})
