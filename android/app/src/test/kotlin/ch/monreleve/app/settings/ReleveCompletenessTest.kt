package ch.monreleve.app.settings

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-ONBOARD-2 (R335). COMPLETE = every field the releve needs, defined in ONE place (ReleveCompleteness.kt).
// This test LISTS each required field and pins each field's presence predicate over a GET /api/v1/me view, so
// the StartupDecider path and the local isOnboarded shortcut (which both read this definition) cannot drift.

class ReleveCompletenessTest : FunSpec({
    // The releve's required fields, in onboarding order - the list the prompt asks be stated once (R335/R206).
    test("the releve requires exactly these six fields, in onboarding order") {
        ReleveField.entries.map { it.name } shouldBe
            listOf("NAME", "CANTON", "RATE", "METHOD", "GRANULARITY", "PERIOD")
    }

    val complete = MeView("Camille Martin", "GE", 100, "SIMPLIFIED240", null, "DAY", null)

    test("a complete view is missing nothing and isComplete") {
        missingReleveFields(complete) shouldBe emptyList()
        complete.isComplete() shouldBe true
    }

    test("missing only the name (the Q1 case: settings but no name)") {
        missingReleveFields(complete.copy(name = null)) shouldBe listOf(ReleveField.NAME)
        complete.copy(name = "").let { missingReleveFields(it) } shouldBe listOf(ReleveField.NAME)
        complete.copy(name = null).isComplete() shouldBe false
    }

    test("missing only granularity") {
        missingReleveFields(complete.copy(granularity = null)) shouldBe listOf(ReleveField.GRANULARITY)
    }

    test("the EXACT method needs its total: absent total -> METHOD missing; present -> satisfied") {
        missingReleveFields(complete.copy(denominatorKind = "EXACT", exactTotalWorkDays = null)) shouldBe
            listOf(ReleveField.METHOD)
        missingReleveFields(complete.copy(denominatorKind = "EXACT", exactTotalWorkDays = 220)) shouldBe emptyList()
    }

    test("missing several, returned in onboarding order") {
        missingReleveFields(complete.copy(name = null, granularity = null)) shouldBe
            listOf(ReleveField.NAME, ReleveField.GRANULARITY)
    }

    test("a brand-new account (no canton) is missing name, canton and the period answer") {
        // PERIOD rides on canton: activityStartDate=null is a valid 'whole year' answer once an account exists,
        // so the only honest signal the period was never asked is a never-set-up account (no canton).
        missingReleveFields(MeView(null, null, 100, "SIMPLIFIED240", null, "DAY", null)) shouldBe
            listOf(ReleveField.NAME, ReleveField.CANTON, ReleveField.PERIOD)
    }

    test("parseMeView tolerates absent fields (parseMeSettings would have returned null for this body)") {
        val body = """{"canton":"GE","employmentRate":100,"denominatorKind":"SIMPLIFIED240","granularity":"DAY"}"""
        parseMeView(body) shouldBe MeView(null, "GE", 100, "SIMPLIFIED240", null, "DAY", null)
    }

    test("parseMeView reads a JSON-null field as null, not the string \"null\"") {
        val body =
            """{"name":null,"canton":"GE","employmentRate":80,"denominatorKind":"EXACT","exactTotalWorkDays":220,
                "granularity":"HALF_DAY","activityStartDate":"2026-03-01"}"""
        parseMeView(body) shouldBe MeView(null, "GE", 80, "EXACT", 220, "HALF_DAY", "2026-03-01")
    }

    test("a malformed body yields null (the safe direction is onboarding)") {
        parseMeView("not json") shouldBe null
    }

    test("a local Settings maps to a MeView and the SAME completeness applies (one definition, R206)") {
        Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille").toMeView().isComplete() shouldBe true
        Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = null).toMeView().isComplete() shouldBe false
    }
})
