package ch.monreleve.app.parametres

import ch.monreleve.app.push.reminderOptInBody
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.mePatchBody
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

// IOS-SHELL-1 (R1329). THE GOLDEN: THE COMMON PARAMETRES WIRE WRITES AND READS WHAT ANDROID'S org.json WIRE DOES.
//
// The inputs and the expected values are ParametresWirePinTest's (:app, on the JVM org.json library), copied as
// literals - that pin proves the org.json wire produces them, this one proves the common wire does, on the JVM and on
// the iOS simulator (commonTest). Every receipt vector is the pin's, the lenient ones included: a string "7" read as
// 7, "x" as 0, a `removed` that is not an object as 0, the string "true" as true and "yes" as false.
//
// THE ONE DECLARED DIVERGENCE (by name, so a second cannot join it quietly): a MALFORMED receipt throws here as it
// throws there, but org.json's exception is a JSONException and this one is kotlinx.serialization's (or an
// IllegalArgumentException for a JSON value that is not an object). Asserted as "throws", never as a class. It is why
// Android keeps its org.json wire (CommonParametresWire.kt's header).

private val WIRE = CommonParametresWire(consentBody = { error("the golden never asks for the consent body") })

private fun assertNone(
    what: String,
    mismatches: List<String>,
) = assertTrue(mismatches.isEmpty(), "$what: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))

class CommonParametresWireGoldenTest {
    @Test
    fun theReminderBodiesAreByteExactBothWays() {
        assertEquals(
            listOf("{\"reminderEnabled\":true}", "{\"reminderEnabled\":false}"),
            listOf(WIRE.reminderBody(true), WIRE.reminderBody(false)),
            "reminderBody: ParametresWirePinTest's two literals",
        )
        assertEquals(WIRE.reminderBody(true), reminderOptInBody(true), "one encoder behind both writers (R206)")
    }

    @Test
    fun theDeleteBodyIsByteExact() {
        assertEquals("{\"confirm\":\"SUPPRIMER\"}", WIRE.deleteBody(), "deleteBody: ParametresWirePinTest's literal")
    }

    @Test
    fun thePatchBodyIsTheCommonCodecs() {
        val settings =
            listOf(
                Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null),
                Settings("VD", 55, "EXACT", 220, "HALF_DAY", "2026-03-01"),
            )
        settings.forEach { assertEquals(it.mePatchBody(), WIRE.patchBody(it), "patchBody for $it") }
        assertEquals(
            "{\"canton\":\"VD\",\"employmentRate\":55,\"denominatorKind\":\"EXACT\",\"exactTotalWorkDays\":220," +
                "\"granularity\":\"HALF_DAY\",\"activityStartDate\":\"2026-03-01\"}",
            WIRE.patchBody(settings[1]),
            "patchBody: ParametresWirePinTest's key order and value forms",
        )
    }

    @Test
    fun theConsentBodyIsThePlatformsOwn() {
        val asked = mutableListOf<Boolean>()
        val wire =
            CommonParametresWire(
                consentBody = { enable ->
                    asked += enable
                    "platform:$enable"
                },
            )
        assertEquals("platform:true", wire.consentBody(true))
        assertEquals("platform:false", wire.consentBody(false))
        assertEquals(listOf(true, false), asked)
    }

    @Test
    fun theDeleteReceiptIsReadTheSameWayForEveryShape() {
        // ParametresWirePinTest's vectors: (body, the outcome org.json's wire gives).
        val vectors =
            listOf(
                "{\"status\":\"ok\",\"removed\":{\"User\":1,\"Entry\":2,\"EntryEvent\":2}," +
                    "\"alertSubscriptionRemains\":true}" to DeleteOutcome.Done(2, true),
                "{\"status\":\"ok\",\"alertSubscriptionRemains\":false}" to DeleteOutcome.Done(0, false),
                "{\"removed\":{\"User\":1}}" to DeleteOutcome.Done(0, false),
                "{\"removed\":3,\"alertSubscriptionRemains\":true}" to DeleteOutcome.Done(0, true),
                "{\"removed\":[1,2],\"alertSubscriptionRemains\":true}" to DeleteOutcome.Done(0, true),
                "{\"removed\":\"Entry\"}" to DeleteOutcome.Done(0, false),
                "{\"removed\":null,\"alertSubscriptionRemains\":null}" to DeleteOutcome.Done(0, false),
                "{\"removed\":{\"Entry\":\"7\"},\"alertSubscriptionRemains\":\"true\"}" to DeleteOutcome.Done(7, true),
                "{\"removed\":{\"Entry\":\"x\"},\"alertSubscriptionRemains\":\"yes\"}" to DeleteOutcome.Done(0, false),
                "{}" to DeleteOutcome.Done(0, false),
            )
        val mismatches = mutableListOf<String>()
        for ((body, outcome) in vectors) {
            val seen = runCatching { WIRE.parseReceipt(body) }
            if (seen.getOrNull() != outcome) mismatches += "<$body> gave $seen, not $outcome"
        }
        assertNone("parseReceipt", mismatches)
    }

    @Test
    fun aMalformedReceiptThrowsAsTheOrgJsonOneDid() {
        // THE DECLARED DIVERGENCE: the pin asserts JSONException; the common read throws its own exception.
        for (body in listOf("not json", "", "[1,2]", "{\"removed\":")) {
            val seen = runCatching { WIRE.parseReceipt(body) }
            if (seen.isSuccess) fail("<malformed [$body]> was read as ${seen.getOrNull()} - it must throw")
        }
    }
}
