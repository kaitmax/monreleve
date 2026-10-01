package ch.monreleve.app.data.local

import androidx.room.Entity
import ch.monreleve.app.account.UNOWNED_ACCOUNT

// AN5 increment 1. The offline record of one declared day.
//
// THE SCHEMA IS THE CONTRACT (R187). exportSchema = true writes this table's
// definition to schemas/1.json, committed and read back by RoomSchemaContractTest.
// The first RELEASED client (AN14) makes it permanent on every device that
// installs it; until then a pre-release migration costs nothing, which is why the
// column set is only what AN5 needs and not a guess at AN8's.
//
// PRIMARY KEY (accountTag, dayDate, portion), MIRRORING THE SERVER. The server's
// uniqueness is @@unique([userId, dayDate, portion]); accountTag is the device's
// local half of that userId (AN-FIX F4 / R303). An edit to a day REPLACEs the row
// on this key, which coalesces record-then-edit-before-sync into a single pending
// mutation PER ACCOUNT - the ordering evidence rests on the queue structurally
// holding at most one mutation for one (account, dayDate, portion). Because the
// account is IN the key, one account's set-aside day and another's same (dayDate,
// portion) coexist without either overwriting the other (R303: nothing is lost).
//
// THE accountTag COLUMN, ADDED IN AN-FIX (F4 / R303), REVERSES "NO userId COLUMN".
// AN5 deliberately held no account column ("the token identifies the user"), which
// F4 showed is false on a shared, resold or handed-over device: an expired session
// is not a sign-out, so one account's queued days drained into the next account to
// sign in. The column is LOCAL ONLY and OPAQUE - a SHA-256 tag of the account's
// address (account/AccountTag.kt), never the address itself, and never on the wire
// (EntriesWire omits it). It defaults to UNOWNED, the fail-closed sentinel for a
// row whose account cannot be resolved; the real writers (EntryRepository, the
// seeder, the sync reconcile) set it explicitly. Adding it is exactly the migration
// the harness exists to make safe: a REAL v2 -> v3 migration, no destructive wipe.
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

@Entity(tableName = "entry", primaryKeys = ["accountTag", "dayDate", "portion"])
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
    /**
     * LOCAL ONLY, NEVER ON THE WIRE (AN-FIX F4 / R303). The opaque account tag of the account that
     * recorded this row (account/AccountTag.kt) - the device's half of the server's
     * @@unique([userId, dayDate, portion]), and part of the primary key. Defaults to UNOWNED, the
     * fail-closed sentinel for a row whose account could not be resolved (a pre-F4 migration, or a tap
     * with no active account): an UNOWNED row is never sent and never shown. The real writers set it
     * explicitly from the active account.
     */
    val accountTag: String = UNOWNED_ACCOUNT,
)
