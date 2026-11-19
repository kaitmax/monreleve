package ch.monreleve.app.startup

import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.onboarding.DEFAULT_STEPS
import ch.monreleve.app.onboarding.OnboardingStep
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

// AN-SIGNIN-RESOLVE (R1161): THE DECISION AS A PURE FUNCTION. resolveStart maps ONE /me outcome to where the person
// goes AND what the phone writes (the mode, the settings) - no store, no callback, no suspension - so every branch is
// asserted on its value. decideStartAfterSignIn (StartupDeciderTest, ResolveFlowTest) only fetches and applies it.

private const val HTTP_OK = 200
private const val HTTP_SERVER_ERROR = 500

private fun me(
    canton: String? = "GE",
    name: String? = "Camille Martin",
    granularity: String? = "DAY",
    mode: String = "MANUAL",
    consentAt: String? = null,
): String =
    """{"name":${name?.let { "\"$it\"" }},"canton":${canton?.let { "\"$it\"" }},"employmentRate":80,
        "denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,"granularity":${granularity?.let { "\"$it\"" }},
        "activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,"loggingMode":"$mode",
        "detectionConsentAt":${consentAt?.let { "\"$it\"" }}}"""

private val CAMILLE = Settings("GE", 80, "SIMPLIFIED240", null, "DAY", null, name = "Camille Martin")
private val UNREADABLE = Resolution(StartDecision.Unresolved(UnresolvedCause.UNREADABLE))

class ResolveStartTest : FunSpec({
    test("R1161: a complete account -> Main, writing the server's mode and the settings") {
        resolveStart(MeFetch.Ok(HTTP_OK, me())) shouldBe
            Resolution(StartDecision.Main, mode = LoggingMode.MANUAL, settings = CAMILLE)
    }

    test("R1162: a complete AUTOMATIC account with its consent stamp -> mode AUTO_DETECT; without the stamp MANUAL") {
        val stamped = me(mode = "AUTO_DETECT", consentAt = "2026-09-01T06:30:00.000Z")
        resolveStart(MeFetch.Ok(HTTP_OK, stamped)).mode shouldBe LoggingMode.AUTO_DETECT
        resolveStart(MeFetch.Ok(HTTP_OK, me(mode = "AUTO_DETECT"))).mode shouldBe LoggingMode.MANUAL
    }

    test("R335: a partial account -> Onboard over the missing steps, the mode written, NO settings") {
        val r = resolveStart(MeFetch.Ok(HTTP_OK, me(name = null)))
        r.decision.shouldBeInstanceOf<StartDecision.Onboard>().prefill.steps shouldBe listOf(OnboardingStep.NOM)
        r.mode shouldBe LoggingMode.MANUAL
        r.settings shouldBe null
    }

    test("R1161: a brand-new account (canton null in a /me answer) -> the full onboarding, MANUAL, no settings") {
        val r = resolveStart(MeFetch.Ok(HTTP_OK, me(canton = null, name = null)))
        r.decision.shouldBeInstanceOf<StartDecision.Onboard>().prefill.steps shouldBe DEFAULT_STEPS
        r.mode shouldBe LoggingMode.MANUAL
        r.settings shouldBe null
    }

    test("R297: a gone session -> SignIn, nothing written") {
        resolveStart(MeFetch.SessionGone) shouldBe Resolution(StartDecision.SignIn)
    }

    test("R1161: unreachable -> Unresolved(UNREACHABLE), nothing written") {
        resolveStart(MeFetch.Unreachable) shouldBe Resolution(StartDecision.Unresolved(UnresolvedCause.UNREACHABLE))
    }

    test("R1161: a non-200 -> Unresolved(UNREADABLE), nothing written, even with a /me-shaped body") {
        resolveStart(MeFetch.Ok(HTTP_SERVER_ERROR, me())) shouldBe UNREADABLE
        resolveStart(MeFetch.Ok(HTTP_SERVER_ERROR, """{"status":"error","code":"internal"}""")) shouldBe UNREADABLE
    }

    test("R1161: a 200 that is not a /me answer, or one neither reader can read -> Unresolved(UNREADABLE)") {
        val unreadableField = me().replace("\"employmentRate\":80", "\"employmentRate\":\"x\"")
        listOf("{}", """{"status":"ok"}""", "not json", "", "[]", unreadableField)
            .forEach { body -> resolveStart(MeFetch.Ok(HTTP_OK, body)) shouldBe UNREADABLE }
    }

    test("R1161: each cause says its own line (swapping them must fail here)") {
        UnresolvedCause.UNREACHABLE.message() shouldBe SignInCopy.NETWORK_ERROR
        UnresolvedCause.UNREADABLE.message() shouldBe SignInCopy.GENERIC_ERROR
    }
})
