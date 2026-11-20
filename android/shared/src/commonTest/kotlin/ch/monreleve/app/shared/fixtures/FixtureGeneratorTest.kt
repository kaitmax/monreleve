package ch.monreleve.app.shared.fixtures

// KMP-0 increment 3 (R370). Proves the fixtures reach commonTest without file access: the generator emitted a
// String constant per repo-root fixtures/*.json, and the common JSON reader parses them. This runs on every
// declared target (kotlin.test), so the day iOS builds, the fixtures are readable there too. It needs no calc
// engine - the Geneva CONFORMANCE (exact published values) lands with the calc move, when the engine is in
// commonMain. A fixture edit regenerates FixtureJson (declared input), so this cannot pass against stale data.

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FixtureGeneratorTest {
    @Test
    fun generatorEmitsEveryRepoRootFixture() {
        val expected =
            setOf(
                // AN-FORCE-UPDATE (R1113): the route/app join; its Kotlin consumer is :app's MinimumVersionFixtureTest.
                "android-minimum-version-cases.json",
                "aggregation-cases.json",
                "denominator-cases.json",
                "forecast-cases.json",
                "geneva-cases.json",
                "late-threshold-cases.json",
                // AN-FCM-CLIENT (R1151): the push join; its Kotlin consumer is :app's PushClientFixtureTest.
                "push-client-cases.json",
                "rate-cases.json",
            )
        assertEquals(expected, FixtureJson.ALL.keys, "the generator must emit one constant per fixtures/*.json")
        FixtureJson.ALL.forEach { (name, json) ->
            assertTrue(json.isNotEmpty(), "generated constant for $name is empty")
        }
    }

    @Test
    fun genevaFixtureRoundTripsThroughTheCommonReader() {
        // The escaping round-trip (generator) and the reader together must reproduce the published shape, so a
        // broken escape or parse is a red test here before it can mislead the conformance test.
        val root = parseJson(FixtureJson.GENEVA_CASES_JSON).asObj()
        assertEquals("GE", root.obj("commonInput").str("canton"))
        val caseIds = root.arr("cases").items.map { it.asObj().str("id") }
        assertEquals(listOf("a", "b", "c", "d", "e", "special"), caseIds)
    }
}
