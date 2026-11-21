package ch.monreleve.app.startup

import ch.monreleve.app.calc.fixtureFile
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.mePatchBody
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

// IOS-MOVE-ME (R1271, R204). THE JOIN BETWEEN THE /api/v1/me ROUTE AND THE APP: fixtures/me-cases.json.
//
// web/tests/db/me-cases-join.test.ts drives the REAL route handlers with the same fixture: it seeds each answer case's
// `row`, requires GET /api/v1/me to answer that case's `body` BYTE FOR BYTE, and PATCHes every patch case's `body` to
// the real PATCH handler, requiring a 200 and the values read back. This hands those same bodies to the app's REAL
// entry points: every answer to resolveStart (RESOLVING's decision, which reads /me through the moved common codec),
// requiring the decision the OLD org.json codec led to (`old.start`, captured at 7df4d9fa before it was deleted); and
// every patch case to the encoder the app sends, requiring exactly the bytes the route was shown to accept. So a field
// renamed on either side, a reading that changed, or a PATCH the server would refuse fails a build. One test cannot
// span TypeScript and Kotlin; these two over one fixture are the join (MinimumVersionFixtureTest's shape).
//
// It lives in :app, not commonTest, because web/scripts/fixture-coverage.mjs (R348) counts the Kotlin consumers it
// finds under android/app/src/test/kotlin, and requires "answers" and "patches" to be read on both sides. The
// function-level golden over the same fixture is :shared commonTest's MeCodecGoldenTest, which the iOS run executes.

private fun fixture(): JSONObject = JSONObject(fixtureFile("me-cases.json").readText())

private fun JSONObject.list(key: String): List<JSONObject> =
    getJSONArray(key).let { array -> (0 until array.length()).map(array::getJSONObject) }

private fun StartDecision.label(): String =
    when (this) {
        StartDecision.Main -> "Main"
        StartDecision.SignIn -> "SignIn"
        is StartDecision.Onboard -> "Onboard"
        is StartDecision.Unresolved -> "Unresolved:$cause"
    }

private fun JSONObject.strOrNull(key: String): String? = if (isNull(key)) null else getString(key)

private fun settingsOf(json: JSONObject): Settings =
    Settings(
        canton = json.getString("canton"),
        employmentRate = json.getInt("employmentRate"),
        denominatorKind = json.getString("denominatorKind"),
        exactTotalWorkDays = if (json.isNull("exactTotalWorkDays")) null else json.getInt("exactTotalWorkDays"),
        granularity = json.getString("granularity"),
        activityStartDate = json.strOrNull("activityStartDate"),
        name = json.strOrNull("name"),
        loggingMode = json.strOrNull("loggingMode"),
        detectionConsent = if (json.isNull("detectionConsent")) null else json.getBoolean("detectionConsent"),
    )

class MeRouteJoinTest : FunSpec({
    test("R133: the fixture was read, and holds the route's answers and every decision") {
        val answers = fixture().list("answers")
        (answers.size >= 50) shouldBe true
        (answers.count { it.has("row") } >= 4) shouldBe true
        answers.map { it.getJSONObject("old").getString("start").substringBefore(':') }.toSet() shouldBe
            setOf("Main", "Onboard", "Unresolved")
        (fixture().list("patches").size >= 5) shouldBe true
    }

    test("R204: RESOLVING decides on every /me body as it did on the org.json codec") {
        for (case in fixture().list("answers")) {
            val expected =
                case.optJSONObject("divergence")?.optString("start")?.takeIf { it.isNotEmpty() }
                    ?: case.getJSONObject("old").getString("start")
            withClue(case.getString("name")) {
                resolveStart(MeFetch.Ok(200, case.getString("body"))).decision.label() shouldBe expected
            }
        }
    }

    test("R204: the app sends exactly the PATCH bytes the route accepted") {
        for (case in fixture().list("patches")) {
            val reminder = if (case.isNull("reminderEnabled")) null else case.getBoolean("reminderEnabled")
            withClue(case.getString("name")) {
                settingsOf(case.getJSONObject("settings")).mePatchBody(reminder) shouldBe case.getString("body")
            }
        }
    }
})
