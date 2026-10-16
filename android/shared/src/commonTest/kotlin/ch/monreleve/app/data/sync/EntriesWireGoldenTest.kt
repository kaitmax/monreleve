package ch.monreleve.app.data.sync

import ch.monreleve.app.data.remote.wireJson
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// KMP-1 increment 5 (R381). The entries-wire GOLDENS, moved to commonTest with the SAME expected fixture data,
// now driving the MOVED (kotlinx.serialization) encode/decode on COMMON code - so iOS runs them. The inc-2 :app
// copy tested entriesRequestBody (the EntryEntity path, which stays in :app); this tests the shared encodeEntries
// over EntryWrite directly - the same keys and values, which is what the :app mapping feeds it. The server's
// POST /api/v1/entries schema is .strict(): one unknown key is a 400, so each body is compared by its EXACT key
// set, and null optionals are ABSENT (never "k":null).

private fun row(): EntryWrite =
    EntryWrite(
        clientMutationId = "mut-1",
        dayDate = "2027-06-18",
        portion = "FULL",
        kind = "HOME",
        provenance = "MANUAL",
        clientClaimedAt = "2027-06-18T12:00:00.000+02:00",
    )

private fun envelopeKeys(body: String): Set<String> = wireJson.parseToJsonElement(body).jsonObject.keys

private fun itemKeys(body: String): Set<String> =
    wireJson.parseToJsonElement(body).jsonObject["entries"]!!.jsonArray[0].jsonObject.keys

private fun item(body: String) = wireJson.parseToJsonElement(body).jsonObject["entries"]!!.jsonArray[0].jsonObject

class EntriesWireGoldenTest {
    @Test
    fun goldenEnvelopeCarriesExactlyEntries() {
        assertEquals(setOf("entries"), envelopeKeys(encodeEntries(listOf(row()))))
    }

    @Test
    fun goldenRowWithOneOptionalCarriesExactlyItsKeys() {
        assertEquals(
            setOf("clientMutationId", "dayDate", "portion", "kind", "provenance", "clientClaimedAt"),
            itemKeys(encodeEntries(listOf(row()))),
        )
    }

    @Test
    fun goldenFullyMinimalRowCarriesExactlyTheRequiredFive() {
        assertEquals(
            setOf("clientMutationId", "dayDate", "portion", "kind", "provenance"),
            itemKeys(encodeEntries(listOf(row().copy(clientClaimedAt = null)))),
        )
    }

    @Test
    fun goldenAllOptionalsSetAreAllPresentWithTheirValues() {
        val full =
            row().copy(
                kind = "ABSENT",
                absenceReason = "MALADIE",
                note = "grippe",
                provenance = "DETECTED_CORRECTED",
                detectedKind = "CH",
                detectedAt = "2027-06-18T08:00:00.000+02:00",
            )
        val obj = item(encodeEntries(listOf(full)))
        assertEquals(
            setOf(
                "clientMutationId", "dayDate", "portion", "kind", "provenance",
                "absenceReason", "note", "detectedKind", "detectedAt", "clientClaimedAt",
            ),
            obj.keys,
        )
        fun str(key: String) = obj[key]!!.jsonPrimitive.content
        assertEquals("mut-1", str("clientMutationId"))
        assertEquals("2027-06-18", str("dayDate"))
        assertEquals("FULL", str("portion"))
        assertEquals("ABSENT", str("kind"))
        assertEquals("DETECTED_CORRECTED", str("provenance"))
        assertEquals("MALADIE", str("absenceReason"))
        assertEquals("grippe", str("note"))
        assertEquals("CH", str("detectedKind"))
        assertEquals("2027-06-18T08:00:00.000+02:00", str("detectedAt"))
        assertEquals("2027-06-18T12:00:00.000+02:00", str("clientClaimedAt"))
    }

    @Test
    fun goldenResponseParsesCountsRowsAndNullHandling() {
        val body =
            """
            {"status":"ok","written":1,"duplicates":2,"entries":[
              {"id":"srv-1","clientMutationId":"mut-1","dayDate":"2027-06-18","portion":"FULL",
               "kind":"HOME","absenceReason":null,"note":null,"provenance":"MANUAL",
               "detectedKind":null,"detectedAt":null,"clientClaimedAt":"2027-06-18T12:00:00.000+02:00",
               "firstRecordedAt":"2027-06-18T10:00:05.000Z","lastModifiedAt":null}
            ]}
            """.trimIndent()
        val response = parseEntriesResponse(body)!!
        assertEquals(1, response.written)
        assertEquals(2, response.duplicates)
        assertEquals(1, response.entries.size)
        val e = response.entries[0]
        assertEquals("srv-1", e.id)
        assertEquals("mut-1", e.clientMutationId)
        assertEquals("FULL", e.portion)
        assertEquals("HOME", e.kind)
        assertEquals("MANUAL", e.provenance)
        assertEquals("2027-06-18T10:00:05.000Z", e.firstRecordedAt)
        assertEquals("2027-06-18T12:00:00.000+02:00", e.clientClaimedAt)
        assertNull(e.absenceReason)
        assertNull(e.note)
        assertNull(e.detectedKind)
        assertNull(e.detectedAt)
        assertNull(e.lastModifiedAt)
    }

    @Test
    fun goldenAMalformedBodyIsNullNeverAnException() {
        assertNull(parseEntriesResponse("not json"))
        assertNull(parseEntriesResponse("""{"status":"ok"}"""))
    }
}
