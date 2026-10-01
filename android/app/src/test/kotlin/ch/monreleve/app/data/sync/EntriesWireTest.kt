package ch.monreleve.app.data.sync

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN5 increment 3. The wire mapping, tested by ITS OUTPUT (R154, positive signal): a
 * known row produces the exact JSON the server accepts, and a known 200 body produces
 * the exact rows.
 */
class EntriesWireTest {
    // A minimal HOME row. Tests needing optional fields set them with .copy() rather than
    // through a wide parameter list. serverId/firstRecordedAt are set to prove they are
    // NEVER put on the wire.
    private fun pending(): EntryEntity =
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

    private fun firstItem(body: String): JSONObject = JSONObject(body).getJSONArray("entries").getJSONObject(0)

    @Test
    fun requiredFieldsAreSentAndNullOptionalsAndServerFieldsAreNot() {
        val item = firstItem(entriesRequestBody(listOf(pending())))

        assertEquals("mut-1", item.getString("clientMutationId"))
        assertEquals("2027-06-18", item.getString("dayDate"))
        assertEquals("FULL", item.getString("portion"))
        assertEquals("HOME", item.getString("kind"))
        assertEquals("MANUAL", item.getString("provenance"))
        assertEquals("2027-06-18T12:00:00.000+02:00", item.getString("clientClaimedAt"))

        // Null optionals are OMITTED, never sent as null (the server's zod .optional()
        // rejects a literal null).
        assertFalse("absenceReason (null) must be omitted", item.has("absenceReason"))
        assertFalse("note (null) must be omitted", item.has("note"))
        assertFalse("detectedKind (null) must be omitted", item.has("detectedKind"))
        assertFalse("detectedAt (null) must be omitted", item.has("detectedAt"))

        // The server assigns these and rejects them as unknown keys if a client sends them.
        assertFalse("serverId must never be sent", item.has("serverId"))
        assertFalse("firstRecordedAt must never be sent", item.has("firstRecordedAt"))
        assertFalse("lastModifiedAt must never be sent", item.has("lastModifiedAt"))
        assertFalse("syncState is local only", item.has("syncState"))
        assertFalse("id is the server's", item.has("id"))
    }

    @Test
    fun nonNullOptionalsAreSent() {
        val row =
            pending().copy(
                kind = EntryKind.ABSENT,
                absenceReason = AbsenceReason.MALADIE,
                note = "grippe",
                detectedKind = EntryKind.CH,
                detectedAt = "2027-06-18T08:00:00.000+02:00",
            )
        val item = firstItem(entriesRequestBody(listOf(row)))

        assertEquals("MALADIE", item.getString("absenceReason"))
        assertEquals("grippe", item.getString("note"))
        assertEquals("CH", item.getString("detectedKind"))
        assertEquals("2027-06-18T08:00:00.000+02:00", item.getString("detectedAt"))
    }

    @Test
    fun aServerResponseParsesIntoRows() {
        val body =
            """
            {"status":"ok","written":1,"duplicates":0,"entries":[
              {"id":"srv-1","clientMutationId":"mut-1","dayDate":"2027-06-18","portion":"FULL",
               "kind":"HOME","absenceReason":null,"note":null,"provenance":"MANUAL",
               "detectedKind":null,"detectedAt":null,"clientClaimedAt":"2027-06-18T12:00:00.000+02:00",
               "firstRecordedAt":"2027-06-18T10:00:05.000Z","lastModifiedAt":null}
            ]}
            """.trimIndent()

        val response = parseEntriesResponse(body)!!
        assertEquals(1, response.written)
        assertEquals(0, response.duplicates)
        assertEquals(1, response.entries.size)
        val entry = response.entries[0]
        assertEquals("srv-1", entry.id)
        assertEquals("2027-06-18T10:00:05.000Z", entry.firstRecordedAt)
        assertNull(entry.absenceReason)
        assertNull(entry.lastModifiedAt)
    }

    @Test
    fun aServerRowMapsToASyncedLocalRow() {
        val serverEntry =
            ServerEntry(
                id = "srv-1",
                clientMutationId = "mut-1",
                dayDate = "2027-06-18",
                portion = "FULL",
                kind = "HOME",
                absenceReason = null,
                note = null,
                provenance = "MANUAL",
                detectedKind = null,
                detectedAt = null,
                clientClaimedAt = "2027-06-18T12:00:00.000+02:00",
                firstRecordedAt = "2027-06-18T10:00:05.000Z",
                lastModifiedAt = null,
            )

        // AN-FIX F4 / R303: the synced row carries the LOCAL account tag through (the server never
        // returns it), so a reconciled row stays scoped to the account that recorded it.
        val entity = serverEntry.toSyncedEntity("acct-tag-xyz")
        assertEquals(SyncState.SYNCED, entity.syncState)
        assertEquals("srv-1", entity.serverId)
        assertEquals("2027-06-18T10:00:05.000Z", entity.firstRecordedAt)
        assertEquals(EntryKind.HOME, entity.kind)
        assertEquals("acct-tag-xyz", entity.accountTag)
        assertTrue(parseEntriesResponse("not json") == null)
    }
}
