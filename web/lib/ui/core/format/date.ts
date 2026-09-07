// web/lib/ui/core/format/date.ts
//
// SPEC 6.4: "formatDate -> Swiss dots." SPEC 8: the Releve annuel names days,
// so a UTC day-boundary bug here is a WRONG RECORD rather than a cosmetic
// slip.
//
// Same design as format/number.ts, for the same reason: Intl is used for the
// hard part - converting an instant into calendar fields in a named time zone
// - and for nothing else. Every separator is written here.
//
// WHY THE FIELDS ARE READ AND THE PARTS ARE NOT JOINED. Measured on this
// build (Node 22.14, ICU 76.1, CLDR 46):
//
//   Only the -CH tags give dots. fr-CH and de-CH render 18.12.2026; fr-FR
//   renders 18/12/2026 with U+002F. So "Swiss dots" is a property of a
//   locale-data table, and joining ICU's literal parts makes the output
//   hostage to it.
//
//   Field ORDER is locale data too. en-US puts the month first, so an
//   assembler that concatenated parts in the order given would produce
//   12.18.2026 - a date that is not wrong-looking, just wrong.
//
//   format() and formatToParts() disagree for the SAME formatter. en-US
//   timeStyle 'short' yields U+0020 from format() and U+202F from
//   formatToParts(). Reading fields makes that irrelevant.
//
// THE TIME ZONE IS PINNED, NEVER INHERITED. A DateTimeFormat with no timeZone
// resolves to the host zone. Measured for 2026-12-18T00:00:00Z: UTC,
// Europe/Paris and this workstation's zone all render 18.12.2026, and
// America/New_York renders 17.12.2026. So the unpinned version is right here,
// right in CI (ubuntu is UTC) and a day wrong for any viewer west of
// Greenwich - the failure is invisible everywhere it would be tested and
// visible only to users.

/**
 * A date-only value carries no instant, so it is read in UTC and renders as
 * the calendar date it was written as.
 *
 * THE CALLER'S CONTRACT: pass a Date whose UTC calendar fields are the
 * intended day - `new Date('2026-12-18T00:00:00Z')`, which is what a date
 * column deserialises to. A Date built from local midnight in a zone behind
 * UTC carries the previous UTC day and will render as such. Flagged for the
 * operator in REPORT-FW6.txt, because the storage convention lands with the
 * schema in a later task.
 */
export const DATE_ZONE = 'UTC';

/**
 * A timestamp is an instant, and the audience is cross-border workers living
 * in France, so they read it in their own wall clock.
 */
export const DATE_TIME_ZONE = 'Europe/Paris';

/** U+002E FULL STOP. The Swiss date separator (SPEC 6.4). */
const DATE_SEPARATOR = '.';

/** U+00E0 LATIN SMALL LETTER A WITH GRAVE, precomposed. */
const AT = '\u00E0';

/** U+003A COLON, between hours and minutes. */
const TIME_SEPARATOR = ':';

/**
 * The locale is used for NOTHING that reaches the output. Every field is
 * requested numerically and every separator is written above, so this could
 * be any tag - which is exactly the property the tests pin by feeding
 * normaliseDate parts from fr-FR and en-US and requiring the same answer.
 */
const LOCALE = 'fr-CH';

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const NUMERIC_TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  // 'h23', not hour12:false. hour12:false selects the h24 cycle in some
  // locales, which renders midnight as 24:00 on the previous day.
  hourCycle: 'h23',
};

function fieldOf(parts: readonly Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find((part) => part.type === type);

  if (found === undefined) {
    throw new RangeError(`date parts carry no ${type} field`);
  }

  return found.value;
}

/**
 * Assemble dd.mm.yyyy from date parts, reading fields and writing the
 * separators. Exported as the seam where locale-independence is testable.
 */
export function normaliseDate(parts: readonly Intl.DateTimeFormatPart[]): string {
  const day = fieldOf(parts, 'day');
  const month = fieldOf(parts, 'month');
  const year = fieldOf(parts, 'year');

  return `${day}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${year}`;
}

/** Assemble "dd.mm.yyyy a hh:mm" from date-and-time parts. */
export function normaliseDateTime(parts: readonly Intl.DateTimeFormatPart[]): string {
  // A dayPeriod means the parts came from a 12-hour formatter, where the hour
  // field reads 06 for 18:00. Recovering 18 from that would mean parsing a
  // localised AM/PM string, and getting it wrong renders a timestamp twelve
  // hours out while looking perfectly well-formed. Rejected instead.
  if (parts.some((part) => part.type === 'dayPeriod')) {
    throw new RangeError(
      'date parts carry a dayPeriod: build the formatter with hourCycle h23, ' +
        'because a 12-hour hour field cannot be rendered as 24-hour time',
    );
  }

  const hour = fieldOf(parts, 'hour');
  const minute = fieldOf(parts, 'minute');

  return `${normaliseDate(parts)} ${AT} ${hour}${TIME_SEPARATOR}${minute}`;
}

function requireValid(date: Date, formatter: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${formatter} received an invalid Date`);
  }
}

/** A calendar date, Swiss dots, four-digit year. */
export function formatDate(date: Date, timeZone: string = DATE_ZONE): string {
  requireValid(date, 'formatDate');

  return normaliseDate(
    new Intl.DateTimeFormat(LOCALE, { ...NUMERIC_DATE, timeZone }).formatToParts(date),
  );
}

/** A timestamp, as "18.06.2027 a 18:03" (SPEC 6.4), in 24-hour time. */
export function formatDateTime(date: Date, timeZone: string = DATE_TIME_ZONE): string {
  requireValid(date, 'formatDateTime');

  return normaliseDateTime(
    new Intl.DateTimeFormat(LOCALE, {
      ...NUMERIC_DATE,
      ...NUMERIC_TIME,
      timeZone,
    }).formatToParts(date),
  );
}
