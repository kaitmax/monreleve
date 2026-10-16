package ch.monreleve.app.data.sync

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// KMP-1 increment 2 (R381). GOLDEN TESTS for the entries wire, captured against TODAY's org.json code BEFORE
// the wire DTOs + encode/decode move to :shared (increment 5). The server's POST /api/v1/entries schema is
// .strict() (docs/api-v1.md 6.1): a single unknown key is a 400, so the request body is compared by its EXACT
// key set, not merely "has/has-not" per known field - an UNKNOWN stray key is exactly what that would miss.
// Null optionals are OMITTED, never sent as null (the server's zod .optional() rejects a literal null), so the
// absent-vs-null distinction is part of the golden. The EntryEntity -> wire mapping stays in :app (R379); the
// encode moves, so after the move the SAME expected key sets/values must hold against the kotlinx encode.
//
// RED PLANT (R180): proven able to fail by putting a stray key in the item builder and seeing the exact-key-set
// assertion go red - recorded in REPORT-KMP-1.txt - then reverted.

private fun row(): EntryEntity =
    EntryEntity(
        clientMutationId = "mut-1",
        dayDate = "2027-06-18",
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = "2027-06-18T12:00:00.000+02:00",
        serverId = "srv-should-not-be-sent",
        firstRecordedAt = "2027-06-18T10:00:05.000Z",
        lastModifiedAt = null,
        syncState = SyncState.PENDING,
    )

private fun itemKeys(body: String): Set<String> =
    JSONObject(body).getJSONArray("entries").getJSONObject(0).keys().asSequence().toSet()

private fun envelopeKeys(body: String): Set<String> = JSONObject(body).keys().asSequence().toSet()

class EntriesWireGoldenTest {
    @Test
    fun goldenEnvelopeCarriesExactlyEntries() {
        assertEquals(setOf("entries"), envelopeKeys(entriesRequestBody(listOf(row()))))
    }

    @Test
    fun goldenRowWithOneOptionalCarriesExactlyItsKeys() {
        // The required five + the one non-null optional (clientClaimedAt). Nulls and server fields are ABSENT.
        assertEquals(
            setOf("clientMutationId", "dayDate", "portion", "kind", "provenance", "clientClaimedAt"),
            itemKeys(entriesRequestBody(listOf(row()))),
        )
    }

    @Test
    fun goldenFullyMinimalRowCarriesExactlyTheRequiredFive() {
        val minimal = row().copy(clientClaimedAt = null)
        assertEquals(
            setOf("clientMutationId", "dayDate", "portion", "kind", "provenance"),
            itemKeys(entriesRequestBody(listOf(minimal))),
        )
    }

    @Test
    fun goldenAllOptionalsSetAreAllPresentWithTheirValues() {
        val full =
            row().copy(
                kind = EntryKind.ABSENT,
                absenceReason = AbsenceReason.MALADIE,
                note = "grippe",
                provenance = Provenance.DETECTED_CORRECTED,
                detectedKind = EntryKind.CH,
                detectedAt = "2027-06-18T08:00:00.000+02:00",
            )
        val item = JSONObject(entriesRequestBody(listOf(full))).getJSONArray("entries").getJSONObject(0)
        assertEquals(
            setOf(
                "clientMutationId", "dayDate", "portion", "kind", "provenance",
                "absenceReason", "note", "detectedKind", "detectedAt", "clientClaimedAt",
            ),
            item.keys().asSequence().toSet(),
        )
        assertEquals("mut-1", item.getString("clientMutationId"))
        assertEquals("2027-06-18", item.getString("dayDate"))
        assertEquals("FULL", item.getString("portion"))
        assertEquals("ABSENT", item.getString("kind"))
        assertEquals("DETECTED_CORRECTED", item.getString("provenance"))
        assertEquals("MALADIE", item.getString("absenceReason"))
        assertEquals("grippe", item.getString("note"))
        assertEquals("CH", item.getString("detectedKind"))
        assertEquals("2027-06-18T08:00:00.000+02:00", item.getString("detectedAt"))
        assertEquals("2027-06-18T12:00:00.000+02:00", item.getString("clientClaimedAt"))
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
