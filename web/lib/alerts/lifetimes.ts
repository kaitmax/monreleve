// web/lib/alerts/lifetimes.ts
//
// How long the alert flow's records live, as values with no database behind
// them. FW-DELAI-RAPPEL (R915) EXTRACTED these from purge.ts and record.ts
// rather than writing them a second time: the deadline reminder confirms by
// the same mechanics and is purged on the same schedule, and the privacy
// notice states its lifetimes by interpolating these (R153, R181). A copy
// module importing purge.ts would have pulled the database client in with
// the number; this file is what both can import.
//
// purge.ts and record.ts still export what they exported, so every alert test
// reads the same names from the same modules it always did.

/** Unconfirmed rows are deleted after this many days. /confidentialite states it. */
export const PURGE_AFTER_DAYS = 30;

/** A confirmation link works for this many days. The schema explains the seven. */
export const CONFIRMATION_TTL_DAYS = 7;
