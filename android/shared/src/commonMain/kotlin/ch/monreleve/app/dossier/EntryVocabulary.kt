package ch.monreleve.app.dossier

// KMP-0 increment 6c (R372, R371). THE AGGREGATION'S PLATFORM-FREE VOCABULARY. The shared dossier logic
// (countDays, toTeleworkInput, the forecast/simulation projections) buckets a day by its KIND and weighs
// it by its PORTION, and it must do so for iOS too - so the two enums it switches over live here, in
// commonMain, not in :app's Room layer.
//
// WHY A SECOND SET OF NAMES, NOT A MOVE OF data.local's. R372 keeps `data` (Room, the wire enums, the DAO)
// in :app for KMP-0; those enums are the WIRE contract (web/lib/entries/schema.ts, WireContractParityTest)
// and the Room column type, and dragging them into :shared would pull Room/KSP across the module boundary.
// So :app maps its Room rows to THESE types at the boundary (R372's own sentence) - EntryEntity.toAggregatable()
// and WeeklyRhythm.toEntryKindMap() in :app, the twin of settings.toAggregatableUser().
//
// NO DRIFT, PROVEN BY THE COMPILER IN BOTH DIRECTIONS (not by two copies a reader keeps in sync, R206):
//   - a value added to data.local.EntryKind breaks the exhaustive `when` in :app's EntryKind.toShared();
//   - a value added here breaks the exhaustive `when` in countDays (and in toShared, which must map it).
// EntryVocabularyBindingTest additionally asserts the constant NAMES match data.local's, so the name-wise
// mapping cannot silently diverge. Same names and same order as data.local on purpose: the mapping is a
// name identity, and a reader meets one vocabulary, not two that merely resemble each other.

/** Where a day was worked, or that it was an absence - the engine-input vocabulary. Mirrors data.local.EntryKind. */
enum class EntryKind {
    CH,
    HOME,
    MISSION_FR,
    MISSION_THIRD,
    ABSENT,
}

/** A whole day or a half. Mirrors data.local.Portion. A half-day pair (AM + PM) sums to exactly one day. */
enum class Portion {
    FULL,
    AM,
    PM,
}
