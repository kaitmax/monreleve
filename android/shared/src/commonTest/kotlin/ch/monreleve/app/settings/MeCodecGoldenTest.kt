package ch.monreleve.app.settings

import ch.monreleve.app.data.remote.wireJson
import ch.monreleve.app.shared.fixtures.FixtureJson
import ch.monreleve.app.shared.fixtures.Json
import ch.monreleve.app.shared.fixtures.arr
import ch.monreleve.app.shared.fixtures.asObj
import ch.monreleve.app.shared.fixtures.obj
import ch.monreleve.app.shared.fixtures.parseJson
import ch.monreleve.app.shared.fixtures.str
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-MOVE-ME (R1271, R1272). THE GOLDEN: THE COMMON /me CODEC RETURNS WHAT THE org.json ONE RETURNED.
//
// fixtures/me-cases.json holds, for every case, what the OLD codec (org.json, :app's MeWire.kt and DetectionMode.kt's
// parseLoggingMode) RETURNED - captured by running it at 7df4d9fa, before it was deleted, never written by hand. This
// runs the same inputs through the moved codec and requires the same results: every reader on every body (the real
// route's answers, the refusals, the wrong types, the bodies that are not JSON), and every PATCH body as a JSON value
// (the same keys, the same values, null kept apart from absent, 100 kept apart from 100.0).
//
// WHERE THE OLD AND NEW DIFFER, THE FIXTURE SAYS SO, CASE BY CASE: a case's `divergence` carries the new result and
// why. The set of such cases is asserted here by name, so a new difference cannot join it quietly (R206's corollary),
// and none of them may be an answer the real route gives.
//
// The old run was the JVM org.json library in :app's tests (org.json:json), not Android's own: android.jar's org.json
// is stubbed under JVM tests. So PATCH bodies are compared as JSON values - the JVM library's key order is a HashMap's,
// which is not what a phone sent (MeRouteJoinTest pins the bytes). In commonTest, so the iOS simulator runs it (R1272).

private val CASES: Json.Obj = parseJson(FixtureJson.ME_CASES_JSON).asObj()

/** The divergences this move declares, by case name - each one's reason is in the fixture beside it. */
private val DECLARED_DIVERGENCES =
    setOf(
        "a duplicate key",
        "trailing text after the object",
        "a second object after the first",
        "unquoted keys and single quotes",
        "a trailing comma",
    )

private fun str(value: String?): Json = value?.let { Json.Str(it) } ?: Json.Null

private fun num(value: Int?): Json = value?.let { Json.Num(it.toDouble()) } ?: Json.Null

private fun Settings.asJson(): Json =
    Json.Obj(
        mapOf(
            "canton" to str(canton),
            "employmentRate" to num(employmentRate),
            "denominatorKind" to str(denominatorKind),
            "exactTotalWorkDays" to num(exactTotalWorkDays),
            "granularity" to str(granularity),
            "activityStartDate" to str(activityStartDate),
            "name" to str(name),
            "loggingMode" to str(loggingMode),
            "detectionConsent" to (detectionConsent?.let { Json.Bool(it) } ?: Json.Null),
        ),
    )

private fun MeView.asJson(): Json =
    Json.Obj(
        mapOf(
            "name" to str(name),
            "canton" to str(canton),
            "employmentRate" to num(employmentRate),
            "denominatorKind" to str(denominatorKind),
            "exactTotalWorkDays" to num(exactTotalWorkDays),
            "granularity" to str(granularity),
            "activityStartDate" to str(activityStartDate),
        ),
    )

/** What the moved codec returns for [body], in the shape the capture recorded. */
private fun newReads(body: String): Map<String, Json> =
    mapOf(
        "meAnswer" to Json.Bool(isMeAnswer(body)),
        "settings" to (parseMeSettings(body)?.asJson() ?: Json.Null),
        "view" to (parseMeView(body)?.asJson() ?: Json.Null),
        "loggingMode" to Json.Str(parseLoggingMode(body).name),
        "reminderEnabled" to Json.Bool(parseReminderEnabled(body)),
    )

