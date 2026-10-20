package ch.monreleve.app.data.sync

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState

// AN5 increment 3 / KMP-1 increment 5. The EntryEntity <-> wire mapping: a local row onto EntryWrite, and a
// ServerEntry reconciled back into a local row. The wire DTOs, their encode/decode and the server's limits
// live in EntriesWire.kt beside it.
//
// KMP-3 (R446): MOVED to :shared commonMain, and the header it arrived with is CORRECTED rather than deleted.
// It read: "kept in :app (R379): it touches Room's EntryEntity and the local enums ... which are the on-device
// store, not the wire." That reason was true when it was written and STOPPED BEING TRUE at KMP-2b, which took
// EntryEntity, the three DAOs and WireEnums to commonMain. An expired reason left standing is exactly what the
// next reader takes at face value and routes around, so it is struck here with the date it lapsed.
//
// NOTHING ABOUT THE BYTES CHANGED. encodeEntries is the same shared function under KMP-1's one Json
// configuration; the 29 wire goldens are unedited and still green.

/** Map a local row onto the wire DTO. A null optional stays null here; wireJson omits it on encode (never "k":null). */
fun EntryEntity.toEntryWrite(): EntryWrite =
    EntryWrite(
        clientMutationId = clientMutationId,
        dayDate = dayDate,
        portion = portion.name,
        kind = kind.name,
        provenance = provenance.name,
        absenceReason = absenceReason?.name,
        note = note,
        detectedKind = detectedKind?.name,
        detectedAt = detectedAt,
        clientClaimedAt = clientClaimedAt,
    )

/**
 * The request body {entries:[...]} the server accepts. Maps each local row to its wire DTO (the :app half) and
 * hands the list to the shared encode (the wire half). The signature is unchanged, so SyncEngine is untouched.
 */
fun entriesRequestBody(rows: List<EntryEntity>): String = encodeEntries(rows.map { it.toEntryWrite() })

/**
 * The synced local row FROM THE SERVER'S ROW (R217): pending clears in one round
 * trip from what the server holds, not from what the client sent. firstRecordedAt is
 * the server's immutable evidence moment; clientClaimedAt is echoed back verbatim.
 *
 * [accountTag] is the LOCAL account the row belongs to (AN-FIX F4 / R303). The server never returns it
 * (it is not on the wire), so the reconcile carries the local row's own tag through, keeping the synced
 * row scoped to the account that recorded it.
 */
fun ServerEntry.toSyncedEntity(accountTag: String): EntryEntity =
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
        accountTag = accountTag,
    )
