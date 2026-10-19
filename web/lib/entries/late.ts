// web/lib/entries/late.ts
//
// The backfill threshold, and its one home. FW24 increment 4.
//
// ============================================================================
// R216 DEFERRED THIS HERE, AND THIS IS WHERE IT LANDS
// ============================================================================
//
// FW23 froze the read contract without a `late` field, on the ruling that
// adding a key later is additive and that the threshold had no home in the
// code. It had one place it was written down - a `SEVEN_DAYS` constant in
// tests/db/demo-year.test.ts with the subtraction hand-written beside it -
// which is a transcription living in a test, R181's shape exactly.
//
// Now the dossier needs it: SPEC 12's evidence annex prints the « saisie
// tardive » flag on every entry, so the rule has to exist somewhere a renderer
// can read it.
//
// ============================================================================
// THE CLIENT MAY PREDICT; IT MUST NOT ADJUDICATE
// ============================================================================
//
// SPEC 11.3 gives the sheet a PROSPECTIVE warning: it tells the reader, while
// they are still editing, that backfilling this far will be flagged. That
// warning fires before any write, before the server has assigned
// `firstRecordedAt`, so no server-sent boolean can supply it - the client needs
// the RULE, not the answer.
//
// What the client must not do is decide what the RECORD says. The flag in the
// dossier, in the CSV and on the API is computed here, from the server's own
// timestamps, so all three say the same thing. A `7` compiled into an APK and a
// `7` in this file are two sources for one rule, and the APK is the one that
// cannot be changed.

/** 24 hours, from its factors, so no bare millisecond count appears. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * SPEC 11.3: backfilling beyond seven days is allowed but flagged.
 *
 * ALLOWED IS THE IMPORTANT HALF. This is not a limit and nothing refuses a
 * write because of it - a reader who remembers a day three weeks later should
 * record it, and the record should say when they did. The flag exists so the
 * document is honest about the gap, not to discourage the entry.
 */
export const LATE_BACKFILL_DAYS = 7;

const LATE_BACKFILL_MS = LATE_BACKFILL_DAYS * MS_PER_DAY;

/**
 * Was this day recorded late?
 *
 * ============================================================================
 * LATENESS IS MEASURED AGAINST THE SERVER'S OBSERVATION, NEVER THE CLIENT'S
 * CLAIM. THIS IS A DECISION, NOT A MISSING PARAMETER.
 * ============================================================================
 *
 * `dayDate` is the calendar day the entry describes and `firstRecordedAt` is
 * the instant the server first heard about it. `clientClaimedAt` - the
 * device's own assertion about when it was written - is deliberately not an
 * input, and the signature has no parameter for it.
 *
 * ASK WHO WOULD BENEFIT FROM THE OTHER CHOICE. A user whose app could claim an
 * earlier moment would be able to clear a late flag at will, and the annex's
 * entire value is that the server's timestamp is not negotiable. Reading the
 * claim would make the flag a statement the record's subject controls, which is
 * the opposite of evidence.
 *
 * SO AN OFFLINE ENTRY SYNCED EIGHT DAYS LATER IS GENUINELY LATE, and the
 * dossier says so. That is not a defect of the offline path: the document
 * reports when the SERVER learned of a day, and it prints `clientClaimedAt`
 * beside it (SPEC 12 item 5) so a reader can see the device's account of the
 * same day and judge the gap themselves. Two facts, both shown, neither
 * standing in for the other.
 *
 * STRICTLY GREATER THAN. Seven days is not late; the eighth is. SPEC 11.3 says
 * "beyond 7 days", and a boundary written as `>=` would flag a day recorded
 * exactly a week later - which is the ordinary case of somebody catching up on
 * the following Monday.
 *
 * ============================================================================
 * THE ARITHMETIC GOES NEGATIVE FOR A DAY THAT HAS NOT HAPPENED, AND THAT IS
 * NOT FIXED HERE. IT IS FIXED AT THE DOOR (R410/R413).
 * ============================================================================
 *
 * `firstRecordedAt - startOfStoredDay(dayDate)` is NEGATIVE when the day has
 * not started, and a negative number is not greater than seven days - so this
 * returns false and the entry reads as ON TIME. The green marker, on a day
 * nobody has worked. KMP-2 produced exactly one: a phone at 00:15 Paris wrote
 * 2026-10-20 while the server clock said 2026-10-19.
 *
 * NOTHING IS WRONG WITH THE SUBTRACTION. This function answers "how long AFTER
 * a day was it recorded", which is the only question SPEC 11.3 asks, and a day
 * that has not happened is not a late one - it is not a recordable one.
 *
 * SO THE WRITE PATH REFUSES IT (`future_day`, app/api/v1/entries/route.ts),
 * and this input cannot arrive. A defensive branch here would be a second rule
 * in a second place (R206) and would make the real one look optional - which
 * is how it would come to be removed.
 *
 * IF YOU ARE HERE BECAUSE THE NEGATIVE CASE LOOKS LIKE A BUG: it is reachable
 * only if that refusal has gone. tests/unit/entries/late.test.ts asserts the
 * refusal is still in the route, and will fail before this does.
 */
export function isLate(dayDate: Date, firstRecordedAt: Date): boolean {
  return firstRecordedAt.getTime() - startOfStoredDay(dayDate) > LATE_BACKFILL_MS;
}

/**
 * The UTC midnight the stored day begins at.
 *
 * `dayDate` is a `@db.Date` holding UTC midnight already (R28), so this is
 * normally the value itself - but reading `.getTime()` on a column that ever
 * acquired a time component would make the comparison depend on the hour a row
 * was written. Normalising is cheap and removes the question.
 */
function startOfStoredDay(dayDate: Date): number {
  return Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate());
}

/** How late, in whole days, for copy that wants to say how far. */
export function latenessInDays(dayDate: Date, firstRecordedAt: Date): number {
  const elapsed = firstRecordedAt.getTime() - startOfStoredDay(dayDate);

  return Math.floor(elapsed / MS_PER_DAY);
}
