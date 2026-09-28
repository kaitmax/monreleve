package ch.monreleve.app.data.local

// AN5 increment 1. The entry vocabulary EXACTLY as the server's zod schema
// accepts it (web/lib/entries/schema.ts, verified R0.2). This is a contract with
// a client that cannot be redeployed (R187): a device that installs a release
// persists these names, and the same names go on the wire, so a rename here is a
// migration AND a server disagreement at once.
//
// ONE HOME FOR EACH VALUE (R206). Room persists an enum as its constant NAME as
// TEXT, and the POST body carries the same NAME as a JSON string - so enum.name
// is simultaneously the stored column value and the wire value. There is no
// second mapping table to drift. WireContractParityTest reads the four arrays out
// of web/lib/entries/schema.ts and fails if any of these sets diverges from it,
// which is R181 (derive, never transcribe) pointed across the language boundary.
//
// THESE ARE WIRE IDENTIFIERS, NOT FRENCH COPY. CONGE carries no accent because
// the server's enum value is the ASCII token CONGE; the accented "conge" belongs
// to display copy in fr/, which is a separate concern (R155's identifier
// corollary - a value inside a contract is not prose).
//
// DELIBERATELY NOT THE DISPLAY VOCABULARY. design/DayCell.kt's DayKind has four
// values (SUISSE/DOMICILE/MISSION/ABSENCE) because it collapses the two mission
// destinations into one letter and dot; the wire distinguishes MISSION_FR from
// MISSION_THIRD because the calculation does. Two vocabularies for two jobs is
// R202's orthogonality, not duplication.

/** Where the day was worked, or that it was an absence. Server: `kind`. */
enum class EntryKind {
    CH,
    HOME,
    MISSION_FR,
    MISSION_THIRD,
    ABSENT,
}

/** A whole day or a half. Server: `portion`, default FULL. */
enum class Portion {
    FULL,
    AM,
    PM,
}

/** How the record came to be. Server: `provenance`, default MANUAL. Orthogonal to detectedKind (R202). */
enum class Provenance {
    MANUAL,
    DETECTED_CONFIRMED,
    DETECTED_CORRECTED,
}

/** Why the day was an absence. Server: `absenceReason`, required iff kind = ABSENT. */
enum class AbsenceReason {
    CONGE,
    MALADIE,
    FERIE,
    AUTRE,
}

/**
 * A LOCAL-ONLY column - it never goes on the wire and has no server counterpart.
 * PENDING means this row is a mutation the queue still owes the server; SYNCED
 * means the server has acknowledged it and returned its own row. Sync-failure
 * states arrive with the sync path (increment 3); a new TEXT enum value needs no
 * schema migration, so adding one later is free.
 */
enum class SyncState {
    PENDING,
    SYNCED,
}
