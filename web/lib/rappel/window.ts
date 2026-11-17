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
// TWO BOUNDS, AND EACH IS A RULING:
//   - too close: a date fewer than DAYS_BEFORE days away gets no form and is
//     refused (R916's conservative choice, KEPT by R1000: no mail is ever sent
//     for it - it would only repeat what the page showed);
//   - too far: a date more than MAX_MONTHS_AHEAD calendar months away is
//     refused (R1004), which bounds how long a confirmed request can wait.
//     The database holds the same bound (the migration's
//     DeadlineReminder_deadline_bound, tied to this constant by
//     tests/db/rappel-delai-schema.test.ts), so it survives a writer that
//     never calls this module (R196).

/** R916: the one reminder goes out this many days before the date. */
export const DAYS_BEFORE = 14;

/**
 * R1004: the latest date a reminder can be asked for, in calendar months
 * after today. The helper does not bound its own input (lib/lamal/deadline.ts
 * accepts any year), so the bound is stated here rather than derived from it.
 */
export const MAX_MONTHS_AHEAD = 12;

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

/** An ISO day from UTC parts, zero-padded. */
function isoOf(year: number, monthIndex: number, day: number): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');

  return `${pad(year, 4)}-${pad(monthIndex + 1, 2)}-${pad(day, 2)}`;
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

/**
 * An ISO day moved by whole calendar MONTHS, the day kept and clamped to the
 * last day of the target month - 29 February 2028 plus twelve months is 28
 * February 2029. That is PostgreSQL's own rule for `date + interval 'n
 * months'`, which the database's bound uses, so the two sides agree on every
 * day of the year, leap days included.
 *
 * Written here rather than shared with lib/lamal/deadline.ts, whose clamp is
 * the same: that module computes the deadline, and this task does not change
 * how the deadline is computed (C10's hard boundary).
 */
export function shiftMonths(iso: string, months: number): string | undefined {
  const time = utcMidnight(iso);

  if (time === undefined) return undefined;

  const start = new Date(time);
  const index = start.getUTCMonth() + months;
  const year = start.getUTCFullYear() + Math.floor(index / 12);
  const monthIndex = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return isoOf(year, monthIndex, Math.min(start.getUTCDate(), lastDay));
}

/** The day the reminder is due: the date minus DAYS_BEFORE calendar days. */
export function reminderDay(deadline: string): string | undefined {
  return shiftDays(deadline, -DAYS_BEFORE);
}

/** R1004: the latest date a reminder can be asked for on `today`. */
export function latestDeadline(today: string): string | undefined {
  return shiftMonths(today, MAX_MONTHS_AHEAD);
}

/**
 * Where a date stands on `today`, as the helper and the server both need to
 * say it: offered, or refused for one of two named reasons. ISO days compare
 * as strings.
 */
export type ReminderWindow = 'offered' | 'too-close' | 'too-far' | 'invalid';

export function reminderWindow(deadline: string, today: string): ReminderWindow {
  const due = reminderDay(deadline);
  const latest = latestDeadline(today);

  if (due === undefined || latest === undefined) return 'invalid';

  // On the due day itself the reminder goes out at the next pass, so the
  // window stays open until the day after it.
  if (today > due) return 'too-close';
  if (deadline > latest) return 'too-far';

  return 'offered';
}

/** Whether a reminder can be offered for `deadline` on `today`. */
export function reminderOffered(deadline: string, today: string): boolean {
  return reminderWindow(deadline, today) === 'offered';
}

/** The reader's own calendar day, for the island. */
export function localDay(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