private fun Json.Obj.nullableStr(key: String): String? = (entries[key] as? Json.Str)?.value

private fun Json.Obj.nullableInt(key: String): Int? = (entries[key] as? Json.Num)?.value?.toInt()

private fun Json.Obj.nullableBool(key: String): Boolean? = (entries[key] as? Json.Bool)?.value

private fun settingsOf(json: Json.Obj): Settings =
    Settings(
        canton = json.str("canton"),
        employmentRate = json.nullableInt("employmentRate") ?: error("employmentRate"),
        denominatorKind = json.str("denominatorKind"),
        exactTotalWorkDays = json.nullableInt("exactTotalWorkDays"),
        granularity = json.str("granularity"),
        activityStartDate = json.nullableStr("activityStartDate"),
        name = json.nullableStr("name"),
        loggingMode = json.nullableStr("loggingMode"),
        detectionConsent = json.nullableBool("detectionConsent"),
    )

private fun answers(): List<Json.Obj> = CASES.arr("answers").items.map { it.asObj() }

private fun patches(): List<Json.Obj> = CASES.arr("patches").items.map { it.asObj() }

class MeCodecGoldenTest {
    @Test
    fun theFixtureWasReadAndCarriesBothDirectionsOfEveryReader() {
        // R154/R196: a golden over nothing passes; one whose cases all agree on a reader proves only one direction.
        val old = answers().map { it.obj("old") }
        assertTrue(old.size >= 50, "answers read: ${old.size}")
        for (reader in listOf("meAnswer", "reminderEnabled")) {
            assertEquals(setOf(true, false), old.map { it.nullableBool(reader) }.toSet(), reader)
        }
        assertEquals(setOf("MANUAL", "AUTO_DETECT"), old.map { it.str("loggingMode") }.toSet(), "loggingMode")
        for (reader in listOf("settings", "view")) {
            assertTrue(old.any { it.entries[reader] == Json.Null }, "$reader: no refusal case")
            assertTrue(old.any { it.entries[reader] is Json.Obj }, "$reader: no accepted case")
        }
        assertTrue(answers().count { "row" in it.entries } >= 4, "the real route's answers are cases")
        assertTrue(patches().size >= 5, "patches read: ${patches().size}")
    }

    @Test
    fun everyReaderReturnsWhatTheOldCodecReturned() {
        val mismatches = mutableListOf<String>()
        for (case in answers()) {
            val name = case.str("name")
            val divergence = case.entries["divergence"] as? Json.Obj
            // `start` is :app's resolveStart over the same body - MeRouteJoinTest asserts it, at the entry point.
            val expected = case.obj("old").entries - "start" + (divergence?.entries.orEmpty() - "why" - "start")
            val actual = newReads(case.str("body"))
            for ((reader, value) in expected) {
                if (actual[reader] != value) mismatches += "<$name> $reader: ${actual[reader]}, expected $value"
            }
        }
        assertTrue(mismatches.isEmpty(), "${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))
    }

    @Test
    fun theDivergencesAreExactlyTheDeclaredOnesAndNoneIsARouteAnswer() {
        val divergent = answers().filter { "divergence" in it.entries }
        assertEquals(DECLARED_DIVERGENCES, divergent.map { it.str("name") }.toSet())
        divergent.forEach { case ->
            assertTrue("row" !in case.entries, "${case.str("name")}: the real route gives this body")
            assertTrue(case.obj("divergence").str("why").isNotBlank(), "${case.str("name")}: no reason")
        }
    }

    @Test
    fun everyPatchBodyIsTheOldBodyAsAJsonValue() {
        val mismatches = mutableListOf<String>()
        for (case in patches()) {
            val settings = settingsOf(case.obj("settings"))
            val reminder = (case.entries["reminderEnabled"] as? Json.Bool)?.value
            val actual = wireJson.parseToJsonElement(settings.mePatchBody(reminder))
            val old = wireJson.parseToJsonElement(case.str("oldBody"))
            if (actual != old) mismatches += "<${case.str("name")}> $actual, the old codec wrote $old"
        }
        assertTrue(mismatches.isEmpty(), "${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))
    }
}
