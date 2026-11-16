// web/lib/rappel/window.ts
//
// FW-DELAI-RAPPEL, R916: WHEN a reminder can be offered and when it is due.
// Pure, and read by BOTH sides - the comparator's island, which hides the form
// for a date too close, and the server, which refuses one - so the rule has
// one home (R206) and the two cannot disagree about it. The privacy notice
// states the lead time by interpolating DAYS_BEFORE (R153, R181).

/** R916: the one reminder goes out this many days before the date. */
export const DAYS_BEFORE = 14;
