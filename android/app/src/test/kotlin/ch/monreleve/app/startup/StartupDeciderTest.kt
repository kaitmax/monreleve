package ch.monreleve.app.startup

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DEFAULT_STEPS
import ch.monreleve.app.onboarding.OnboardingStep
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.test.runTest

// R297 / R335. The start decision consults GET /api/v1/me and keys on COMPLETENESS (every field the releve
// needs), not on canton alone. A complete account is restored and goes to the main shell; an incomplete one goes
// to onboarding carrying the prefill of ONLY the steps it is missing. Proven over fakes; the wire fetch is a seam.
//
// AN-SIGNIN-RESOLVE (R1161, R1162). Onboarding only on a POSITIVE answer that the settings are absent - a 200 that is
// recognisably a /me answer and has no canton; everything else is Unresolved. And every positive answer restores the
// server's logging mode, fail-closed, written before the settings.

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

// AN-SIGNIN-RESOLVE (R1162): Camille's complete row with the server's AUTOMATIC mode and its consent stamp.
private const val ME_COMPLETE_AUTO =
    """{"name":"Camille Martin","canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240",
        "exactTotalWorkDays":null,"granularity":"DAY","activityStartDate":null,"reminderTime":"17:30",
        "reminderEnabled":false,"loggingMode":"AUTO_DETECT","detectionConsentAt":"2026-09-01T06:30:00.000Z"}"""

// R1161: the error body every /api/v1 route answers a refusal with (route.ts `refuse`) - JSON, but not a /me answer.
private const val ERROR_BODY = """{"status":"error","code":"internal","message":"x"}"""

private const val HTTP_OK = 200
private const val HTTP_SERVER_ERROR = 500

/** The settings store, and the order in which the decision wrote the mode and the settings (R1162). */
private class Recorder {
    val writes = mutableListOf<String>()
    val modes = mutableListOf<LoggingMode>()
    val store =
        object : SettingsStore {
            private var settings: Settings? = null

            override fun load(): Settings? = settings

            override fun save(settings: Settings) {
                writes += "settings"
                this.settings = settings
            }

            override fun clear() {
                settings = null
            }
        }

    fun restoreMode(mode: LoggingMode) {
        writes += "mode"
        modes += mode
    }

    /** AN-MANUAL-REMINDER (R1147): the evening opt-in handed back from /me, in the same write order. */
    val reminders = mutableListOf<Boolean>()

    fun restoreReminder(on: Boolean) {
        writes += "reminder"
        reminders += on
    }

    suspend fun decide(fetch: MeFetch): StartDecision =
        decideStartAfterSignIn({ fetch }, store, ::restoreMode, ::restoreReminder)
}

