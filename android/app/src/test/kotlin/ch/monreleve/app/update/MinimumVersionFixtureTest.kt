package ch.monreleve.app.update

import ch.monreleve.app.BuildConfig
import ch.monreleve.app.calc.fixtureFile
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

// AN-FORCE-UPDATE (R1113, R204). THE JOIN BETWEEN THE ROUTE AND THE APP: fixtures/android-minimum-version-cases.json.
//
// web/tests/unit/api/android-minimum-version.test.ts drives the REAL route handler with each case's `setting` and
// requires its response to equal the case's `body` exactly. This hands each of those same bodies to the app's REAL
// client parsing (parseMinimumVersion, :shared) and then to the decision this build makes with its own versionCode.
// So the path from "the operator set X" to "this app shows the screen or not" is crossed whole - a field renamed on
// either side, a different `service`, or a reading of the setting the app would not accept fails a build. Two tests
// over one fixture, plus the emulator run in REPORT-AN-FORCE-UPDATE: one test cannot span TypeScript and Kotlin.
//
// It lives in :app, not commonTest, because web/scripts/fixture-coverage.mjs (R348) counts the Kotlin consumers it
// finds under android/app/src/test/kotlin - and requires the "cases" section to be read on both sides.

private data class Case(val name: String, val minimum: Int?, val body: String)

private fun cases(): List<Case> {
    val array = JSONObject(fixtureFile("android-minimum-version-cases.json").readText()).getJSONArray("cases")
    return (0 until array.length()).map { i ->
        val case = array.getJSONObject(i)
        Case(
            name = case.getString("name"),
            minimum = if (case.isNull("minimum")) null else case.getInt("minimum"),
            body = case.getJSONObject("body").toString(),
        )
    }
}

class MinimumVersionFixtureTest : FunSpec({
    test("R133: the fixture was read, and holds both kinds of answer") {
        val all = cases()
        (all.size > 10) shouldBe true
        all.any { it.minimum == null } shouldBe true
        all.any { it.minimum != null } shouldBe true
    }

    test("R169: every body the route gives names this product exactly as the app expects it") {
        for (case in cases()) {
            JSONObject(case.body).getString("service") shouldBe SERVICE_NAME
        }
    }

    test("R204: the app reads every route answer as the fixture means it") {
        for (case in cases()) {
            val expected = case.minimum?.let { MinimumVersionAnswer.Minimum(it) } ?: MinimumVersionAnswer.NoMinimum
            withClue(case.name) { parseMinimumVersion(200, case.body) shouldBe expected }
        }
    }

    test("R1111: this build shows the screen only for a valid minimum above its own versionCode") {
        val code = BuildConfig.VERSION_CODE
        val outcomes =
            cases().associate { case ->
                case.name to updateRequired(code, parseMinimumVersion(200, case.body), showingNow = false)
            }
        for (case in cases()) {
            withClue(case.name) { outcomes.getValue(case.name) shouldBe (case.minimum != null && code < case.minimum) }
        }
        // Positive control (R196): the ceiling locks every build Play could ever accept, so the assertions above are
        // not satisfied by a decision that never says yes; and unset never locks anything.
        outcomes.getValue("valid, exactly Play's ceiling") shouldBe true
        outcomes.getValue("unset") shouldBe false
    }
})
