// web/lib/rappel/window.ts
//
// FW-DELAI-RAPPEL, R916: WHEN a reminder can be offered and when it is due.
// Pure, and read by BOTH sides - the comparator's island, which hides the form
// for a date too close, and the server, which refuses one - so the rule has
// one home (R206) and the two cannot disagree about it. The privacy notice
// states the lead time by interpolating DAYS_BEFORE (R153, R181).
//
// CALENDAR DAYS, NEVER MILLISECONDS. "Fourteen days before the date" is a
// statement about the reader's calendar; subtracting 14 x 86 400 000 from an
// instant is an hour out twice a year across a change of clock. Every value
// here is an ISO day ("2027-02-28"), and the arithmetic is done on UTC
// midnights where no zone can move a boundary.
//
// WHICH "TODAY" IS THE CALLER'S. The island passes the reader's own day; the
// server passes the day in Europe/Paris (SPEC 8: day boundaries are computed
// there). Where the two differ, at a boundary, the server's answer is the one
// that holds and the island shows its refusal.
//
// R916's QUESTION, NOT A DECISION: a date fewer than fourteen days away when
// the person signs up or confirms. The conservative choice is taken - no form,
// no mail ever sent for it - and the alternative is handed back.

/** R916: the one reminder goes out this many days before the date. */
export const DAYS_BEFORE = 14;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC midnight of an ISO day, or undefined when it is not a real one. */
function utcMidnight(iso: string): number | undefined {
  const match = ISO_DAY.exec(iso);

  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const back = new Date(time);

  // A day the calendar does not have (30 February) rolls over in Date.UTC;
  // reading the parts back is what refuses it.
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
    return undefined;
  }

  return time;
}

/** Whether a string is a real ISO day. */
export function isIsoDay(value: string): boolean {
  return utcMidnight(value) !== undefined;
}

/** An ISO day moved by whole calendar days, or undefined for a bad day. */
export function shiftDays(iso: string, days: number): string | undefined {
  const time = utcMidnight(iso);

  if (time === undefined) return undefined;

  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

/** The day the reminder is due: the date minus DAYS_BEFORE calendar days. */
export function reminderDay(deadline: string): string | undefined {
  return shiftDays(deadline, -DAYS_BEFORE);
}

/**
 * Whether a reminder can still be offered for `deadline` on `today`.
 *
 * True while the due day has not passed: on the due day itself the reminder
 * goes out at the next pass. ISO days compare as strings.
 */
export function reminderOffered(deadline: string, today: string): boolean {
  const due = reminderDay(deadline);

  return due !== undefined && isIsoDay(today) && today <= due;
}

/** The reader's own calendar day, for the island. */
export function localDay(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
