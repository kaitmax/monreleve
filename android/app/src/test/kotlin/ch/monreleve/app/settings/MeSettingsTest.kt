package ch.monreleve.app.settings

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// R297. parseMeSettings is the READ counterpart of mePatchBody: it turns a GET /api/v1/me body back into the
// six manual Settings, or null when the account is not yet onboarded on the server. Proven against the wire
// shapes SPEC 9.1 documents, including the JSON-null trap the DossierPayload convention exists for.

class MeSettingsTest : FunSpec({
    test("R297: parses the six manual fields from a full /me body, ignoring the rest") {
        val body =
            """{"canton":"VD","employmentRate":80,"denominatorKind":"EXACT","exactTotalWorkDays":220,
                "granularity":"HALF_DAY","activityStartDate":"2026-03-01","reminderTime":"17:30",
                "reminderEnabled":true,"loggingMode":"MANUAL","detectionConsentAt":"2026-01-01T00:00:00Z"}"""

        parseMeSettings(body) shouldBe Settings("VD", 80, "EXACT", 220, "HALF_DAY", "2026-03-01")
    }

    test("R297: a JSON-null exactTotalWorkDays and activityStartDate read as null, not the string \"null\"") {
        val body =
            """{"canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
                "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
                "loggingMode":"MANUAL","detectionConsentAt":null}"""

        parseMeSettings(body) shouldBe Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)
    }

    test("R297: a body with a JSON-null canton is a not-yet-onboarded account -> null") {
        val body =
            """{"canton":null,"employmentRate":100,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
                "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
                "loggingMode":"MANUAL","detectionConsentAt":null}"""

        parseMeSettings(body) shouldBe null
    }

    test("R297: a body missing canton entirely is also not-yet-onboarded -> null") {
        val body = """{"employmentRate":100,"denominatorKind":"SIMPLIFIED240","granularity":"DAY"}"""
        parseMeSettings(body) shouldBe null
    }

    test("R297: a malformed body yields null, never a crash (the safe direction is onboarding)") {
        parseMeSettings("not json at all") shouldBe null
    }

    test("AN-ONBOARD: reads the holder name when /me carries it") {
        val body =
            """{"name":"Camille Martin","canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240",
                "exactTotalWorkDays":null,"granularity":"DAY","activityStartDate":null,"reminderTime":"17:30",
                "reminderEnabled":false,"loggingMode":"MANUAL","detectionConsentAt":null}"""

        parseMeSettings(body) shouldBe
            Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille Martin")
    }

    test("AN-ONBOARD: a settings body with no name parses, with a null name (the name step is still owed)") {
        val body =
            """{"canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
                "granularity":"DAY","activityStartDate":null}"""

        parseMeSettings(body) shouldBe Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = null)
    }

    test("AN-ONBOARD: the PATCH body carries the name when set, and omits it when absent") {
        val withName = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Alex Dupont")
        org.json.JSONObject(withName.mePatchBody()).getString("name") shouldBe "Alex Dupont"

        val withoutName = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)
        org.json.JSONObject(withoutName.mePatchBody()).has("name") shouldBe false
    }
})
