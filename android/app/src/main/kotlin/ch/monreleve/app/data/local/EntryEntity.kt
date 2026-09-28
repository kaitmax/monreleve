package ch.monreleve.app.data.local

import androidx.room.Entity

// AN5 increment 1. The offline record of one declared day.
//
// THE SCHEMA IS THE CONTRACT (R187). exportSchema = true writes this table's
// definition to schemas/1.json, committed and read back by RoomSchemaContractTest.
// The first RELEASED client (AN14) makes it permanent on every device that
// installs it; until then a pre-release migration costs nothing, which is why the
// column set is only what AN5 needs and not a guess at AN8's.
//
// PRIMARY KEY (dayDate, portion), MIRRORING THE SERVER. The server's uniqueness is
// @@unique([userId, dayDate, portion]); this device holds one signed-in user's
// records, so (dayDate, portion) is the local identity. An edit to a day REPLACEs
// the row on this key (increment 2), which coalesces record-then-edit-before-sync
// into a single pending mutation - the property increment 4's ordering evidence
// rests on: the queue structurally cannot hold two mutations for one (dayDate,
// portion), so it can never emit them out of order, and the server's
// two-items-for-one-day-in-a-batch refusal can never fire against this client.
//
// NO userId COLUMN, ON PURPOSE. The token identifies the user (AN4); a shared
// device is out of scope for AN5, and sign-out clearing the store is a later
// concern (parked). Adding userId later is exactly the migration the harness
// exists to make safe.
//
// D18 - NO COORDINATE COLUMN, EVER. Enforced three ways: this file carries none;
// FencesTest fence 2b scans data/local for coordinate-shaped names; and
// RoomSchemaContractTest asserts the generated DDL has no such column. The plant
// in REPORT-AN5.txt proves the last two fire (R180).
//
// THREE GROUPS OF COLUMNS, in order:
//   - the WIRE SHAPE (clientMutationId..clientClaimedAt), sent to the server
//     verbatim and verified field-by-field against its zod schema by
//     WireContractParityTest;
//   - SERVER-ASSIGNED (serverId, firstRecordedAt, lastModifiedAt), null until this
//     row has been synced and the server has returned its own copy (R217).
//     firstRecordedAt is the immutable evidence moment - the client stores what the
//     server sends and never asserts it;
//   - LOCAL ONLY (syncState), never on the wire.

@Entity(tableName = "entry", primaryKeys = ["dayDate", "portion"])
data class EntryEntity(
    /** D30. This device's id for the write that produced the current row, so a retry is recognised. */
    val clientMutationId: String,
    /** The calendar day as an ISO YYYY-MM-DD string in Europe/Paris, never a Date or an instant (R28). */
    val dayDate: String,
    val portion: Portion,
    val kind: EntryKind,
    /** Required iff kind = ABSENT; the server and the client both enforce that (increment 2). */
    val absenceReason: AbsenceReason?,
    val note: String?,
    val provenance: Provenance,
    /** What detection proposed, if anything. Required iff provenance != MANUAL (R202). */
    val detectedKind: EntryKind?,
    /** When the proposal was produced on-device: an ISO instant with offset, or null. */
    val detectedAt: String?,
    /** The device's clock at the tap, sent verbatim and never trusted as evidence. ISO instant with offset. */
    val clientClaimedAt: String?,
    val serverId: String?,
    val firstRecordedAt: String?,
    val lastModifiedAt: String?,
    val syncState: SyncState,
)