class StartupDeciderTest : FunSpec({
    test("R335: a complete account -> Main, restored (name included)") {
        runTest {
            val r = Recorder()
            r.decide(MeFetch.Ok(HTTP_OK, ME_COMPLETE)) shouldBe StartDecision.Main
            r.store.load() shouldBe Settings("GE", 80, "SIMPLIFIED240", null, "DAY", null, name = "Camille Martin")
        }
    }

    test("R335: settings but no name -> Onboard asking ONLY the name, prefilled, nothing saved locally (Q1 fix)") {
        runTest {
            val r = Recorder()
            val onboard = r.decide(MeFetch.Ok(HTTP_OK, ME_NO_NAME)).shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.NOM)
            onboard.prefill.step shouldBe OnboardingStep.NOM
            onboard.prefill.canton shouldBe Canton.GE
            onboard.prefill.name shouldBe ""
            r.store.load() shouldBe null
        }
    }

    test("R335/R336: no granularity -> Onboard asking ONLY the granularity step") {
        runTest {
            val onboard =
                Recorder().decide(MeFetch.Ok(HTTP_OK, ME_NO_GRANULARITY)).shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.GRANULARITY)
            onboard.prefill.name shouldBe "Camille Martin"
            onboard.prefill.canton shouldBe Canton.GE
        }
    }

    test("R335: missing several -> Onboard asking those steps in onboarding order") {
        runTest {
            val onboard = Recorder().decide(MeFetch.Ok(HTTP_OK, ME_SEVERAL)).shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe listOf(OnboardingStep.NOM, OnboardingStep.GRANULARITY)
        }
    }

    test("R335/R1161: a brand-new account (canton null in a /me answer) -> Onboard the full eight steps") {
        runTest {
            val onboard =
                Recorder().decide(MeFetch.Ok(HTTP_OK, ME_BRAND_NEW)).shouldBeInstanceOf<StartDecision.Onboard>()
            onboard.prefill.steps shouldBe DEFAULT_STEPS
            onboard.prefill.steps.size shouldBe 8
        }
    }

    test("R297: a gone session goes to sign-in, not onboarding (no PATCH-into-401 loop)") {
        runTest {
            val r = Recorder()
            r.decide(MeFetch.SessionGone) shouldBe StartDecision.SignIn
            r.store.load() shouldBe null
            r.writes shouldBe emptyList()
        }
    }

    // R1161 - THE INVARIANT. Onboarding only on a POSITIVE answer that the settings are absent. Every other answer
    // is Unresolved: the person waits or retries, and nothing is written - the empty form R1160 measured (a transport
    // failure mid-request, a network change on the emulator API 36) is never reached from here again.
    test("R1161: an unreachable server is UNRESOLVED (retry), never the empty onboarding, and writes nothing") {
        runTest {
            val r = Recorder()
            r.decide(MeFetch.Unreachable) shouldBe StartDecision.Unresolved(UnresolvedCause.UNREACHABLE)
            r.writes shouldBe emptyList()
        }
    }

    test("R1161: a non-200 is UNRESOLVED even when its body would read as a /me answer") {
        runTest {
            val r = Recorder()
            r.decide(MeFetch.Ok(HTTP_SERVER_ERROR, ERROR_BODY)) shouldBe
                StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            r.decide(MeFetch.Ok(HTTP_SERVER_ERROR, ME_BRAND_NEW)) shouldBe
                StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            r.writes shouldBe emptyList()
        }
    }

    test("R1161: a 200 whose body is not a /me answer is UNRESOLVED - JSON without its keys, {}, not JSON, empty") {
        runTest {
            val r = Recorder()
            listOf(ERROR_BODY, "{}", """{"status":"ok"}""", "not json", "", "[]").forEach { body ->
                r.decide(MeFetch.Ok(HTTP_OK, body)) shouldBe StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            }
            r.writes shouldBe emptyList()
        }
    }

    test("R1161: a /me-shaped body with a field neither reader can read -> UNRESOLVED, not the empty form") {
        runTest {
            val r = Recorder()
            // org.json coerces "80" to 80, so the field is made unreadable outright.
            val odd = ME_COMPLETE.replace("\"employmentRate\":80", "\"employmentRate\":\"x\"")
            r.decide(MeFetch.Ok(HTTP_OK, odd)) shouldBe StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
            r.writes shouldBe emptyList()
        }
    }

    // R1162 - PARK-E3's restore. Every POSITIVE answer hands the server's mode, read fail-closed (parseLoggingMode),
    // to restoreMode; the mode is written BEFORE the settings, because the settings are what make the next launch
    // skip RESOLVING - a process death between the two writes must re-run the resolve, never land on MAIN unrestored.
    test("R1162: a complete AUTOMATIC account restores AUTO_DETECT, and the mode is written before the settings") {
        runTest {
            val r = Recorder()
            r.decide(MeFetch.Ok(HTTP_OK, ME_COMPLETE_AUTO)) shouldBe StartDecision.Main
            r.modes shouldBe listOf(LoggingMode.AUTO_DETECT)
            // AN-MANUAL-REMINDER (R1147): the opt-in is written with the mode, both BEFORE the settings.
            r.writes shouldBe listOf("mode", "reminder", "settings")
        }
    }

    test("R1162: a stamp-less AUTO_DETECT is read MANUAL (fail-closed), and a MANUAL account restores MANUAL") {
        runTest {
            val stampless = Recorder()
            stampless.decide(
                MeFetch.Ok(HTTP_OK, ME_COMPLETE_AUTO.replace("\"2026-09-01T06:30:00.000Z\"", "null")),
            ) shouldBe StartDecision.Main
            stampless.modes shouldBe listOf(LoggingMode.MANUAL)
            val manual = Recorder()
            manual.decide(MeFetch.Ok(HTTP_OK, ME_COMPLETE)) shouldBe StartDecision.Main
            manual.modes shouldBe listOf(LoggingMode.MANUAL)
        }
    }

    test("R1162: a partial or brand-new account restores the server's mode too, and saves no settings") {
        runTest {
            val partial = Recorder()
            partial.decide(MeFetch.Ok(HTTP_OK, ME_NO_NAME)).shouldBeInstanceOf<StartDecision.Onboard>()
            partial.writes shouldBe listOf("mode", "reminder")
            val brandNew = Recorder()
            brandNew.decide(MeFetch.Ok(HTTP_OK, ME_BRAND_NEW)).shouldBeInstanceOf<StartDecision.Onboard>()
            brandNew.modes shouldBe listOf(LoggingMode.MANUAL)
        }
    }

    test("R1161: the transport outcome reaches the decision whole - meFetchOf keeps the status") {
        meFetchOf(AuthedOutcome.Ok(HTTP_SERVER_ERROR, ERROR_BODY)) shouldBe MeFetch.Ok(HTTP_SERVER_ERROR, ERROR_BODY)
        meFetchOf(AuthedOutcome.NetworkError) shouldBe MeFetch.Unreachable
        meFetchOf(AuthedOutcome.SessionExpired) shouldBe MeFetch.SessionGone
    }

    // AN-MANUAL-REMINDER (R1147): the opt-in the server holds reaches the phone at RESOLVING; no answer, nothing.
    test("R1147: a positive answer restores the server's reminderEnabled; an unresolved one restores nothing") {
        runTest {
            val on = Recorder()
            on.decide(MeFetch.Ok(HTTP_OK, ME_COMPLETE.replace("\"reminderEnabled\":false", "\"reminderEnabled\":true")))
            on.reminders shouldBe listOf(true)
            val off = Recorder()
            off.decide(MeFetch.Ok(HTTP_OK, ME_COMPLETE))
            off.reminders shouldBe listOf(false)
            val unreachable = Recorder()
            unreachable.decide(MeFetch.Unreachable)
            unreachable.reminders shouldBe emptyList()
        }
    }
})
