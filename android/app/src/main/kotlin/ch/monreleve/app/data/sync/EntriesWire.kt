package ch.monreleve.app.data.sync

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import org.json.JSONArray
import org.json.JSONObject

// AN5 increment 3. The wire mapping between the local rows and POST /api/v1/entries,
// kept apart from the HTTP itself (data/remote) and from the drain logic (SyncEngine).
//
// THE BATCH LIMIT IS THE SERVER'S NAMED CONSTANT, not a guess (R0.2). It is asserted
// equal to web/lib/entries/schema.ts's MAX_BATCH_ITEMS by BatchLimitParityTest
// (R181, derive don't transcribe), so a change on the server goes red here.

const val MAX_BATCH_ITEMS = 200

const val MAX_NOTE_LENGTH = 500

const val ENTRIES_PATH = "/api/v1/entries"

/**
 * The request body {entries: [...]} the server accepts.
 *
 * NULL OPTIONALS ARE OMITTED, NEVER SENT AS null. The server's zod uses .optional()
 * (absent is allowed) and NOT .nullable() (null is not) - so a literal null for
 * absenceReason or note would be rejected as invalid_payload. Only the wire fields
 * go: serverId, firstRecordedAt, lastModifiedAt and syncState are the server's or
 * ours and are never sent (the schema rejects the first three as unknown keys).
 */
fun entriesRequestBody(rows: List<EntryEntity>): String {
    val array = JSONArray()
    for (row in rows) {
        val item = JSONObject()
        item.put("clientMutationId", row.clientMutationId)
        item.put("dayDate", row.dayDate)
        item.put("portion", row.portion.name)
        item.put("kind", row.kind.name)
        item.put("provenance", row.provenance.name)
        row.absenceReason?.let { item.put("absenceReason", it.name) }
        row.note?.let { item.put("note", it) }
        row.detectedKind?.let { item.put("detectedKind", it.name) }
        row.detectedAt?.let { item.put("detectedAt", it) }
        row.clientClaimedAt?.let { item.put("clientClaimedAt", it) }
        array.put(item)
    }
    return JSONObject().put("entries", array).toString()
}

/** One row exactly as the server returns it (R217): every field, including the server-assigned ones. */
data class ServerEntry(
    val id: String,
    val clientMutationId: String,
    val dayDate: String,
    val portion: String,
    val kind: String,
    val absenceReason: String?,
    val note: String?,
    val provenance: String,
    val detectedKind: String?,
    val detectedAt: String?,
    val clientClaimedAt: String?,
    val firstRecordedAt: String,
    val lastModifiedAt: String?,
)

data class EntriesResponse(
    val written: Int,
    val duplicates: Int,
    val entries: List<ServerEntry>,
)

/** The 200 body, or null if it is not the shape the contract promises (treated as a transient fault). */
fun parseEntriesResponse(body: String): EntriesResponse? =
    runCatching {
        val json = JSONObject(body)
        val array = json.getJSONArray("entries")
        val entries =
            (0 until array.length()).map { index ->
                val entry = array.getJSONObject(index)
                ServerEntry(
                    id = entry.getString("id"),
                    clientMutationId = entry.getString("clientMutationId"),
                    dayDate = entry.getString("dayDate"),
                    portion = entry.getString("portion"),
                    kind = entry.getString("kind"),
                    absenceReason = entry.stringOrNull("absenceReason"),
                    note = entry.stringOrNull("note"),
                    provenance = entry.getString("provenance"),
                    detectedKind = entry.stringOrNull("detectedKind"),
                    detectedAt = entry.stringOrNull("detectedAt"),
                    clientClaimedAt = entry.stringOrNull("clientClaimedAt"),
                    firstRecordedAt = entry.getString("firstRecordedAt"),
                    lastModifiedAt = entry.stringOrNull("lastModifiedAt"),
                )
            }
        EntriesResponse(
            written = json.getInt("written"),
            duplicates = json.getInt("duplicates"),
            entries = entries,
        )
    }.getOrNull()

/**
 * The synced local row FROM THE SERVER'S ROW (R217): pending clears in one round
 * trip from what the server holds, not from what the client sent. firstRecordedAt is
 * the server's immutable evidence moment; clientClaimedAt is echoed back verbatim.
 */
fun ServerEntry.toSyncedEntity(): EntryEntity =
    EntryEntity(
        clientMutationId = clientMutationId,
        dayDate = dayDate,
        portion = Portion.valueOf(portion),
        kind = EntryKind.valueOf(kind),
        absenceReason = absenceReason?.let { AbsenceReason.valueOf(it) },
        note = note,
        provenance = Provenance.valueOf(provenance),
        detectedKind = detectedKind?.let { EntryKind.valueOf(it) },
        detectedAt = detectedAt,
        clientClaimedAt = clientClaimedAt,
        serverId = id,
        firstRecordedAt = firstRecordedAt,
        lastModifiedAt = lastModifiedAt,
        syncState = SyncState.SYNCED,
    )

private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else getString(key)
